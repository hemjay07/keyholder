// File: apps/worker/src/replay/store.ts
// [TESTED — see store.test.ts, real local Postgres, skipped when
// DATABASE_URL is unreachable, same pattern as ../schema.test.ts]
//
// Persists a `ReplayResult` (drift-replay.ts) into `replay_runs` and
// `replay_alerts` (apps/worker/src/schema.ts), matching
// ARCHITECTURE.md §4's shapes: replay_runs carries the measured
// first_alert_slot/lead_time_seconds (never a hardcoded number — see
// drift-replay.ts), replay_alerts carries one row per fired RiskDelta,
// mirroring risk_deltas' columns.
//
// DEV-043 (coordinator review, 2026-09-26): `first_alert_slot`/
// `lead_time_seconds` are redefined to describe the FIRST TRANSITION ALERT
// (result.firstTransitionAlert), not any standing condition; the standing
// posture at window start (result.postureAtWindowStart) is stored
// separately in the new `posture` jsonb column so both numbers survive —
// see schema.ts's column comments.

import { randomUUID } from 'node:crypto';
import type { Db } from '../db';
import { replay_runs, replay_alerts } from '../schema';
import type { ReplayResult } from './drift-replay';

export interface StoreReplayOptions {
  runId?: string;
  incident?: string;
}

export async function storeReplayRun(db: Db, result: ReplayResult, opts: StoreReplayOptions = {}): Promise<string> {
  const runId = opts.runId ?? randomUUID();
  const slots = result.frames.map((f) => f.slot);
  const fromSlot = Math.min(...slots);
  const toSlot = Math.max(...slots);

  const eventSequence = JSON.stringify(
    result.frames.filter((f) => !f.isGapFrame).map((f) => ({ step: f.step, slot: f.slot, signature: f.signature }))
  );

  await db.insert(replay_runs).values({
    id: runId,
    incident: opts.incident ?? 'drift-2026-03-01_04-03',
    from_slot: fromSlot,
    to_slot: toSlot,
    rules_version: result.rulesVersion,
    first_alert_slot: result.firstTransitionAlert?.frame.slot ?? null,
    lead_time_seconds: result.leadTimeSeconds,
    posture: result.postureAtWindowStart,
    event_sequence: eventSequence,
  });

  const alertRows = result.frames.flatMap((frame) =>
    frame.deltasFired.map((delta) => ({
      run_id: runId,
      slot: frame.slot,
      severity: delta.severity,
      rule_id: delta.ruleId,
      explanation: delta.explanation,
      facts: delta.facts,
    }))
  );

  if (alertRows.length > 0) {
    await db.insert(replay_alerts).values(alertRows);
  }

  return runId;
}
