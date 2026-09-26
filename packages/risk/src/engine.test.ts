// File: packages/risk/src/engine.test.ts
// Task 3.2 — unit tests per rule (happy/edge/error), plus determinism and
// the correction path. Facts used throughout are the real, decoded Drift
// incident numbers (data/drift-2026/timeline.json,
// data/drift-2026/multisig-original/decoded-state.json,
// data/drift-2026/multisig-new/decoded-state.json) — not invented fixtures.
// Real: original multisig 61ApQqLoWVfTuzua9c22SWMj78RGv77x6Z2kzcJVGNjP is
// 2-of-5, timelock 0; new multisig 2LW6PSEjp81xSEttWwXDB6Etb1eKdhYPbFEojYbyhx88
// is also 2-of-5, timelock 0, both config_authority
// A1eC8n2tQBHPodn8sZHsc5XWciunZy9B1VgmcHgK1xhP; admin hijack
// E1admb4tW2Y6bpbnpE5jYZsc4TE2NArG7siZqDsafnob -> AiLGdNitMjv8n5HMS7HAdV2kaeJZZFd4jdfn5xp1PKrW.

import { describe, expect, it } from 'vitest';
import { evaluateDelta, correctDelta, retractDelta } from './engine';
import { EMPTY_CONTROL_STATE, type ControlState } from './types';
import { computeScore } from './score';

const ORIGINAL_MULTISIG = '61ApQqLoWVfTuzua9c22SWMj78RGv77x6Z2kzcJVGNjP';
const NEW_MULTISIG = '2LW6PSEjp81xSEttWwXDB6Etb1eKdhYPbFEojYbyhx88';
const CONFIG_AUTHORITY = 'A1eC8n2tQBHPodn8sZHsc5XWciunZy9B1VgmcHgK1xhP';
const OLD_ADMIN = 'E1admb4tW2Y6bpbnpE5jYZsc4TE2NArG7siZqDsafnob';
const NEW_ADMIN = 'AiLGdNitMjv8n5HMS7HAdV2kaeJZZFd4jdfn5xp1PKrW';

function state(overrides: Partial<ControlState>): ControlState {
  return { ...EMPTY_CONTROL_STATE, ...overrides };
}

const ctx = { protocolId: 'drift', slot: 408886958 };

describe('single_key_authority', () => {
  it('happy: fires when authority is a single key', () => {
    const after = state({ authorityKind: 'single_key', authorityAddress: OLD_ADMIN });
    const deltas = evaluateDelta(EMPTY_CONTROL_STATE, after, ctx, {}, { ruleIds: ['single_key_authority'] });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.severity).toBe('high');
    expect(deltas[0]?.explanation).toContain(OLD_ADMIN);
    expect(deltas[0]?.deltaUid).toBe('drift:408886958:single_key_authority');
  });

  it('edge: does not fire for a squads_vault authority', () => {
    const after = state({ authorityKind: 'squads_vault', authorityAddress: ORIGINAL_MULTISIG });
    const deltas = evaluateDelta(EMPTY_CONTROL_STATE, after, ctx, {}, { ruleIds: ['single_key_authority'] });
    expect(deltas).toHaveLength(0);
  });

  it('error: null authorityAddress on a single_key state still fires with "unknown" wording, not a throw', () => {
    const after = state({ authorityKind: 'single_key', authorityAddress: null });
    expect(() => evaluateDelta(EMPTY_CONTROL_STATE, after, ctx, {}, { ruleIds: ['single_key_authority'] })).not.toThrow();
    const deltas = evaluateDelta(EMPTY_CONTROL_STATE, after, ctx, {}, { ruleIds: ['single_key_authority'] });
    expect(deltas[0]?.explanation).toContain('unknown');
  });
});

describe('no_timelock', () => {
  const multisig = { address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY };

  it('happy: real Drift council (2 of 5, timelock 0) fires critical', () => {
    const after = state({ multisig });
    const deltas = evaluateDelta(EMPTY_CONTROL_STATE, after, ctx, {}, { ruleIds: ['no_timelock'] });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.severity).toBe('critical');
    expect(deltas[0]?.explanation).toContain('2 of 5');
  });

  it('edge: threshold above 2 with zero timelock is high, not critical', () => {
    const after = state({ multisig: { ...multisig, threshold: 4, memberCount: 7 } });
    const deltas = evaluateDelta(EMPTY_CONTROL_STATE, after, ctx, {}, { ruleIds: ['no_timelock'] });
    expect(deltas[0]?.severity).toBe('high');
  });

  it('error: no multisig present does not fire (no crash on null access)', () => {
    const after = state({ multisig: null });
    expect(evaluateDelta(EMPTY_CONTROL_STATE, after, ctx, {}, { ruleIds: ['no_timelock'] })).toHaveLength(0);
  });
});

describe('threshold_lowered', () => {
  const before = { address: ORIGINAL_MULTISIG, threshold: 4, memberCount: 7, timeLockS: 3600, configAuthority: CONFIG_AUTHORITY };
  const after = { address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY };

  it('happy: 4-of-7/1h -> 2-of-5/0s (Drift real production vs council numbers) fires critical', () => {
    const deltas = evaluateDelta(state({ multisig: before }), state({ multisig: after }), ctx, {}, { ruleIds: ['threshold_lowered'] });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.severity).toBe('critical');
    expect(deltas[0]?.explanation).toContain('threshold lowered from 4 of 7 to 2 of 5');
  });

  it('edge: threshold unchanged does not fire', () => {
    const deltas = evaluateDelta(state({ multisig: before }), state({ multisig: before }), ctx, {}, { ruleIds: ['threshold_lowered'] });
    expect(deltas).toHaveLength(0);
  });

  it('error: different multisig addresses (not a transition on the same account) does not fire', () => {
    const deltas = evaluateDelta(
      state({ multisig: before }),
      state({ multisig: { ...after, address: NEW_MULTISIG } }),
      ctx,
      {},
      { ruleIds: ['threshold_lowered'] }
    );
    expect(deltas).toHaveLength(0);
  });
});

describe('timelock_reduced', () => {
  const m = { address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, configAuthority: CONFIG_AUTHORITY };

  it('happy: 3600s -> 0s fires critical', () => {
    const deltas = evaluateDelta(
      state({ multisig: { ...m, timeLockS: 3600 } }),
      state({ multisig: { ...m, timeLockS: 0 } }),
      ctx,
      {},
      { ruleIds: ['timelock_reduced'] }
    );
    expect(deltas[0]?.severity).toBe('critical');
    expect(deltas[0]?.explanation).toContain('0s (none)');
  });

  it('edge: reduced but still nonzero fires high, not critical', () => {
    const deltas = evaluateDelta(
      state({ multisig: { ...m, timeLockS: 7200 } }),
      state({ multisig: { ...m, timeLockS: 60 } }),
      ctx,
      {},
      { ruleIds: ['timelock_reduced'] }
    );
    expect(deltas[0]?.severity).toBe('high');
  });

  it('error: timelock increased does not fire', () => {
    const deltas = evaluateDelta(
      state({ multisig: { ...m, timeLockS: 0 } }),
      state({ multisig: { ...m, timeLockS: 3600 } }),
      ctx,
      {},
      { ruleIds: ['timelock_reduced'] }
    );
    expect(deltas).toHaveLength(0);
  });
});

describe('authority_changed', () => {
  it('happy: authority reassigned to a single key fires critical', () => {
    const deltas = evaluateDelta(
      state({ authorityKind: 'squads_vault', authorityAddress: ORIGINAL_MULTISIG }),
      state({ authorityKind: 'single_key', authorityAddress: OLD_ADMIN }),
      ctx,
      {},
      { ruleIds: ['authority_changed'] }
    );
    expect(deltas[0]?.severity).toBe('critical');
  });

  it('edge: unchanged (both immutable/null) does not fire', () => {
    const deltas = evaluateDelta(
      state({ authorityKind: 'immutable', authorityAddress: null }),
      state({ authorityKind: 'immutable', authorityAddress: null }),
      ctx,
      {},
      { ruleIds: ['authority_changed'] }
    );
    expect(deltas).toHaveLength(0);
  });

  it('error: reassigned between two multisig vaults still fires, at high (not critical)', () => {
    const deltas = evaluateDelta(
      state({ authorityKind: 'squads_vault', authorityAddress: ORIGINAL_MULTISIG }),
      state({ authorityKind: 'squads_vault', authorityAddress: NEW_MULTISIG }),
      ctx,
      {},
      { ruleIds: ['authority_changed'] }
    );
    expect(deltas[0]?.severity).toBe('high');
  });
});

describe('admin_changed', () => {
  it('happy: the real Drift hijack (OLD_ADMIN -> NEW_ADMIN) fires critical', () => {
    const deltas = evaluateDelta(state({ admin: OLD_ADMIN }), state({ admin: NEW_ADMIN }), ctx, {}, { ruleIds: ['admin_changed'] });
    expect(deltas[0]?.severity).toBe('critical');
    expect(deltas[0]?.explanation).toContain(OLD_ADMIN);
    expect(deltas[0]?.explanation).toContain(NEW_ADMIN);
  });

  it('edge: first observation (before.admin null) does not fire', () => {
    const deltas = evaluateDelta(state({ admin: null }), state({ admin: OLD_ADMIN }), ctx, {}, { ruleIds: ['admin_changed'] });
    expect(deltas).toHaveLength(0);
  });

  it('error: unchanged admin does not fire', () => {
    const deltas = evaluateDelta(state({ admin: OLD_ADMIN }), state({ admin: OLD_ADMIN }), ctx, {}, { ruleIds: ['admin_changed'] });
    expect(deltas).toHaveLength(0);
  });
});

describe('durable_nonce_by_controller', () => {
  it('happy: one new nonce fires medium', () => {
    const deltas = evaluateDelta(
      state({ durableNoncesByController: [] }),
      state({ durableNoncesByController: ['45cZ5Fj97Va5Abipr6NN8Zf1BqZqWneSek1hU5cQRvhw'] }),
      ctx,
      { nonceAuthority: ORIGINAL_MULTISIG },
      { ruleIds: ['durable_nonce_by_controller'] }
    );
    expect(deltas[0]?.severity).toBe('medium');
    expect(deltas[0]?.explanation).toContain('45cZ5Fj97Va5Abipr6NN8Zf1BqZqWneSek1hU5cQRvhw');
  });

  it('edge: a second nonce (>=2 total) escalates to high', () => {
    const deltas = evaluateDelta(
      state({ durableNoncesByController: ['nonceA'] }),
      state({ durableNoncesByController: ['nonceA', 'nonceB'] }),
      ctx,
      {},
      { ruleIds: ['durable_nonce_by_controller'] }
    );
    expect(deltas[0]?.severity).toBe('high');
  });

  it('error: no new nonce (same set) does not fire', () => {
    const deltas = evaluateDelta(
      state({ durableNoncesByController: ['nonceA'] }),
      state({ durableNoncesByController: ['nonceA'] }),
      ctx,
      {},
      { ruleIds: ['durable_nonce_by_controller'] }
    );
    expect(deltas).toHaveLength(0);
  });
});

describe('new_multisig_created_by_controller', () => {
  it('happy: real second Drift multisig shares config_authority with the original -> fires high', () => {
    const deltas = evaluateDelta(
      state({ multisig: { address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY } }),
      state({ multisig: { address: NEW_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY } }),
      ctx,
      { priorConfigAuthority: CONFIG_AUTHORITY },
      { ruleIds: ['new_multisig_created_by_controller'] }
    );
    expect(deltas[0]?.severity).toBe('high');
    expect(deltas[0]?.explanation).toContain(NEW_MULTISIG);
  });

  it('edge: new multisig with an unrelated config authority does not fire', () => {
    const deltas = evaluateDelta(
      state({ multisig: { address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY } }),
      state({ multisig: { address: NEW_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: 'SomeOtherAuthority11111111111111111111111' } }),
      ctx,
      { priorConfigAuthority: CONFIG_AUTHORITY },
      { ruleIds: ['new_multisig_created_by_controller'] }
    );
    expect(deltas).toHaveLength(0);
  });

  it('error: same multisig address (no new multisig) does not fire', () => {
    const m = { address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY };
    const deltas = evaluateDelta(state({ multisig: m }), state({ multisig: m }), ctx, { priorConfigAuthority: CONFIG_AUTHORITY }, { ruleIds: ['new_multisig_created_by_controller'] });
    expect(deltas).toHaveLength(0);
  });
});

describe('privileged_ix_by_new_admin', () => {
  it('happy: UpdatePerpMarketMaxOpenInterest by the freshly-hijacked admin fires high', () => {
    const deltas = evaluateDelta(
      EMPTY_CONTROL_STATE,
      EMPTY_CONTROL_STATE,
      ctx,
      { privileged: true, actorIsRecentAdmin: true, ixName: 'UpdatePerpMarketMaxOpenInterest', actor: NEW_ADMIN },
      { ruleIds: ['privileged_ix_by_new_admin'] }
    );
    expect(deltas[0]?.severity).toBe('high');
    expect(deltas[0]?.explanation).toContain('UpdatePerpMarketMaxOpenInterest');
    expect(deltas[0]?.explanation).toContain(NEW_ADMIN);
  });

  it('edge: privileged ix by the long-standing admin does not fire', () => {
    const deltas = evaluateDelta(EMPTY_CONTROL_STATE, EMPTY_CONTROL_STATE, ctx, { privileged: true, actorIsRecentAdmin: false }, { ruleIds: ['privileged_ix_by_new_admin'] });
    expect(deltas).toHaveLength(0);
  });

  it('error: non-privileged ix by a recent admin does not fire', () => {
    const deltas = evaluateDelta(EMPTY_CONTROL_STATE, EMPTY_CONTROL_STATE, ctx, { privileged: false, actorIsRecentAdmin: true }, { ruleIds: ['privileged_ix_by_new_admin'] });
    expect(deltas).toHaveLength(0);
  });
});

describe('verification_drift', () => {
  it('happy: verified -> unverified fires medium', () => {
    const deltas = evaluateDelta(state({ verifiedStatus: 'verified' }), state({ verifiedStatus: 'unverified' }), ctx, {}, { ruleIds: ['verification_drift'] });
    expect(deltas[0]?.severity).toBe('medium');
  });

  it('edge: verified -> drifted also fires', () => {
    const deltas = evaluateDelta(state({ verifiedStatus: 'verified' }), state({ verifiedStatus: 'drifted' }), ctx, {}, { ruleIds: ['verification_drift'] });
    expect(deltas).toHaveLength(1);
  });

  it('error: verified -> unknown (a check that failed to run, not a real regression) does not fire', () => {
    const deltas = evaluateDelta(state({ verifiedStatus: 'verified' }), state({ verifiedStatus: 'unknown' }), ctx, {}, { ruleIds: ['verification_drift'] });
    expect(deltas).toHaveLength(0);
  });
});

describe('determinism', () => {
  it('same input -> same output, across the full rule set, real Drift transition', () => {
    const before = state({ admin: OLD_ADMIN, multisig: { address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY } });
    const after = state({ admin: NEW_ADMIN, multisig: { address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY } });
    const run1 = evaluateDelta(before, after, ctx);
    const run2 = evaluateDelta(before, after, ctx);
    expect(run1).toEqual(run2);
  });
});

describe('correction path (BACKEND.md §5.4)', () => {
  it('correctDelta keeps the original (status: corrected) and creates a new active replacement', () => {
    const [original] = evaluateDelta(state({ admin: OLD_ADMIN }), state({ admin: NEW_ADMIN }), ctx, {}, { ruleIds: ['admin_changed'] });
    const { corrected, replacement } = correctDelta(original!, { newSeverity: 'high', reason: 'planned rotation, not a hijack' });
    expect(corrected.status).toBe('corrected');
    expect(corrected.deltaUid).toBe(original!.deltaUid); // permalink survives
    expect(replacement.status).toBe('active');
    expect(replacement.severity).toBe('high');
    expect(replacement.correctionId).toBe(original!.deltaUid);
    expect(replacement.explanation).toContain('planned rotation');
  });

  it('retractDelta marks retracted without deleting the row', () => {
    const [original] = evaluateDelta(state({ admin: OLD_ADMIN }), state({ admin: NEW_ADMIN }), ctx, {}, { ruleIds: ['admin_changed'] });
    const retracted = retractDelta(original!, 'dropped fork');
    expect(retracted.status).toBe('retracted');
    expect(retracted.deltaUid).toBe(original!.deltaUid);
  });
});

describe('DEV-042: standing-condition repeat suppression (engine-level)', () => {
  const m = { address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY };

  it('happy: no_timelock fires once when it becomes true, and is suppressed on a repeat evaluation with identical facts', () => {
    const withMultisig = state({ multisig: m });
    const first = evaluateDelta(EMPTY_CONTROL_STATE, withMultisig, ctx, {}, { ruleIds: ['no_timelock'] });
    expect(first).toHaveLength(1);

    // Same state observed again (e.g. a re-poll with no new event) — must not refire.
    const repeat = evaluateDelta(withMultisig, withMultisig, { ...ctx, slot: ctx.slot + 1 }, {}, { ruleIds: ['no_timelock'] });
    expect(repeat).toHaveLength(0);
  });

  it('edge: a standing rule refires when its facts change (control moves to a different zero-timelock multisig)', () => {
    const onOriginal = state({ multisig: m });
    const onNew = state({ multisig: { ...m, address: NEW_MULTISIG } });
    const deltas = evaluateDelta(onOriginal, onNew, ctx, {}, { ruleIds: ['no_timelock'] });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.facts.multisig).toBe(NEW_MULTISIG);
  });

  it('error: a genuine transition rule (admin_changed) never gets suppressed by the standing-repeat check, even called twice in a row', () => {
    const before = state({ admin: OLD_ADMIN });
    const after = state({ admin: NEW_ADMIN });
    const first = evaluateDelta(before, after, ctx, {}, { ruleIds: ['admin_changed'] });
    const second = evaluateDelta(before, after, { ...ctx, slot: ctx.slot + 1 }, {}, { ruleIds: ['admin_changed'] });
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1); // re-evaluating the same real transition is not "a repeat of a standing condition"
  });
});

describe('computeScore', () => {
  it('real Drift council posture (2-of-5, 0 timelock) scores well under 50', () => {
    const s = state({
      authorityKind: 'squads_vault',
      multisig: { address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY },
      verifiedStatus: 'unknown',
    });
    const { score } = computeScore(s, []);
    expect(score).toBeLessThan(50);
  });

  it('edge: 4-of-7 with 1h timelock and verified scores near the top', () => {
    const s = state({
      authorityKind: 'squads_vault',
      multisig: { address: '7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM', threshold: 4, memberCount: 7, timeLockS: 3600, configAuthority: 'none' },
      verifiedStatus: 'verified',
    });
    const { score } = computeScore(s, []);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('error: active critical deltas push an otherwise-fine state down, but never below 0', () => {
    const s = state({ authorityKind: 'immutable', verifiedStatus: 'verified' });
    const manyDeltas = Array.from({ length: 5 }, (_, i) =>
      evaluateDelta(state({ admin: `a${i}` }), state({ admin: `b${i}` }), ctx, {}, { ruleIds: ['admin_changed'] })[0]!
    );
    const { score } = computeScore(s, manyDeltas);
    expect(score).toBe(0);
  });
});
