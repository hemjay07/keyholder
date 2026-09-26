// File: packages/risk/src/engine.ts
// [TESTED — see engine.test.ts]
//
// ARCHITECTURE.md §8 / BACKEND.md §5.2: evaluate every rule against a
// (before, after) ControlState transition, emit deterministic RiskDeltas
// keyed by `protocol:slot:rule` (delta_uid — matches risk_deltas.delta_uid
// in apps/worker/src/schema.ts so a caller can insert with
// onConflictDoNothing and get idempotency for free), and provide the
// correction path from BACKEND.md §5.4: a delta can be superseded with a
// reason, the original is kept (status flips to 'corrected', never deleted
// or mutated in place).
//
// DEV-042 fix (coordinator review, 2026-09-26): a *standing* rule (e.g.
// `no_timelock`, which only looks at `after`) previously fired on every
// single snapshot where the condition still held, even when nothing
// changed — noisy, and it made "first alert" indistinguishable from "the
// window happened to start here." The fix is generic and applies to every
// rule uniformly, not just the two `standing: true` ones: a rule's own
// result is compared against what it *would* have fired evaluating
// (before, before) — i.e. "was this exact fact already true before this
// event, with identical facts". If so, the repeat is suppressed; a rule
// still fires again the moment its facts actually change (e.g. `no_timelock`
// refires when control moves to a *different* zero-timelock multisig,
// because the `multisig` address in `facts` differs). Genuine
// before-vs-after transition rules (threshold_lowered, admin_changed, ...)
// are unaffected: comparing (before, before) is always null for them by
// construction (they require strict inequality between before and after).

import { RULES, type Rule, type RuleEvalInput, type RuleFireResult } from './rules';
import type { ControlState, RiskDelta, RiskFacts, RuleContext } from './types';

export interface EvaluateOptions {
  /** Restrict evaluation to these rule ids (default: all). Useful for replay/testing one rule in isolation. */
  ruleIds?: string[];
}

function factsKey(facts: RiskFacts): string {
  return JSON.stringify(facts, Object.keys(facts).sort());
}

function isRepeatOfStandingCondition(rule: Rule, before: ControlState, fired: RuleFireResult): boolean {
  const priorFired = rule.evaluate({ before, after: before, event: {} });
  return priorFired !== null && factsKey(priorFired.facts) === factsKey(fired.facts);
}

/**
 * Evaluate every rule against one (before, after) transition. Pure function:
 * same inputs always produce the same output array, in rule-definition
 * order (BACKEND.md §5.2's determinism requirement, which the replay engine
 * and golden test rely on). Repeats of an already-true standing condition
 * (same rule, same facts) are suppressed — see the DEV-042 note above.
 */
export function evaluateDelta(
  before: ControlState,
  after: ControlState,
  ctx: RuleContext,
  event: RiskFacts = {},
  options: EvaluateOptions = {}
): RiskDelta[] {
  const rules: Rule[] = options.ruleIds ? RULES.filter((r) => options.ruleIds!.includes(r.id)) : RULES;
  const deltas: RiskDelta[] = [];

  for (const rule of rules) {
    const input: RuleEvalInput = { before, after, event };
    const fired = rule.evaluate(input);
    if (!fired) continue;
    if (isRepeatOfStandingCondition(rule, before, fired)) continue;
    deltas.push({
      ruleId: rule.id,
      ruleVersion: rule.version,
      severity: fired.severity,
      explanation: fired.explanation,
      facts: fired.facts,
      deltaUid: `${ctx.protocolId}:${ctx.slot}:${rule.id}`,
      status: 'active',
      correctionId: null,
    });
  }

  return deltas;
}

/**
 * BACKEND.md §5.4 correction path: the original delta is returned unchanged
 * except `status: 'corrected'`; a brand-new delta (new deltaUid, suffixed so
 * it never collides with the original) carries the corrected severity and an
 * explanation that includes the reason. Callers persist both rows — the
 * original's permalink and history stay intact (ARCHITECTURE §4's
 * "never mutate old deltas silently").
 */
export function correctDelta(
  original: RiskDelta,
  correction: { newSeverity?: RiskDelta['severity']; reason: string }
): { corrected: RiskDelta; replacement: RiskDelta } {
  const corrected: RiskDelta = { ...original, status: 'corrected' };
  const replacement: RiskDelta = {
    ...original,
    deltaUid: `${original.deltaUid}:correction`,
    severity: correction.newSeverity ?? original.severity,
    explanation: `${original.explanation} [corrected: ${correction.reason}]`,
    status: 'active',
    correctionId: original.deltaUid,
  };
  return { corrected, replacement };
}

export function retractDelta(original: RiskDelta, reason: string): RiskDelta {
  return {
    ...original,
    status: 'retracted',
    explanation: `${original.explanation} [retracted: ${reason}]`,
  };
}

