// File: packages/risk/src/score.ts
// [TESTED — see engine.test.ts]
//
// ARCHITECTURE.md §8 / BACKEND.md §5.2: protocol_scores.score is a base
// score from static control posture (key type, M/N, timelock, verification)
// minus active deltas. PULSE.md's thesis is explicit that a score is never
// the headline — this exists only as a sortable/filterable number behind
// the control facts, which is why it is a small, pure, fully-explained
// function rather than anything opaque.

import type { ControlState, RiskDelta } from './types';

const SEVERITY_PENALTY: Record<RiskDelta['severity'], number> = {
  info: 0,
  low: 2,
  medium: 8,
  high: 20,
  critical: 35,
};

export interface ScoreComponents {
  base: number;
  authorityPenalty: number;
  timelockPenalty: number;
  thresholdPenalty: number;
  verificationPenalty: number;
  activeDeltaPenalty: number;
}

export interface ScoreResult {
  score: number;
  components: ScoreComponents;
}

/**
 * Base score from static control posture, then subtract active
 * (non-corrected, non-retracted) deltas. Deterministic and pure: same state
 * + same deltas -> same score, always.
 */
export function computeScore(state: ControlState, activeDeltas: RiskDelta[]): ScoreResult {
  let authorityPenalty = 0;
  if (state.authorityKind === 'single_key') authorityPenalty = 40;
  else if (state.authorityKind === 'single_key_or_vault_unresolved') authorityPenalty = 20;
  else if (state.authorityKind === 'unknown') authorityPenalty = 25;

  let timelockPenalty = 0;
  if (state.multisig) {
    if (state.multisig.timeLockS === 0) timelockPenalty = 30;
    else if (state.multisig.timeLockS < 3600) timelockPenalty = 15;
  }

  let thresholdPenalty = 0;
  if (state.multisig && state.multisig.memberCount > 0) {
    const ratio = state.multisig.threshold / state.multisig.memberCount;
    if (ratio <= 0.5) thresholdPenalty = 20;
    else if (ratio < 0.6) thresholdPenalty = 10;
  }

  let verificationPenalty = 0;
  if (state.verifiedStatus === 'unverified' || state.verifiedStatus === 'drifted') verificationPenalty = 10;
  else if (state.verifiedStatus === 'unknown') verificationPenalty = 5;

  const active = activeDeltas.filter((d) => d.status === 'active');
  const activeDeltaPenalty = active.reduce((sum, d) => sum + SEVERITY_PENALTY[d.severity], 0);

  const base = 100;
  const score = Math.max(
    0,
    base - authorityPenalty - timelockPenalty - thresholdPenalty - verificationPenalty - activeDeltaPenalty
  );

  return {
    score,
    components: { base, authorityPenalty, timelockPenalty, thresholdPenalty, verificationPenalty, activeDeltaPenalty },
  };
}
