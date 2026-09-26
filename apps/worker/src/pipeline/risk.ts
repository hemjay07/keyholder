// File: apps/worker/src/pipeline/risk.ts
//
// Risk stage: given a state-stage transition (before, after) for a protocol,
// run @keyholder/risk's evaluateDelta (the existing, tested rule engine —
// standing-rule collapse and all) and insert the resulting risk_deltas rows.
// Idempotent on delta_uid ('protocol:slot:rule', see engine.ts); the DB-level
// NOTIFY trigger (drizzle/20260926181023_risk_delta_notify.sql) fires on
// each real INSERT, which is what the alert stage listens for.

import type { Db } from '../db';
import { risk_deltas } from '../schema';
import { evaluateDelta, type ControlState } from '@keyholder/risk';

export interface RiskStageResult {
  protocolId: string;
  deltasEvaluated: number;
  deltasInserted: number;
}

/**
 * Evaluates every rule against (before, after) and inserts any that fire.
 * `before` is null for a protocol's very first control_state row — passed
 * through to evaluateDelta as EMPTY_CONTROL_STATE-shaped `after`-only
 * comparison would be wrong, so callers should skip calling this stage at
 * all when `before` is null (the state stage's very first write for a
 * protocol has nothing to transition *from*); this function still accepts
 * it and no-ops safely for completeness/testability.
 */
export async function runRiskStage(db: Db, protocolId: string, slot: number, before: ControlState | null, after: ControlState): Promise<RiskStageResult> {
  if (!before) {
    return { protocolId, deltasEvaluated: 0, deltasInserted: 0 };
  }

  const deltas = evaluateDelta(before, after, { protocolId, slot });
  if (deltas.length === 0) {
    return { protocolId, deltasEvaluated: 0, deltasInserted: 0 };
  }

  const inserted = await db
    .insert(risk_deltas)
    .values(
      deltas.map((d) => ({
        delta_uid: d.deltaUid,
        protocol_id: protocolId,
        rule_id: d.ruleId,
        rule_version: d.ruleVersion,
        severity: d.severity,
        explanation: d.explanation,
        facts: d.facts,
        status: d.status,
        correction_id: null,
      }))
    )
    .onConflictDoNothing({ target: risk_deltas.delta_uid })
    .returning({ id: risk_deltas.id });

  return { protocolId, deltasEvaluated: deltas.length, deltasInserted: inserted.length };
}
