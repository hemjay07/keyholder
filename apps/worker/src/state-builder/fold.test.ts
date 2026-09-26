// File: apps/worker/src/state-builder/fold.test.ts
// Task 3.1 — fold.ts unit tests, built from real Drift incident facts in
// data/drift-2026/timeline.json and the two decoded-state.json snapshots
// (multisig-original: 61ApQqLo..., 2-of-5, timelock 0; multisig-new:
// 2LW6PSEj..., 2-of-5, timelock 0, both config_authority A1eC8n2t...), and
// the real admin hijack addresses (E1admb4t... -> AiLGdNit...).

import { describe, it, expect } from 'vitest';
import { foldEvents, hashState, type FoldableEvent } from './fold';
import { EMPTY_CONTROL_STATE } from '@keyholder/risk';

const ORIGINAL_MULTISIG = '61ApQqLoWVfTuzua9c22SWMj78RGv77x6Z2kzcJVGNjP';
const NEW_MULTISIG = '2LW6PSEjp81xSEttWwXDB6Etb1eKdhYPbFEojYbyhx88';
const CONFIG_AUTHORITY = 'A1eC8n2tQBHPodn8sZHsc5XWciunZy9B1VgmcHgK1xhP';
const OLD_ADMIN = 'E1admb4tW2Y6bpbnpE5jYZsc4TE2NArG7siZqDsafnob';
const NEW_ADMIN = 'AiLGdNitMjv8n5HMS7HAdV2kaeJZZFd4jdfn5xp1PKrW';

describe('foldEvents', () => {
  it('happy: folds set_authority + threshold_changed into a coherent ControlState (real Drift council numbers)', () => {
    const events: FoldableEvent[] = [
      { slot: 403762585, kind: 'set_authority', payload: { newAuthority: ORIGINAL_MULTISIG, authorityKind: 'squads_vault' } },
      {
        slot: 403762586,
        kind: 'threshold_changed',
        payload: { multisig: { address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY } },
      },
    ];
    const state = foldEvents(events);
    expect(state.authorityAddress).toBe(ORIGINAL_MULTISIG);
    expect(state.authorityKind).toBe('squads_vault');
    expect(state.multisig).toEqual({ address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY });
    expect(state.asOfSlot).toBe(403762586);
  });

  it('happy: real admin hijack (privileged_ix, field=admin) updates state.admin', () => {
    const events: FoldableEvent[] = [
      { slot: 408886958, kind: 'privileged_ix', payload: { ixName: 'UpdateAdmin', field: 'admin', newValue: NEW_ADMIN, actor: ORIGINAL_MULTISIG } },
    ];
    const state = foldEvents(events);
    expect(state.admin).toBe(NEW_ADMIN);
  });

  it('happy: out-of-order input is sorted by slot before folding (step 4 predates step 2 chronologically)', () => {
    const stepTwo: FoldableEvent = { slot: 408886958, kind: 'privileged_ix', payload: { field: 'admin', newValue: NEW_ADMIN } };
    const stepFour: FoldableEvent = {
      slot: 408806252,
      kind: 'threshold_changed',
      payload: { multisig: { address: NEW_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY } },
    };
    const forward = foldEvents([stepFour, stepTwo]);
    const reversed = foldEvents([stepTwo, stepFour]);
    expect(forward).toEqual(reversed);
    expect(forward.multisig?.address).toBe(NEW_MULTISIG); // step 4 (earlier slot) applies first
    expect(forward.admin).toBe(NEW_ADMIN); // step 2 (later slot) applies after
  });

  it('edge: nonce_created by a non-controller address does not populate durableNoncesByController', () => {
    const events: FoldableEvent[] = [
      { slot: 1, kind: 'nonce_created', payload: { nonceAddress: 'SomeNonce111111111111111111111111111111111', authority: 'RandomUser11111111111111111111111111111111' } },
    ];
    const state = foldEvents(events);
    expect(state.durableNoncesByController).toEqual([]);
  });

  it('edge: nonce_created explicitly flagged authorityIsController=true is recorded even without a prior admin/multisig match', () => {
    const events: FoldableEvent[] = [
      { slot: 1, kind: 'nonce_created', payload: { nonceAddress: '45cZ5Fj97Va5Abipr6NN8Zf1BqZqWneSek1hU5cQRvhw', authority: ORIGINAL_MULTISIG, authorityIsController: true } },
    ];
    const state = foldEvents(events);
    expect(state.durableNoncesByController).toEqual(['45cZ5Fj97Va5Abipr6NN8Zf1BqZqWneSek1hU5cQRvhw']);
  });

  it('error: unknown event kind is skipped, not thrown, and does not corrupt prior state', () => {
    const events: FoldableEvent[] = [
      { slot: 1, kind: 'privileged_ix', payload: { field: 'admin', newValue: OLD_ADMIN } },
      { slot: 2, kind: 'totally_unrecognized_kind', payload: { anything: 'goes' } },
    ];
    expect(() => foldEvents(events)).not.toThrow();
    const state = foldEvents(events);
    expect(state.admin).toBe(OLD_ADMIN);
    expect(state.asOfSlot).toBe(2);
  });

  it('error: malformed multisig payload (missing threshold) is ignored, not partially applied', () => {
    const events: FoldableEvent[] = [{ slot: 1, kind: 'threshold_changed', payload: { multisig: { address: ORIGINAL_MULTISIG } } }];
    const state = foldEvents(events);
    expect(state.multisig).toBeNull();
  });

  it('empty input returns EMPTY_CONTROL_STATE', () => {
    expect(foldEvents([])).toEqual(EMPTY_CONTROL_STATE);
  });
});

describe('hashState', () => {
  it('is stable across key order (order-independent canonicalization)', () => {
    const a = { ...EMPTY_CONTROL_STATE, admin: OLD_ADMIN, authorityAddress: ORIGINAL_MULTISIG };
    const b = { ...EMPTY_CONTROL_STATE, authorityAddress: ORIGINAL_MULTISIG, admin: OLD_ADMIN };
    expect(hashState(a).equals(hashState(b))).toBe(true);
  });

  it('differs when state differs', () => {
    const a = { ...EMPTY_CONTROL_STATE, admin: OLD_ADMIN };
    const b = { ...EMPTY_CONTROL_STATE, admin: NEW_ADMIN };
    expect(hashState(a).equals(hashState(b))).toBe(false);
  });
});
