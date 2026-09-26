// File: apps/web/src/app/api/v1/replay/drift/route.ts
// GET /api/v1/replay/drift — frames + posture + measured lead time from
// replay_runs (arch/D-web.md, DEV-043's "first transition alert" semantics:
// leadTimeSeconds/firstAlertSlot describe the first delta caused by a real
// change, `posture` is the standing condition observed at window start).

import { NextResponse } from 'next/server';
import { fetchDriftReplay } from '@/lib/api-client';
import { rateLimitByIp } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const limit = await rateLimitByIp(req);
  if (!limit.ok) {
    return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  }

  try {
    const replay = await fetchDriftReplay();
    if (!replay) {
      return NextResponse.json({ data: null, error: { code: 'NOT_FOUND' } }, { status: 404, headers: limit.headers });
    }
    return NextResponse.json(
      { data: replay, error: null },
      { headers: { ...limit.headers, 'Cache-Control': 'public, max-age=300' } }
    );
  } catch (error) {
    console.error('GET /api/v1/replay/drift failed', error);
    return NextResponse.json({ data: null, error: { code: 'SERVER_ERROR', message: String(error) } }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
