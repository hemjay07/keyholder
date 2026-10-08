// File: apps/web/src/lib/route.ts
// One wrapper for every /api/v1 route: rate limit, JSON envelope { data, error }, cache header, 404 on null.
import { NextResponse } from 'next/server';
import { rateLimitByIp } from './rate-limit';

export async function handle(req: Request, name: string, fn: () => Promise<unknown>, maxAgeS = 60): Promise<NextResponse> {
  const limit = await rateLimitByIp(req);
  if (!limit.ok) return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  try {
    const data = await fn();
    if (data == null) return NextResponse.json({ data: null, error: { code: 'NOT_FOUND' } }, { status: 404, headers: limit.headers });
    return NextResponse.json({ data, error: null }, { headers: { ...limit.headers, 'Cache-Control': `public, max-age=${maxAgeS}, s-maxage=${maxAgeS * 5}` } });
  } catch (error) {
    console.error(`GET ${name} failed`, error);
    return NextResponse.json({ data: null, error: { code: 'SERVER_ERROR' } }, { status: 500, headers: limit.headers });
  }
}

/** ?day=YYYY-MM-DD if valid, else the latest built day. */
export function dayParam(req: Request): string | null {
  const d = new URL(req.url).searchParams.get('day');
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}
