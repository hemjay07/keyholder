// File: apps/web/src/app/api/v1/events/route.ts
// GET /api/v1/events — filters (protocol, minSeverity) + cursor pagination.

import { NextResponse } from 'next/server';
import { fetchEvents } from '@/lib/api-client';
import { rateLimitByIp } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const limit = await rateLimitByIp(req);
  if (!limit.ok) {
    return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  }

  try {
    const url = new URL(req.url);
    const result = await fetchEvents({
      protocol: url.searchParams.get('protocol') ?? undefined,
      minSeverity: url.searchParams.get('minSeverity') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
    });
    return NextResponse.json(
      { data: result.events, cursor: result.cursor, hasMore: result.hasMore, error: null },
      { headers: { ...limit.headers, 'Cache-Control': 'public, max-age=5' } }
    );
  } catch (error) {
    console.error('GET /api/v1/events failed', error);
    return NextResponse.json({ data: null, error: { code: 'SERVER_ERROR', message: String(error) } }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
