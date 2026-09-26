// File: apps/web/src/app/api/v1/programs/route.ts
// GET /api/v1/programs?protocol=slug

import { NextResponse } from 'next/server';
import { fetchPrograms } from '@/lib/api-client';
import { rateLimitByIp } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const limit = await rateLimitByIp(req);
  if (!limit.ok) {
    return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  }

  try {
    const url = new URL(req.url);
    const protocol = url.searchParams.get('protocol') ?? undefined;
    const programs = await fetchPrograms({ protocol });
    return NextResponse.json(
      { data: programs, error: null },
      { headers: { ...limit.headers, 'Cache-Control': 'public, max-age=30' } }
    );
  } catch (error) {
    console.error('GET /api/v1/programs failed', error);
    return NextResponse.json({ data: null, error: { code: 'SERVER_ERROR', message: String(error) } }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
