// File: apps/web/src/app/api/v1/webhooks/route.ts
// GET list / POST create / DELETE (?id=) webhooks for the authenticated
// wallet (SIWS). Delivery + HMAC signing + retries live in the worker
// (apps/worker/src/alert-dispatcher/webhooks.ts).

import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { getWalletFromRequest } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rate-limit';
import { encryptSecret, generateWebhookSecret } from '@/lib/webhook-secret';

const createSchema = z.object({ url: z.string().url() });

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
  const rows = await db.select().from(schema.webhooks).where(eq(schema.webhooks.user_id, wallet));
  return NextResponse.json(
    {
      data: rows.map((r) => ({ id: r.id, url: r.url, active: r.active, failureCount: r.failure_count })),
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
    const { url } = createSchema.parse(await req.json());
    const db = getDb();
    const id = crypto.randomUUID();
    const secret = generateWebhookSecret();

    await db.insert(schema.webhooks).values({
      id,
      user_id: wallet,
      url,
      secret_enc: encryptSecret(secret),
      active: true,
    });

    // The plaintext secret is returned exactly once; it cannot be recovered later.
    return NextResponse.json({ data: { id, url, secret }, error: null }, { status: 201, headers: limit.headers });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_BODY', message: String(error) } },
      { status: 400, headers: limit.headers }
    );
  }
}

export async function DELETE(req: Request) {
  const limit = await rateLimitByIp(req, true);
  if (!limit.ok) {
    return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  }
  const wallet = await getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHENTICATED' } }, { status: 401, headers: limit.headers });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ data: null, error: { code: 'INVALID_QUERY', message: 'id is required' } }, { status: 400, headers: limit.headers });
  }

  const db = getDb();
  const deleted = await db
    .delete(schema.webhooks)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.user_id, wallet)))
    .returning({ id: schema.webhooks.id });

  if (deleted.length === 0) {
    return NextResponse.json({ data: null, error: { code: 'NOT_FOUND' } }, { status: 404, headers: limit.headers });
  }
  return NextResponse.json({ data: { id }, error: null }, { headers: limit.headers });
}

export const dynamic = 'force-dynamic';
