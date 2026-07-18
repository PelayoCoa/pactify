import { NextResponse, type NextRequest } from 'next/server';

import { generateItinerary } from '@/lib/ai/generate-itinerary';
import { ItineraryValidationError } from '@/lib/ai/itinerary-schema';
import { persistItineraryVersion } from '@/lib/ai/persist-itinerary';
import { loadBaseTripAiContext } from '@/lib/ai/trip-context';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** Genera el itinerario inicial (v1) de un viaje. */

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params;

  // --- 1. Autenticación y permisos (cliente con sesión, RLS activo) --------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, 'No has iniciado sesión.');

  const { data: trip } = await supabase
    .from('trips')
    .select('id, title, days, budget_mode, group_budget, status, organizer_id')
    .eq('id', tripId)
    .single();

  // RLS: si no eres participante, no lo ves. Mismo 404 que el resto de la app,
  // para no filtrar si el viaje existe.
  if (!trip) return fail(404, 'Viaje no encontrado.');

  // Generar quema presupuesto de tokens y solo hay 2 regeneraciones: lo lanza
  // el organizador, no cualquiera.
  if (trip.organizer_id !== user.id) {
    return fail(403, 'Solo el organizador puede generar el itinerario.');
  }

  // --- 2. Este endpoint es SOLO para la v1 --------------------------------
  // Las regeneraciones con votos (v2/v3) van por /regenerate.
  // La tabla ya lo blinda con unique (trip_id, version_number), pero un 409
  // claro es mejor que un error de constraint.
  const { data: existing } = await supabase
    .from('itinerary_versions')
    .select('id, version_number')
    .eq('trip_id', tripId)
    .limit(1);

  if (existing && existing.length > 0) {
    return fail(409, 'Este viaje ya tiene un itinerario. Las regeneraciones van por /regenerate.');
  }

  // --- 3. Lock atómico contra doble-clic o llamadas simultáneas -------------
  // Un lock en memoria de proceso (una variable, un Map) NO serviría aquí:
  // en serverless cada invocación puede caer en una instancia distinta, sin
  // memoria compartida entre ellas. El mutex tiene que vivir en la propia
  // fila: este UPDATE solo afecta una fila si el estado sigue siendo
  // draft/collecting en el momento exacto de escribir -Postgres serializa
  // los UPDATE concurrentes sobre la misma fila-, así que si dos peticiones
  // llegan casi a la vez, la segunda no encuentra fila que cumpla el WHERE y
  // sale aquí, antes de gastar un solo token en Claude.
  const admin = createAdminClient();
  const { data: locked } = await admin
    .from('trips')
    .update({ status: 'generating' })
    .eq('id', tripId)
    .in('status', ['draft', 'collecting'])
    .select('id')
    .single();

  if (!locked) {
    return fail(409, 'Este viaje ya se está generando ahora mismo. Espera a que termine.');
  }

  // --- 4. Recoger los datos reales y construir el contexto -----------------
  // Si loadBaseTripAiContext LANZA (una consulta que rechaza la promesa en vez
  // de devolver {error}), el viaje ya está en 'generating' por el lock: hay
  // que revertirlo a 'collecting' o se queda atascado para siempre.
  const context = await loadBaseTripAiContext(supabase, tripId, trip).catch(async (e) => {
    await admin.from('trips').update({ status: 'collecting' }).eq('id', tripId);
    console.error('[generate] fallo cargando el contexto del viaje:', e);
    return null;
  });
  if (!context) {
    return fail(502, 'No se pudo preparar la generación. Inténtalo otra vez.');
  }
  const { ctx, slugToCategoryId, pendingNames } = context;

  // --- 5. Todos tienen que haber confirmado -------------------------------
  // Decisión: bloquear, no generar con lo que haya. Dos razones concretas:
  // un borrador no confirmado todavía se puede editar (nada lo congela hasta
  // submitted_at), así que generaríamos sobre datos que cambian debajo; y solo
  // hay 2 regeneraciones, gastarlas sobre datos incompletos es tirarlas.
  if (pendingNames.length > 0) {
    // Ya se puso 'generating' para ganar el lock: si se aborta aquí, hay que
    // devolver el viaje a 'collecting' o se queda atascado.
    await admin.from('trips').update({ status: 'collecting' }).eq('id', tripId);
    return fail(422, 'Faltan participantes por confirmar sus preferencias.', {
      pending: pendingNames,
    });
  }

  // --- 6. Generar ----------------------------------------------------------
  let result;
  try {
    result = await generateItinerary(ctx);
  } catch (e) {
    // Nunca dejar el viaje atascado en 'generating'.
    await admin.from('trips').update({ status: 'collecting' }).eq('id', tripId);

    if (e instanceof ItineraryValidationError) {
      return fail(502, `La IA devolvió algo que no cuadra: ${e.message}`);
    }
    console.error('[generate] fallo llamando a Claude:', e);
    return fail(502, 'No se pudo generar el itinerario. Inténtalo otra vez.');
  }

  // --- 7. Escribir. RLS exige service_role aquí ----------------------------
  // itinerary_versions / itinerary_activities son de solo lectura para los
  // clientes a propósito: así nadie se inyecta actividades votables a mano.
  const persisted = await persistItineraryVersion(admin, {
    tripId,
    versionNumber: 1,
    result,
    slugToCategoryId,
  });

  if (!persisted.ok) {
    await admin.from('trips').update({ status: 'collecting' }).eq('id', tripId);
    return fail(500, persisted.error);
  }

  await admin
    .from('trips')
    .update({ status: 'voting', destination: result.data.destination })
    .eq('id', tripId);

  return NextResponse.json({
    version_id: persisted.versionId,
    version_number: 1,
    destination: result.data.destination,
    activities_count: result.data.activities.length,
    conflicts_count: result.data.conflicts.length,
    mocked: result.mocked,
    model: result.mocked ? 'mock' : result.model,
    usage: result.usage,
  });
}
