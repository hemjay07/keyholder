// File: apps/web/src/app/api/v1/control-state/route.ts
// GET /api/v1/control-state?protocol=slug&slot=12345 — as-of query.

import { NextResponse } from 'next/server';
import { fetchControlStateAtSlot } from '@/lib/api-client';
import { rateLimitByIp } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const limit = await rateLimitByIp(req);
  if (!limit.ok) {
    return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  }

  const url = new URL(req.url);
  const protocol = url.searchParams.get('protocol');
  if (!protocol) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_QUERY', message: 'protocol query param is required' } },
      { status: 400, headers: limit.headers }
    );
  }

  const slotParam = url.searchParams.get('slot');
  const slot = slotParam ? Number(slotParam) : undefined;
  if (slotParam && Number.isNaN(slot)) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_QUERY', message: 'slot must be a number' } },
      { status: 400, headers: limit.headers }
    );
  }

  try {
    const state = await fetchControlStateAtSlot(protocol, slot);
    if (!state) {
      return NextResponse.json({ data: null, error: { code: 'NOT_FOUND' } }, { status: 404, headers: limit.headers });
    }
    return NextResponse.json(
      { data: state, error: null },
      { headers: { ...limit.headers, 'Cache-Control': 'public, max-age=60' } }
    );
  } catch (error) {
    console.error('GET /api/v1/control-state failed', error);
    return NextResponse.json({ data: null, error: { code: 'SERVER_ERROR', message: String(error) } }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
