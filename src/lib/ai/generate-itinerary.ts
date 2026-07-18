import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import {
  ItineraryResponseSchema,
  ItineraryValidationError,
  validateAgainstTrip,
  type ItineraryResponse,
} from '@/lib/ai/itinerary-schema';
import { buildMockItinerary } from '@/lib/ai/mock';
import { SYSTEM_PROMPT, buildUserPrompt, type TripContext } from '@/lib/ai/prompt';

// Sonnet por defecto para las llamadas reales de la app -Opus queda para las
// sesiones de Claude Code mientras se programa, no para producción-.
// Configurable por si hace falta probar con otro modelo puntualmente.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_TOKENS = 16000;

export type GenerationResult = {
  data: ItineraryResponse;
  /** null en modo mock. */
  model: string | null;
  mocked: boolean;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  } | null;
};

export function isMockMode(): boolean {
  // Por defecto mock: en un hackathon es peor gastar tokens sin querer que
  // ver datos de ejemplo. Hay que pedir la llamada real de forma explícita.
  return process.env.USE_MOCK_AI !== 'false';
}

/**
 * Llama a Claude (o al mock) y devuelve el itinerario ya validado contra el
 * viaje real. Lanza ItineraryValidationError si la respuesta no encaja.
 */
export async function generateItinerary(ctx: TripContext): Promise<GenerationResult> {
  const categorySlugs = new Set(ctx.categories.map((c) => c.slug));

  if (isMockMode()) {
    const data = buildMockItinerary(ctx);
    // El mock pasa por el MISMO validador que la respuesta real. Si algún día
    // el mock se desincroniza del esquema, salta aquí y no en producción.
    validateAgainstTrip(data, { days: ctx.days, categorySlugs });
    return { data, model: null, mocked: true, usage: null };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ItineraryValidationError(
      'Falta ANTHROPIC_API_KEY. Ponla en .env.local o deja USE_MOCK_AI=true.',
    );
  }

  const client = new Anthropic();

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // Adaptive thinking: la tarea es de razonamiento (equilibrar preferencias
    // que chocan), no de recitar formato.
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: zodOutputFormat(ItineraryResponseSchema),
    },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // Breakpoint de caché: SYSTEM_PROMPT es la parte fija. Todo lo que
        // varía (el viaje) va en el turno de usuario, después de esto.
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(ctx) }],
  });

  if (response.stop_reason === 'refusal') {
    throw new ItineraryValidationError(
      'Claude rechazó la petición por sus filtros de seguridad. Revisa los vetos en texto libre.',
    );
  }

  if (response.stop_reason === 'max_tokens') {
    throw new ItineraryValidationError(
      `La respuesta se cortó por longitud (${MAX_TOKENS} tokens). Prueba con menos días.`,
    );
  }

  // parsed_output es null si el parseo falló pese al structured output.
  const data = response.parsed_output;
  if (!data) {
    throw new ItineraryValidationError(
      'Claude devolvió una respuesta que no encaja con el formato esperado.',
    );
  }

  validateAgainstTrip(data, { days: ctx.days, categorySlugs });

  return {
    data,
    model: response.model,
    mocked: false,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    },
  };
}
