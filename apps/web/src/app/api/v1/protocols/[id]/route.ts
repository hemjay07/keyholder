// File: apps/web/src/app/api/v1/protocols/[id]/route.ts
// GET /api/v1/protocols/:id

import { NextResponse } from 'next/server';
import { fetchProtocol } from '@/lib/api-client';
import { rateLimitByIp } from '@/lib/rate-limit';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = await rateLimitByIp(req);
  if (!limit.ok) {
    return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  }

  try {
    const { id } = await params;
    const protocol = await fetchProtocol(id);
    if (!protocol) {
      return NextResponse.json({ data: null, error: { code: 'NOT_FOUND' } }, { status: 404, headers: limit.headers });
    }
    return NextResponse.json(
      { data: protocol, error: null },
      { headers: { ...limit.headers, 'Cache-Control': 'public, max-age=10, s-maxage=30' } }
    );
  } catch (error) {
    console.error('GET /api/v1/protocols/[id] failed', error);
    return NextResponse.json({ data: null, error: { code: 'SERVER_ERROR', message: String(error) } }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
