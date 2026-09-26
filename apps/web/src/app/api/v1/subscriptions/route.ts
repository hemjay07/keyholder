// File: apps/web/src/app/api/v1/subscriptions/route.ts
// GET list / POST create subscriptions for the authenticated wallet (SIWS).

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { getWalletFromRequest } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rate-limit';

const createSchema = z.object({
  scope: z.enum(['protocol', 'program', 'global']),
  target: z.string().min(1),
  minSeverity: z.enum(['info', 'low', 'medium', 'high', 'critical']).default('low'),
  channels: z.array(z.enum(['telegram', 'email', 'webhook', 'x'])).default([]),
});

export async function GET(req: Request) {
  const limit = await rateLimitByIp(req, true);
  if (!limit.ok) {
    return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  }

  const wallet = await getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHENTICATED' } }, { status: 401, headers: limit.headers });
  }

  const db = getDb();
  const rows = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.user_id, wallet));
  return NextResponse.json(
    {
      data: rows.map((r) => ({
        id: r.id,
        scope: r.scope,
        target: r.target,
        minSeverity: r.min_severity,
        channels: r.channels ?? [],
      })),
      error: null,
    },
    { headers: limit.headers }
  );
}

export async function POST(req: Request) {
  const limit = await rateLimitByIp(req, true);
  if (!limit.ok) {
    return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  }

  const wallet = await getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHENTICATED' } }, { status: 401, headers: limit.headers });
  }

  try {
    const body = createSchema.parse(await req.json());
    const db = getDb();
    const id = crypto.randomUUID();
    await db.insert(schema.subscriptions).values({
      id,
      user_id: wallet,
      scope: body.scope,
      target: body.target,
      min_severity: body.minSeverity,
      channels: body.channels,
    });
    return NextResponse.json({ data: { id }, error: null }, { status: 201, headers: limit.headers });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_BODY', message: String(error) } },
      { status: 400, headers: limit.headers }
    );
  }
}

export const dynamic = 'force-dynamic';
