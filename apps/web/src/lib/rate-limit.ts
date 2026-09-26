// File: apps/web/src/lib/rate-limit.ts
// Postgres-backed sliding-window rate limiting (arch/D-web.md §6, decision
// D5: one database, no Redis). Deviation: the contract's pseudo-code called
// a non-existent `db.query.rate_limits.findFirst({ where: { key } })` object
// shorthand; drizzle-orm 0.45's relational query API needs `where: (t, {eq}) =>
// eq(...)`, and the schema here declares no relations at all, so this uses
// the core query builder plus a single upsert statement instead.

import { eq, sql } from 'drizzle-orm';
import { getDb, schema } from './db';

export interface RateLimitConfig {
  key: string;
  limit: number; // max requests per window
  window: number; // seconds
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check and increment a rate limit counter. Uses an INSERT ... ON CONFLICT
 * upsert so concurrent requests for the same key serialize on the row lock
 * instead of racing a read-then-write.
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const newResetAt = now + config.window;

  try {
    const rows = await db
      .insert(schema.rate_limits)
      .values({ key: config.key, count: 1, reset_at: newResetAt })
      .onConflictDoUpdate({
        target: schema.rate_limits.key,
        set: {
          count: sql`CASE WHEN ${schema.rate_limits.reset_at} < ${now} THEN 1 ELSE ${schema.rate_limits.count} + 1 END`,
          reset_at: sql`CASE WHEN ${schema.rate_limits.reset_at} < ${now} THEN ${newResetAt} ELSE ${schema.rate_limits.reset_at} END`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        },
      })
      .returning({ count: schema.rate_limits.count, reset_at: schema.rate_limits.reset_at });

    const row = rows[0];
    const count = row?.count ?? 1;
    const resetAt = row?.reset_at ?? newResetAt;
    return { ok: count <= config.limit, remaining: Math.max(0, config.limit - count), resetAt };
  } catch (error) {
    // Fail open: a rate-limit backend outage must not take down the API.
    console.error('rate-limit check failed, failing open', error);
    return { ok: true, remaining: config.limit, resetAt: now + config.window };
  }
}

/** Rate limit by client IP + path. Public tier: 100 req/min; authenticated: 1000 req/min. */
export async function rateLimitByIp(
  req: Request,
  authenticated: boolean = false
): Promise<{ ok: boolean; headers: Record<string, string> }> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const path = new URL(req.url).pathname;
  const key = `${ip}:${path}`;
  const limit = authenticated ? 1000 : 100;

  const result = await checkRateLimit({ key, limit, window: 60 });

  return {
    ok: result.ok,
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.resetAt),
    },
  };
}
