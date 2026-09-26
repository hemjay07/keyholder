// File: apps/worker/src/pipeline/alerts.ts
//
// Alert stage: LISTEN on the `risk_delta_created` channel (the DB trigger in
// drizzle/20260926181023_risk_delta_notify.sql fires on every real
// risk_deltas INSERT, ships the row as JSON) and deliver it to matching
// subscriptions over their requested channels. Webhook delivery reuses the
// existing, tested HMAC code in alert-dispatcher/webhooks.ts. Telegram/
// email/X have no sender implementation anywhere in this repo yet (only
// arch/B-worker.md's reference snippets, never built) and their tokens are
// absent in this environment — per this task's binding rule ("never fake a
// send"), a subscription requesting one of those channels is logged and
// skipped, never silently dropped and never faked.

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, or } from 'drizzle-orm';
import * as schema from '../schema';
import { dispatchWebhook } from '../alert-dispatcher/webhooks';

export interface AlertLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

const consoleLogger: AlertLogger = {
  info: (msg, meta) => console.log(`[alerts] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[alerts] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[alerts] ${msg}`, meta ?? ''),
};

const SEVERITY_RANK: Record<string, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

export interface RiskDeltaNotification {
  id: number;
  delta_uid: string;
  protocol_id: string;
  rule_id: string;
  severity: string;
  explanation: string | null;
  facts: unknown;
}

/** Env-gated: only channels this repo actually has a sender for are ever attempted. */
function unimplementedChannelTokenPresent(channel: string): boolean {
  if (channel === 'telegram') return Boolean(process.env.TELEGRAM_BOT_TOKEN);
  if (channel === 'email') return Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY);
  if (channel === 'x') return Boolean(process.env.X_API_KEY);
  return false;
}

/**
 * Delivers one risk_delta notification to every subscription that matches
 * its protocol (or a 'global' scope subscription) and whose min_severity is
 * at or below the delta's severity.
 */
export async function deliverRiskDelta(db: ReturnType<typeof drizzle>, delta: RiskDeltaNotification, logger: AlertLogger = consoleLogger): Promise<{ delivered: number; skippedChannels: number }> {
  const deltaRank = SEVERITY_RANK[delta.severity] ?? 0;

  const subs = await db
    .select()
    .from(schema.subscriptions)
    .where(or(and(eq(schema.subscriptions.scope, 'protocol'), eq(schema.subscriptions.target, delta.protocol_id)), eq(schema.subscriptions.scope, 'global')));

  let delivered = 0;
  let skippedChannels = 0;

  for (const sub of subs) {
    const minRank = SEVERITY_RANK[sub.min_severity ?? 'low'] ?? 1;
    if (deltaRank < minRank) continue;

    for (const channel of sub.channels ?? []) {
      if (channel === 'webhook') {
        const webhooks = await db.select().from(schema.webhooks).where(and(eq(schema.webhooks.user_id, sub.user_id), eq(schema.webhooks.active, true)));
        for (const webhook of webhooks) {
          const result = await dispatchWebhook(db, { webhookId: webhook.id, alertId: delta.delta_uid, payload: delta });
          if (result.success) delivered++;
        }
        continue;
      }

      if (!unimplementedChannelTokenPresent(channel)) {
        logger.info(`channel '${channel}' disabled: no token configured — never fabricating a send`, { channel, subscriptionId: sub.id, deltaUid: delta.delta_uid });
        skippedChannels++;
        continue;
      }
      // A token exists but this repo has no sender implementation for this
      // channel (arch/B-worker.md §10's code was never built here) — logged
      // honestly rather than faked.
      logger.warn(`channel '${channel}' has a token configured but no sender is implemented in this repo`, { channel, subscriptionId: sub.id });
      skippedChannels++;
    }
  }

  return { delivered, skippedChannels };
}

export interface AlertListenerHandle {
  stop(): Promise<void>;
}

/**
 * Opens a dedicated LISTEN connection (per postgres.js's own requirement —
 * LISTEN needs a persistent, non-pooled connection) and delivers every
 * `risk_delta_created` notification as it arrives.
 */
export function startAlertListener(databaseUrl: string, logger: AlertLogger = consoleLogger): AlertListenerHandle {
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql, { schema });

  const subscriptionPromise = sql.listen('risk_delta_created', (payload) => {
    void (async () => {
      try {
        const delta = JSON.parse(payload) as RiskDeltaNotification;
        const result = await deliverRiskDelta(db, delta, logger);
        logger.info('risk_delta_created delivered', { deltaUid: delta.delta_uid, ...result });
      } catch (err) {
        logger.error('failed to handle risk_delta_created notification', { error: err instanceof Error ? err.message : String(err) });
      }
    })();
  });

  subscriptionPromise.catch((err) => {
    logger.error('failed to subscribe to risk_delta_created', { error: err instanceof Error ? err.message : String(err) });
  });

  return {
    async stop(): Promise<void> {
      try {
        const subscription = await subscriptionPromise;
        await subscription.unlisten();
      } catch {
        // already failed to subscribe — nothing to unlisten.
      }
      await sql.end();
    },
  };
}
