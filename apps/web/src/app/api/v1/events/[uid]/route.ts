// File: apps/web/src/app/api/v1/events/[uid]/route.ts
// GET /api/v1/events/:uid — before/after control state + correction history.

import { NextResponse } from 'next/server';
import { fetchEventDetail } from '@/lib/api-client';
import { rateLimitByIp } from '@/lib/rate-limit';

export async function GET(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const limit = await rateLimitByIp(req);
  if (!limit.ok) {
    return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  }

  try {
    const { uid } = await params;
    const event = await fetchEventDetail(decodeURIComponent(uid));
    if (!event) {
      return NextResponse.json({ data: null, error: { code: 'NOT_FOUND' } }, { status: 404, headers: limit.headers });
    }
    return NextResponse.json(
      { data: event, error: null },
      { headers: { ...limit.headers, 'Cache-Control': 'public, max-age=60' } }
    );
  } catch (error) {
    console.error('GET /api/v1/events/[uid] failed', error);
    return NextResponse.json({ data: null, error: { code: 'SERVER_ERROR', message: String(error) } }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
