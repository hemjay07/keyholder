// File: apps/worker/src/pipeline/alerts.test.ts
// DB-touching tests against the real `_test` Postgres. `dispatchWebhook`
// itself does a real HTTP POST (already covered by webhooks.test.ts's HMAC
// unit tests) — mocked here so this test only exercises subscription
// matching / severity filtering / the "no fake sends" guard.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import * as schema from '../schema';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

vi.mock('../alert-dispatcher/webhooks', () => ({ dispatchWebhook: vi.fn() }));

import { dispatchWebhook } from '../alert-dispatcher/webhooks';
import { deliverRiskDelta, type RiskDeltaNotification } from './alerts';
import { testDatabaseUrl } from '../test-db';

const databaseUrl = testDatabaseUrl();
const mockDispatch = dispatchWebhook as unknown as ReturnType<typeof vi.fn>;
const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe.skipIf(!databaseUrl)('deliverRiskDelta (real local Postgres, _test db)', () => {
  let sql: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;
  const userId = 'alerts-test-user';
  const protocolId = 'alerts-test-protocol';
  const subId = 'alerts-test-sub';
  const webhookId = 'alerts-test-webhook';

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 1 });
    db = drizzle(sql, { schema });
    await db.insert(schema.subscriptions).values({
      id: subId,
      user_id: userId,
      scope: 'protocol',
      target: protocolId,
      min_severity: 'medium',
      channels: ['webhook', 'telegram'],
    });
    await db.insert(schema.webhooks).values({ id: webhookId, user_id: userId, url: 'https://example.com/hook', active: true });
  });

  afterAll(async () => {
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, subId));
    await db.delete(schema.webhooks).where(eq(schema.webhooks.id, webhookId));
    await sql.end();
  });

  it('happy: a matching protocol subscription above min_severity delivers to its active webhook', async () => {
    mockDispatch.mockResolvedValueOnce({ success: true, status: 200 });
    const delta: RiskDeltaNotification = { id: 1, delta_uid: 'x:1:rule', protocol_id: protocolId, rule_id: 'threshold_lowered', severity: 'high', explanation: 'e', facts: {} };

    const result = await deliverRiskDelta(db as any, delta, silentLogger);
    expect(result.delivered).toBe(1);
    expect(mockDispatch).toHaveBeenCalledWith(db, { webhookId, alertId: delta.delta_uid, payload: delta });
  });

  it('edge: a delta below the subscription min_severity is not delivered', async () => {
    const delta: RiskDeltaNotification = { id: 2, delta_uid: 'x:2:rule', protocol_id: protocolId, rule_id: 'no_timelock', severity: 'low', explanation: 'e', facts: {} };
    const result = await deliverRiskDelta(db as any, delta, silentLogger);
    expect(result.delivered).toBe(0);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('edge: a channel with no token and no sender is skipped, never faked', async () => {
    mockDispatch.mockResolvedValueOnce({ success: true, status: 200 });
    const delta: RiskDeltaNotification = { id: 3, delta_uid: 'x:3:rule', protocol_id: protocolId, rule_id: 'threshold_lowered', severity: 'critical', explanation: 'e', facts: {} };
    const result = await deliverRiskDelta(db as any, delta, silentLogger);
    expect(result.skippedChannels).toBe(1); // 'telegram', no TELEGRAM_BOT_TOKEN
    expect(silentLogger.info).toHaveBeenCalledWith(expect.stringContaining("channel 'telegram' disabled"), expect.anything());
  });

  it('error: an unrelated protocol_id matches nothing and delivers nothing', async () => {
    const delta: RiskDeltaNotification = { id: 4, delta_uid: 'x:4:rule', protocol_id: 'some-other-protocol', rule_id: 'threshold_lowered', severity: 'critical', explanation: 'e', facts: {} };
    const result = await deliverRiskDelta(db as any, delta, silentLogger);
    expect(result.delivered).toBe(0);
  });
});
