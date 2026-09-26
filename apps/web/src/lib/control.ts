// File: apps/web/src/lib/control.ts
// Shapes a stored ControlState (packages/risk/src/types.ts) into the public
// "control facts" the API surfaces: authority kind, threshold/members,
// timelock, verified status, evidence signature, as-of slot.
//
// Squads v3 rule (DEV-043, coordinator review 2026-09-26): v3 multisigs have
// no timelock field at all. The state-builder still stores `timeLockS: 0`
// for v3 (so existing timelock rules keep working), but the public API must
// never describe that as "0 seconds" — it reports "no timelock feature"
// whenever `multisig.programVersion === 'v3'`.

export interface StoredControlState {
  authorityKind: string;
  authorityAddress: string | null;
  multisig: {
    address: string;
    threshold: number;
    memberCount: number;
    timeLockS: number;
    configAuthority: string | null;
    programVersion?: 'v3' | 'v4';
  } | null;
  admin: string | null;
  durableNoncesByController: string[];
  verifiedStatus: string;
  asOfSlot: number | null;
}

export interface ControlFacts {
  authorityKind: string;
  authorityAddress: string | null;
  threshold: number | null;
  members: number | null;
  timelock: { kind: 'none'; seconds: 0 } | { kind: 'no_timelock_feature' } | { kind: 'seconds'; seconds: number } | null;
  verifiedStatus: string;
  asOfSlot: number | null;
}

export function toControlFacts(state: StoredControlState): ControlFacts {
  const multisig = state.multisig;
  let timelock: ControlFacts['timelock'] = null;
  if (multisig) {
    if (multisig.programVersion === 'v3') {
      timelock = { kind: 'no_timelock_feature' };
    } else if (multisig.timeLockS === 0) {
      timelock = { kind: 'none', seconds: 0 };
    } else {
      timelock = { kind: 'seconds', seconds: multisig.timeLockS };
    }
  }

  return {
    authorityKind: state.authorityKind,
    authorityAddress: state.authorityAddress,
    threshold: multisig?.threshold ?? null,
    members: multisig?.memberCount ?? null,
    timelock,
    verifiedStatus: state.verifiedStatus,
    asOfSlot: state.asOfSlot,
  };
}
