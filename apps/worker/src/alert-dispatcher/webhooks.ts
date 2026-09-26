// File: apps/worker/src/alert-dispatcher/webhooks.ts
// Webhook delivery with HMAC-SHA256 signing and retries (arch/D-web.md's
// webhooks CRUD + Phase 4 SCOPE). Deviation from PLAN.md's Task 4.4 sketch:
// that code signed `X-CP-Signature`; this project's product is Keyholder, so
// the header is `X-Keyholder-Signature` (same `t=<ts>,v1=<hmac>` scheme).
// Retries are scheduled through the existing `jobs` table (apps/worker/src/schema.ts)
// rather than an ad hoc in-process backoff, so a retry survives a worker
// restart.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import { decryptWebhookSecret } from './webhook-secret';

export const SIGNATURE_HEADER = 'X-Keyholder-Signature';

// Exponential backoff schedule per PLAN.md Task 4.4 (3h, 6h, 12h, 24h, 48h).
export const RETRY_SCHEDULE_MS = [3, 6, 12, 24, 48].map((h) => h * 60 * 60 * 1000);

export function signPayload(payload: string, secret: string, timestamp: number): string {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

export function verifySignature(header: string, payload: string, secret: string): boolean {
  const match = header.match(/^t=(\d+),v1=([0-9a-f]+)$/);
  if (!match || !match[1] || !match[2]) return false;
  const [, tsStr, sig] = match;
  const expected = createHmac('sha256', secret).update(`${tsStr}.${payload}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const sigBuf = Buffer.from(sig, 'hex');
  return expectedBuf.length === sigBuf.length && timingSafeEqual(expectedBuf, sigBuf);
}

export interface WebhookDeliveryResult {
  success: boolean;
  status?: number;
  error?: string;
}

/** Delivers one webhook POST with an HMAC signature header. Does not retry itself — see scheduleRetry. */
export async function deliverWebhook(url: string, payload: unknown, secret: string): Promise<WebhookDeliveryResult> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(body, secret, timestamp);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [SIGNATURE_HEADER]: signature },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status >= 200 && response.status < 300) {
      return { success: true, status: response.status };
    }
    return { success: false, status: response.status, error: `HTTP ${response.status}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Delivers a webhook by id, decrypting its stored secret, and records the
 * outcome as a `deliveries` row. On failure, enqueues a retry job in `jobs`
 * at the next backoff step (RETRY_SCHEDULE_MS[attempt]); after the schedule
 * is exhausted, marks the webhook inactive.
 */
export async function dispatchWebhook(
  db: ReturnType<typeof drizzle>,
  params: { webhookId: string; alertId: string; payload: unknown; attempt?: number }
): Promise<WebhookDeliveryResult> {
  const attempt = params.attempt ?? 0;
  const [webhook] = await db.select().from(schema.webhooks).where(eq(schema.webhooks.id, params.webhookId));
  if (!webhook || !webhook.active || !webhook.secret_enc) {
    return { success: false, error: 'webhook not found or inactive' };
  }

  const secret = decryptWebhookSecret(Buffer.from(webhook.secret_enc));
  const result = await deliverWebhook(webhook.url, params.payload, secret);

  await db.insert(schema.deliveries).values({
    alert_id: params.alertId,
    channel: 'webhook',
    status: result.success ? 'delivered' : 'failed',
    attempts: attempt + 1,
    last_error: result.error ?? null,
    delivered_at: result.success ? new Date() : null,
  });

  if (!result.success) {
    const delay = RETRY_SCHEDULE_MS[attempt];
    if (delay != null) {
      await db.insert(schema.jobs).values({
        queue: 'webhook_retry',
        task_id: `${params.webhookId}:${params.alertId}:${attempt + 1}`,
        payload: { webhookId: params.webhookId, alertId: params.alertId, payload: params.payload, attempt: attempt + 1 },
        run_at: new Date(Date.now() + delay),
      });
    } else {
      await db
        .update(schema.webhooks)
        .set({ active: false, failure_count: (webhook.failure_count ?? 0) + 1 })
        .where(eq(schema.webhooks.id, params.webhookId));
    }
  }

  return result;
}

/** Standalone Postgres connection for scripts/tests that don't already hold a Db instance. */
export function connectDb(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 1 });
  return drizzle(sql, { schema });
}
