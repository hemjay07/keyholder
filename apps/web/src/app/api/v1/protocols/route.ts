// File: apps/web/src/app/api/v1/protocols/route.ts
// GET /api/v1/protocols — list with control facts (authority kind,
// threshold/members, timelock, verified status, evidence signature, as-of slot).

import { NextResponse } from 'next/server';
import { fetchProtocols } from '@/lib/api-client';
import { rateLimitByIp } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const limit = await rateLimitByIp(req);
  if (!limit.ok) {
    return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  }

  try {
    const protocols = await fetchProtocols();
    return NextResponse.json(
      { data: protocols, error: null },
      { headers: { ...limit.headers, 'Cache-Control': 'public, max-age=10, s-maxage=30' } }
    );
  } catch (error) {
    console.error('GET /api/v1/protocols failed', error);
    return NextResponse.json({ data: null, error: { code: 'SERVER_ERROR', message: String(error) } }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
