// File: apps/worker/src/replay/store.test.ts
// Task 3.3 — store.ts round-trip against a real local Postgres (see
// schema.test.ts's pattern: skipped, not failed, when DATABASE_URL is
// unreachable). Uses the real Drift replay result (drift-replay.ts).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import * as schema from '../schema';
import { storeReplayRun } from './store';
import { replayDriftIncident } from './drift-replay';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

const databaseUrl = process.env.DATABASE_URL;
const TEST_RUN_ID = 'drift-2026-replay-test-1';

describe.skipIf(!databaseUrl)('storeReplayRun (real local Postgres)', () => {
  let sql: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 1 });
    db = drizzle(sql, { schema });
    await db.delete(schema.replay_alerts).where(eq(schema.replay_alerts.run_id, TEST_RUN_ID));
    await db.delete(schema.replay_runs).where(eq(schema.replay_runs.id, TEST_RUN_ID));
  });

  afterAll(async () => {
    await db.delete(schema.replay_alerts).where(eq(schema.replay_alerts.run_id, TEST_RUN_ID));
    await db.delete(schema.replay_runs).where(eq(schema.replay_runs.id, TEST_RUN_ID));
    await sql.end();
  });

  it('happy: writes one replay_runs row with a measured lead_time_seconds, and one replay_alerts row per fired delta', async () => {
    const result = replayDriftIncident();
    const runId = await storeReplayRun(db, result, { runId: TEST_RUN_ID });
    expect(runId).toBe(TEST_RUN_ID);

    const runs = await db.select().from(schema.replay_runs).where(eq(schema.replay_runs.id, TEST_RUN_ID));
    expect(runs).toHaveLength(1);
    expect(runs[0]?.lead_time_seconds).toBe(result.leadTimeSeconds);
    expect(runs[0]?.first_alert_slot).toBe(result.firstTransitionAlert!.frame.slot);
    expect(runs[0]?.rules_version).toBe(1);
    expect(runs[0]?.posture).toEqual(result.postureAtWindowStart);

    const alerts = await db.select().from(schema.replay_alerts).where(eq(schema.replay_alerts.run_id, TEST_RUN_ID));
    const expectedAlertCount = result.frames.reduce((sum, f) => sum + f.deltasFired.length, 0);
    expect(alerts.length).toBe(expectedAlertCount);
    expect(alerts.some((a) => a.rule_id === 'admin_changed')).toBe(true);
  });

  it('edge: a replay result with zero deltas writes the run row but no alert rows', async () => {
    const runId = `${TEST_RUN_ID}-empty`;
    await db.delete(schema.replay_runs).where(eq(schema.replay_runs.id, runId));
    const result = replayDriftIncident();
    const empty = {
      ...result,
      frames: result.frames.map((f) => ({ ...f, deltasFired: [] })),
      firstTransitionAlert: null,
      postureAtWindowStart: [],
      leadTimeSeconds: null,
    };
    await storeReplayRun(db, empty, { runId });

    const alerts = await db.select().from(schema.replay_alerts).where(eq(schema.replay_alerts.run_id, runId));
    expect(alerts).toHaveLength(0);
    const runs = await db.select().from(schema.replay_runs).where(eq(schema.replay_runs.id, runId));
    expect(runs[0]?.lead_time_seconds).toBeNull();

    await db.delete(schema.replay_runs).where(eq(schema.replay_runs.id, runId));
  });

  it('error: inserting the same run id twice throws (primary key uniqueness), not silently overwritten', async () => {
    const runId = `${TEST_RUN_ID}-dup`;
    await db.delete(schema.replay_alerts).where(eq(schema.replay_alerts.run_id, runId));
    await db.delete(schema.replay_runs).where(eq(schema.replay_runs.id, runId));
    const result = replayDriftIncident();
    await storeReplayRun(db, result, { runId });
    await expect(storeReplayRun(db, result, { runId })).rejects.toThrow();
    await db.delete(schema.replay_alerts).where(eq(schema.replay_alerts.run_id, runId));
    await db.delete(schema.replay_runs).where(eq(schema.replay_runs.id, runId));
  });
});
