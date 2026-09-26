// File: apps/web/src/app/api/v1/positions/[wallet]/route.ts
// GET /api/v1/positions/:wallet — SPL/Token-2022 token accounts (real,
// on-chain). Raydium CLMM/Orca Whirlpool/Kamino/marginfi/Drift position
// decoders are not implemented this phase (see apps/worker/src/positions/resolve.ts
// file header) — this endpoint returns what it can resolve today rather than
// fabricating the rest.
//
// Reads any cached rows from `positions` first (resolved_at within 5 min);
// otherwise resolves live on-chain and upserts, so the endpoint is
// self-contained without a running worker daemon.

import { NextResponse } from 'next/server';
import { and, eq, gte } from 'drizzle-orm';
import { PublicKey } from '@solana/web3.js';
import { getDb, schema } from '@/lib/db';
import { resolveWalletPositions } from '@/lib/positions';
import { rateLimitByIp } from '@/lib/rate-limit';

const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(req: Request, { params }: { params: Promise<{ wallet: string }> }) {
  const limit = await rateLimitByIp(req);
  if (!limit.ok) {
    return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  }

  const { wallet } = await params;
  try {
    new PublicKey(wallet);
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_WALLET' } },
      { status: 400, headers: limit.headers }
    );
  }

  try {
    const db = getDb();
    const cacheCutoff = new Date(Date.now() - CACHE_TTL_MS);
    const cached = await db
      .select()
      .from(schema.positions)
      .where(and(eq(schema.positions.wallet, wallet), gte(schema.positions.resolved_at, cacheCutoff)));

    if (cached.length > 0) {
      return NextResponse.json(
        { data: cached.map(rowToApi), error: null, cached: true },
        { headers: { ...limit.headers, 'Cache-Control': 'public, max-age=60' } }
      );
    }

    const resolved = await resolveWalletPositions(wallet);
    const resolvedAt = new Date();

    if (resolved.length > 0) {
      await db
        .insert(schema.positions)
        .values(
          resolved.map((p) => ({
            wallet,
            protocol_id: p.protocolId,
            kind: p.kind,
            value_usd: p.valueUsd,
            detail: p.detail,
            resolved_at: resolvedAt,
          }))
        );
    }

    return NextResponse.json(
      {
        data: resolved.map((p) => ({ protocolId: p.protocolId, kind: p.kind, valueUsd: p.valueUsd, detail: p.detail, resolvedAt: resolvedAt.toISOString() })),
        error: null,
        cached: false,
      },
      { headers: { ...limit.headers, 'Cache-Control': 'public, max-age=60' } }
    );
  } catch (error) {
    console.error('GET /api/v1/positions/[wallet] failed', error);
    return NextResponse.json({ data: null, error: { code: 'SERVER_ERROR', message: String(error) } }, { status: 500 });
  }
}

function rowToApi(row: typeof schema.positions.$inferSelect) {
  return {
    protocolId: row.protocol_id,
    kind: row.kind,
    valueUsd: row.value_usd,
    detail: row.detail,
    resolvedAt: row.resolved_at.toISOString(),
  };
}

export const dynamic = 'force-dynamic';
