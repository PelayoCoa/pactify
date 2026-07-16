# Pactify

Planificador de viajes en grupo. Cada participante mete sus preferencias por
separado, Claude genera un itinerario que intenta contentar a todos, el grupo
vota cada actividad y la IA lo regenera (máximo 2 veces). El resultado se ve
en un mapa.

Stack: Next.js 16 (App Router) · Supabase (Postgres + Auth) · Tailwind 4 ·
MapTiler + MapLibre GL · API de Claude · Vercel.

## Puesta en marcha

1. **Crea el proyecto en Supabase** y copia la URL y la anon key
   (Project Settings → API).

2. **Variables de entorno**: `cp .env.example .env.local` y rellénalo.

3. **Base de datos**: abre el SQL Editor de Supabase, pega entero
   [supabase/schema.sql](supabase/schema.sql) y ejecútalo. Es idempotente,
   puedes relanzarlo tras cualquier cambio.

4. **Auth → URL Configuration** en el panel de Supabase:
   - *Site URL*: `http://localhost:3000`
   - *Redirect URLs*: añade `http://localhost:3000/auth/callback` y, cuando
     despliegues, `https://TU-APP.vercel.app/auth/callback`.

   Sin esto el magic link rebota. No hay que tocar la plantilla del email:
   el enlace por defecto acaba en `/auth/callback` con un `?code=`.

5. `npm run dev` y entra en http://localhost:3000.

## Probar el login de punta a punta

Ve a `/login`, mete tu email, dale a enviar y abre el enlace **en el mismo
navegador** (el flujo PKCE guarda un verificador en cookie; si lo abres en otro
navegador, falla). Deberías acabar en `/dashboard` con tu email en pantalla, y
en Supabase → Authentication te aparece el usuario, con su fila espejo en
`public.profiles` creada por el trigger.

En el plan gratuito Supabase limita el envío de emails (unos pocos por hora).
Si te quedas sin cuota durante el hackathon, en Authentication → Logs tienes el
enlace generado y puedes pegarlo a mano en el navegador.

## Estructura

```
src/
  app/
    page.tsx                  landing
    login/page.tsx            formulario de magic link
    auth/
      actions.ts              server actions: signInWithMagicLink, signOut
      callback/route.ts       canjea el ?code= por sesión
      error/page.tsx          enlace caducado o inválido
    dashboard/page.tsx        ruta protegida (de momento, un placeholder)
  components/
    auth/login-form.tsx
  lib/
    supabase/
      client.ts               cliente de navegador (anon key + RLS)
      server.ts               cliente de servidor — es async: await createClient()
      admin.ts                service_role, SALTA RLS. Solo para escribir el itinerario
      middleware.ts           refresco de sesión + guardia de rutas
    types/database.ts         tipos de la BD (regenerables con npm run db:types)
    site-url.ts               URL base para el enlace de retorno del email
  middleware.ts
supabase/
  schema.sql                  tablas, enums, triggers y políticas RLS
```

## El modelo de datos, en corto

- `profiles` — espejo de `auth.users`, se rellena solo con un trigger.
- `trips` — organizador, destino (null hasta que la IA lo elige entre las
  propuestas), días, `budget_mode` (`individual` | `group`), estado
  (`draft → collecting → generating → voting → finalized`), código de
  invitación y `regenerations_used` (tope 2, forzado por un CHECK).
- `trip_participants` — quién va. El organizador se añade solo al crear el viaje.
- `preferences` — una fila por (viaje, persona): presupuesto y vetos en texto
  libre. El checklist de intereses vive en `preference_categories`, con postura
  `favorite` / `neutral` / `hated` por cada fila de `categories`.
- `categories` — catálogo (playa, museos, estadios, monumentos…) en tabla y no
  en enum, para poder pintar el checklist desde la BD y añadir categorías sin
  migrar.
- `destination_proposals` — destinos que propone cada participante, con lat/lon
  del geocoder.
- `itinerary_versions` — v1 inicial + hasta 2 regeneraciones. Un índice parcial
  garantiza una sola versión `is_current` por viaje, y un trigger degrada la
  anterior al insertar la nueva.
- `itinerary_activities` — lo que se vota y lo que se pinta en el mapa.
- `votes` — un voto (`up`/`down`) por persona y actividad.

**RLS está activo en todas las tablas.** Solo ves un viaje si eres
participante; solo escribes tus propias filas; solo el organizador toca la
configuración del viaje. Los itinerarios son de **solo lectura** para los
clientes: los inserta el servidor con la service_role tras llamar a Claude, así
nadie se cuela actividades a mano.

Las policies usan las funciones `is_trip_participant()` / `is_trip_organizer()`,
que son `SECURITY DEFINER` a propósito: si una policy de `trip_participants`
consultara esa misma tabla, Postgres entraría en recursión infinita.

## Despliegue

Sube las mismas variables de `.env.local` a Vercel (con `NEXT_PUBLIC_SITE_URL`
apuntando al dominio de producción) y añade
`https://TU-APP.vercel.app/auth/callback` a las Redirect URLs de Supabase.
