// File: apps/worker/src/pipeline/risk.test.ts
// DB-touching tests against the real `_test` Postgres (see decode.test.ts's
// header for the pattern). Uses real risk-relevant ControlState transitions
// (threshold lowered on a real-shaped 4-of-7 Squads multisig) rather than
// synthetic rule names, so this exercises the actual @keyholder/risk rules.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import * as schema from '../schema';
import { EMPTY_CONTROL_STATE, type ControlState } from '@keyholder/risk';
import { runRiskStage } from './risk';
import { testDatabaseUrl } from '../test-db';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

const databaseUrl = testDatabaseUrl();
const MULTISIG = 'DyJmzHXG9NuLm623k11111111111111111111111111';

describe.skipIf(!databaseUrl)('runRiskStage (real local Postgres, _test db)', () => {
  let sql: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  const protocolId = 'risk-stage-test-proto';

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 1 });
    db = drizzle(sql, { schema });
  });

  afterAll(async () => {
    await db.delete(schema.risk_deltas).where(eq(schema.risk_deltas.protocol_id, protocolId));
    await sql.end();
  });

  it('happy: a real threshold-lowering transition inserts a threshold_lowered risk_deltas row', async () => {
    const before: ControlState = {
      ...EMPTY_CONTROL_STATE,
      multisig: { address: MULTISIG, threshold: 4, memberCount: 7, timeLockS: 3600, configAuthority: null },
      asOfSlot: 100,
    };
    const after: ControlState = {
      ...EMPTY_CONTROL_STATE,
      multisig: { address: MULTISIG, threshold: 2, memberCount: 7, timeLockS: 3600, configAuthority: null },
      asOfSlot: 200,
    };

    const result = await runRiskStage(db, protocolId, 200, before, after);
    expect(result.deltasInserted).toBeGreaterThanOrEqual(1);

    const rows = await db.select().from(schema.risk_deltas).where(eq(schema.risk_deltas.protocol_id, protocolId));
    expect(rows.some((r) => r.rule_id === 'threshold_lowered')).toBe(true);
    expect(rows.some((r) => r.delta_uid === `${protocolId}:200:threshold_lowered`)).toBe(true);
  });

  it('happy: is idempotent — re-running the same transition does not duplicate rows', async () => {
    const before: ControlState = {
      ...EMPTY_CONTROL_STATE,
      multisig: { address: MULTISIG, threshold: 4, memberCount: 7, timeLockS: 3600, configAuthority: null },
      asOfSlot: 100,
    };
    const after: ControlState = {
      ...EMPTY_CONTROL_STATE,
      multisig: { address: MULTISIG, threshold: 2, memberCount: 7, timeLockS: 3600, configAuthority: null },
      asOfSlot: 200,
    };
    await runRiskStage(db, protocolId, 200, before, after);

    const rows = await db.select().from(schema.risk_deltas).where(eq(schema.risk_deltas.protocol_id, protocolId));
    const thresholdRows = rows.filter((r) => r.rule_id === 'threshold_lowered' && r.delta_uid === `${protocolId}:200:threshold_lowered`);
    expect(thresholdRows).toHaveLength(1);
  });

  it('edge: a no-op transition (identical before/after) evaluates rules but inserts nothing', async () => {
    const state: ControlState = { ...EMPTY_CONTROL_STATE, asOfSlot: 300 };
    const result = await runRiskStage(db, protocolId, 300, state, state);
    expect(result.deltasInserted).toBe(0);
  });

  it('error: a null `before` (first-ever state for a protocol) is a safe no-op, never throws', async () => {
    const after: ControlState = { ...EMPTY_CONTROL_STATE, asOfSlot: 1 };
    const result = await runRiskStage(db, protocolId, 1, null, after);
    expect(result).toEqual({ protocolId, deltasEvaluated: 0, deltasInserted: 0 });
  });
});
