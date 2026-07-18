import { NextResponse, type NextRequest } from 'next/server';

import { regenerateTripItinerary } from '@/lib/ai/regenerate-service';

/** Regenera el itinerario (v2/v3) a partir de la ronda de votos actual. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params;
  const result = await regenerateTripItinerary(tripId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error, ...result.extra }, { status: result.status });
  }

  return NextResponse.json({
    version_id: result.versionId,
    version_number: result.versionNumber,
    destination: result.destination,
    activities_count: result.activitiesCount,
    conflicts_count: result.conflictsCount,
    mocked: result.mocked,
    model: result.model,
    usage: result.usage,
  });
}
