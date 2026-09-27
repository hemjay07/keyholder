// File: packages/risk/src/types.ts
// [TESTED — see engine.test.ts]
//
// ControlState is the shape the state-builder (apps/worker/src/state-builder
// /fold.ts) folds events into, and what the risk engine compares before/after
// on. Defined here (not in apps/worker) so both the worker and the replay
// engine depend on one shared shape without a layering cycle: worker depends
// on @keyholder/risk (see apps/worker/package.json), not the reverse.
//
// Field names mirror ARCHITECTURE.md §4's `authorities`/`multisigs` tables
// and BACKEND.md §5.3's example sentence ("Any 2 of 5 keys can change
// Drift's markets ... no delay").

export type AuthorityKind =
  | 'single_key'
  | 'squads_vault'
  | 'squads_v4_direct'
  | 'spl_gov'
  | 'coral_multisig'
  | 'immutable'
  | 'single_key_or_vault_unresolved'
  | 'unknown';

export type VerifiedStatus = 'verified' | 'unverified' | 'drifted' | 'unknown';

export interface ControlState {
  /** Program or protocol-level upgrade/admin authority. */
  authorityKind: AuthorityKind;
  authorityAddress: string | null;
  /** Populated when authorityKind is a Squads variant. */
  multisig: {
    address: string;
    threshold: number;
    memberCount: number;
    /**
     * 0 means an explicit zero-second timelock (v4). Squads v3 has no
     * timelock field at all — DEV-043 records that distinction via
     * `programVersion` rather than inventing a v3 timelock value; this is
     * still populated as 0 for v3 (the practical control fact — "no delay
     * protects a decision" — is the same either way) so every existing
     * timelock rule keeps working across both versions.
     */
    timeLockS: number;
    configAuthority: string | null;
    /** Which Squads program this multisig belongs to. Absent = unknown/untracked (e.g. tests predating this field). */
    programVersion?: 'v3' | 'v4' | 'coral';
  } | null;
  /** The protocol's admin-bearing account, when distinct from the upgrade authority (e.g. Drift's State.admin). */
  admin: string | null;
  /** Durable nonces created by an account this protocol's control set treats as a controller. */
  durableNoncesByController: string[];
  verifiedStatus: VerifiedStatus;
  /** Slot this snapshot reflects; null for a state built purely for a rule test. */
  asOfSlot: number | null;
}

export const EMPTY_CONTROL_STATE: ControlState = {
  authorityKind: 'unknown',
  authorityAddress: null,
  multisig: null,
  admin: null,
  durableNoncesByController: [],
  verifiedStatus: 'unknown',
  asOfSlot: null,
};

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface RiskFacts {
  [key: string]: unknown;
}

/** One rule firing against a (before, after) transition. */
export interface RiskDelta {
  ruleId: string;
  ruleVersion: number;
  severity: Severity;
  /** Plain-language sentence stating the facts (BACKEND.md §5.3). */
  explanation: string;
  facts: RiskFacts;
  /** protocol:slot:rule — matches ARCHITECTURE.md §4 risk_deltas.delta_uid. */
  deltaUid: string;
  /** 'active' | 'corrected' | 'retracted' — see correction.ts. */
  status: 'active' | 'corrected' | 'retracted';
  correctionId: string | null;
}

export interface RuleContext {
  protocolId: string;
  slot: number;
}
