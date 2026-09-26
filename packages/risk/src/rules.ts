// File: packages/risk/src/rules.ts
// [TESTED — see engine.test.ts, one happy/edge/error case per rule]
//
// Task 3.2 / BACKEND.md §5.1's ten-rule initial set (the subset this task
// names explicitly): each rule is a versioned, plain-data record — id,
// version, severity and an explanation *template function* — evaluated by
// engine.ts against a real (before, after) ControlState transition plus the
// event/tx that produced it. No `eval()` of user strings anywhere (BACKEND
// §5.1 asks for a sandboxed expression language; this ships the equivalent
// safety property — no dynamic code execution — as typed predicate
// functions, which is easier to unit-test per rule and just as data-driven
// for versioning purposes: bumping `version` and changing the function is
// the same "never mutate old deltas silently" operation BACKEND.md §5.4
// describes).

import type { ControlState, RiskFacts, Severity } from './types';

export interface RuleEvalInput {
  before: ControlState;
  after: ControlState;
  /** Event-specific facts the rule may need beyond the two states (e.g. the new admin address). */
  event: RiskFacts;
}

export interface RuleFireResult {
  severity: Severity;
  explanation: string;
  facts: RiskFacts;
}

export interface Rule {
  id: string;
  version: number;
  description: string;
  /**
   * True for a rule that evaluates a standing condition of `after` alone
   * (e.g. "this multisig currently has no timelock") rather than a change
   * between `before` and `after`. Used by callers (the replay engine, the
   * dashboard) to report a standing rule as *posture* ("this is how it's
   * always been since we started watching") rather than as an *alert*
   * ("something just changed") — see drift-replay.ts's
   * postureAtWindowStart/firstTransitionAlert split. The engine's own
   * repeat-suppression (engine.ts's evaluateDelta) applies to every rule
   * uniformly regardless of this flag.
   */
  standing: boolean;
  /** Returns a fire result, or null if the rule does not fire for this transition. */
  evaluate: (input: RuleEvalInput) => RuleFireResult | null;
}

function fmtTimelock(seconds: number | null | undefined): string {
  if (seconds == null) return 'unknown';
  if (seconds === 0) return '0s (none)';
  if (seconds < 3600) return `${seconds}s`;
  return `${Math.round((seconds / 3600) * 100) / 100}h (${seconds}s)`;
}

export const RULES: Rule[] = [
  // ── single_key_authority ────────────────────────────────────────────────
  {
    id: 'single_key_authority',
    version: 1,
    description: 'Program upgrade or admin authority is held by a single key, not a multisig.',
    standing: true,
    evaluate({ after }) {
      if (after.authorityKind !== 'single_key') return null;
      return {
        severity: 'high',
        explanation: `Authority ${after.authorityAddress ?? 'unknown'} is a single key — one signature can change the program, with no other signer required.`,
        facts: { authorityKind: after.authorityKind, authorityAddress: after.authorityAddress },
      };
    },
  },

  // ── no_timelock ─────────────────────────────────────────────────────────
  {
    id: 'no_timelock',
    version: 1,
    description: 'Controlling multisig has zero timelock: an approved action executes immediately.',
    standing: true,
    evaluate({ after }) {
      if (!after.multisig) return null;
      if (after.multisig.timeLockS !== 0) return null;
      return {
        severity: after.multisig.threshold <= 2 ? 'critical' : 'high',
        explanation: `${after.multisig.address}'s ${after.multisig.threshold} of ${after.multisig.memberCount} multisig has no timelock: an approved action executes immediately with no delay to react.`,
        facts: { multisig: after.multisig.address, threshold: after.multisig.threshold, memberCount: after.multisig.memberCount },
      };
    },
  },

  // ── threshold_lowered ───────────────────────────────────────────────────
  {
    id: 'threshold_lowered',
    version: 1,
    description: 'Multisig signature threshold decreased.',
    standing: false,
    evaluate({ before, after }) {
      if (!before.multisig || !after.multisig) return null;
      if (before.multisig.address !== after.multisig.address) return null;
      if (after.multisig.threshold >= before.multisig.threshold) return null;
      const critical = after.multisig.timeLockS === 0 && after.multisig.threshold <= 2;
      return {
        severity: critical ? 'critical' : 'high',
        explanation: `${after.multisig.address}'s threshold lowered from ${before.multisig.threshold} of ${before.multisig.memberCount} to ${after.multisig.threshold} of ${after.multisig.memberCount}. Timelock: ${fmtTimelock(after.multisig.timeLockS)}.`,
        facts: {
          multisig: after.multisig.address,
          thresholdBefore: before.multisig.threshold,
          thresholdAfter: after.multisig.threshold,
          memberCountBefore: before.multisig.memberCount,
          memberCountAfter: after.multisig.memberCount,
        },
      };
    },
  },

  // ── timelock_reduced ────────────────────────────────────────────────────
  {
    id: 'timelock_reduced',
    version: 1,
    description: 'Multisig timelock duration decreased.',
    standing: false,
    evaluate({ before, after }) {
      if (!before.multisig || !after.multisig) return null;
      if (before.multisig.address !== after.multisig.address) return null;
      if (after.multisig.timeLockS >= before.multisig.timeLockS) return null;
      return {
        severity: after.multisig.timeLockS === 0 ? 'critical' : 'high',
        explanation: `${after.multisig.address}'s timelock reduced from ${fmtTimelock(before.multisig.timeLockS)} to ${fmtTimelock(after.multisig.timeLockS)}.`,
        facts: {
          multisig: after.multisig.address,
          timeLockBefore: before.multisig.timeLockS,
          timeLockAfter: after.multisig.timeLockS,
        },
      };
    },
  },

  // ── authority_changed ───────────────────────────────────────────────────
  {
    id: 'authority_changed',
    version: 1,
    description: 'Program upgrade authority reassigned to a different address.',
    standing: false,
    evaluate({ before, after }) {
      if (before.authorityAddress === after.authorityAddress) return null;
      if (before.authorityAddress === null && after.authorityAddress === null) return null;
      return {
        severity: after.authorityKind === 'single_key' ? 'critical' : 'high',
        explanation: `Upgrade authority changed from ${before.authorityAddress ?? 'none (immutable)'} to ${after.authorityAddress ?? 'none (immutable)'} (${after.authorityKind}).`,
        facts: {
          authorityBefore: before.authorityAddress,
          authorityAfter: after.authorityAddress,
          authorityKindBefore: before.authorityKind,
          authorityKindAfter: after.authorityKind,
        },
      };
    },
  },

  // ── admin_changed ───────────────────────────────────────────────────────
  {
    id: 'admin_changed',
    version: 1,
    description: "Protocol's admin-bearing account (e.g. State.admin) reassigned.",
    standing: false,
    evaluate({ before, after }) {
      if (before.admin === after.admin) return null;
      if (before.admin === null) return null; // first observation, not a change
      return {
        severity: 'critical',
        explanation: `Admin changed from ${before.admin} to ${after.admin ?? 'none'}.`,
        facts: { adminBefore: before.admin, adminAfter: after.admin },
      };
    },
  },

  // ── durable_nonce_by_controller ─────────────────────────────────────────
  {
    id: 'durable_nonce_by_controller',
    version: 1,
    description: 'A durable nonce account was created by an address this protocol treats as a controller (Drift pre-signal, BACKEND.md §5.1).',
    standing: false,
    evaluate({ before, after, event }) {
      const created = after.durableNoncesByController.filter((n) => !before.durableNoncesByController.includes(n));
      if (created.length === 0) return null;
      const nonceAuthority = typeof event.nonceAuthority === 'string' ? event.nonceAuthority : null;
      return {
        severity: after.durableNoncesByController.length >= 2 ? 'high' : 'medium',
        explanation: `Durable nonce ${created.join(', ')} created by ${nonceAuthority ?? 'a known controller'}. Durable nonces let a transaction be signed and executed later without a live recent blockhash — a common pre-staging step before a privileged action.`,
        facts: { noncesCreated: created, totalByController: after.durableNoncesByController.length },
      };
    },
  },

  // ── new_multisig_created_by_controller ──────────────────────────────────
  {
    id: 'new_multisig_created_by_controller',
    version: 1,
    description: 'A new Squads multisig was created that shares members or config authority with the existing controlling multisig.',
    standing: false,
    evaluate({ before, after, event }) {
      if (before.multisig?.address === after.multisig?.address) return null;
      if (!after.multisig) return null;
      const sharesConfigAuthority =
        typeof event.priorConfigAuthority === 'string' && event.priorConfigAuthority === after.multisig.configAuthority;
      if (!sharesConfigAuthority) return null;
      return {
        severity: 'high',
        explanation: `New multisig ${after.multisig.address} created (${after.multisig.threshold} of ${after.multisig.memberCount}, timelock ${fmtTimelock(after.multisig.timeLockS)}) sharing config_authority ${after.multisig.configAuthority} with the existing controlling multisig — a second, parallel control path.`,
        facts: {
          newMultisig: after.multisig.address,
          configAuthority: after.multisig.configAuthority,
          threshold: after.multisig.threshold,
          memberCount: after.multisig.memberCount,
          timeLockS: after.multisig.timeLockS,
        },
      };
    },
  },

  // ── privileged_ix_by_new_admin ───────────────────────────────────────────
  {
    id: 'privileged_ix_by_new_admin',
    version: 1,
    description: 'A privileged instruction was executed by an admin address that was itself only recently assigned.',
    standing: false,
    evaluate({ event }) {
      if (event.privileged !== true) return null;
      if (event.actorIsRecentAdmin !== true) return null;
      const ixName = typeof event.ixName === 'string' ? event.ixName : 'a privileged instruction';
      const actor = typeof event.actor === 'string' ? event.actor : 'the new admin';
      return {
        severity: 'high',
        explanation: `${ixName} executed by ${actor}, an admin address assigned recently rather than the protocol's long-standing controller.`,
        facts: { ixName, actor },
      };
    },
  },

  // ── verification_drift ──────────────────────────────────────────────────
  {
    id: 'verification_drift',
    version: 1,
    description: 'On-chain program bytes no longer match the last verified build (verified -> unverified/drifted).',
    standing: false,
    evaluate({ before, after }) {
      if (before.verifiedStatus !== 'verified') return null;
      if (after.verifiedStatus === 'verified') return null;
      if (after.verifiedStatus === 'unknown') return null;
      return {
        severity: 'medium',
        explanation: `Program verification status changed from verified to ${after.verifiedStatus}: the deployed bytes no longer match the last verified source build.`,
        facts: { verifiedStatusBefore: before.verifiedStatus, verifiedStatusAfter: after.verifiedStatus },
      };
    },
  },
];

export const RULES_BY_ID: ReadonlyMap<string, Rule> = new Map(RULES.map((r) => [r.id, r]));
