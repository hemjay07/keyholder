// File: apps/worker/src/replay/drift-replay.ts
// [TESTED — see drift-replay.test.ts, golden test]
//
// Task 3.3: reconstruct the Drift v2 March-April 2026 incident from
// data/drift-2026/timeline.json — 15 real, on-chain-sourced steps, each
// citing a real signature/slot and (per that file's own notes) decoded log
// data — plus one real supplemental step from
// data/fixtures-for-decoder/initialize-nonce-account.json (see
// loadSupplementalNonceStep below). Fold them into ControlState frames via
// ../state-builder/fold.ts-shaped transitions, run every step through the
// risk engine (@keyholder/risk).
//
// DEV-043 (coordinator review, 2026-09-26): "first alert" used to mean
// "first delta of any kind", which for this incident is `no_timelock` — a
// STANDING condition (2-of-5, no timelock) that was already true at the
// very first transaction in the window. Measuring lead time from a standing
// condition is misleading: it is an artifact of where the replay window
// happens to start, not a warning the product "fired". This file now
// reports two separate, honestly-labelled things:
//   - `postureAtWindowStart`: the standing-rule deltas (rule.standing ===
//     true, from @keyholder/risk) active on the very first real frame —
//     reported as POSTURE, never as an alert.
//   - `firstTransitionAlert`: the first delta from a non-standing
//     (rule.standing === false) rule anywhere in the replay — an actual
//     change/event: new_multisig_created_by_controller (2026-03-25),
//     admin_changed (2026-03-26), durable_nonce_by_controller (2026-03-31,
//     see loadSupplementalNonceStep), or privileged_ix_by_new_admin.
//   `leadTimeSeconds` is now measured from `firstTransitionAlert` to the
//   first drain, not from the standing posture.
//
// BINDING TRUTH RULE (this task's brief): no on-chain 3-of-5 -> 2-of-5
// threshold change was found anywhere in this window (timeline.json step
// 15's own conclusion). Both multisigs show threshold 2-of-5 as their only
// observed state throughout. This file never constructs a threshold
// transition for either multisig — the `no_timelock` and
// `new_multisig_created_by_controller` rules fire on the real, constant
// 2-of-5/0s facts instead of a fabricated reduction.
//
// timeline.json's own step order is narrative, not chronological (step 4 —
// the second multisig's genesis — happened before step 2, but was a later
// finding appended after it). This module sorts by `slot`, Solana's actual
// monotonic ordering, before folding. Note: step 10 and step 11's
// `blockTime` fields are inconsistent with their slot order in the source
// file itself (step 10's blockTime is *later* than step 11's despite a
// lower slot) — reported here, not silently corrected; slot order is what
// this replay trusts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import bs58 from 'bs58';
import { decodeSystemInstruction } from '@keyholder/decoder';
import { evaluateDelta, RULES_BY_ID } from '@keyholder/risk';
import { EMPTY_CONTROL_STATE, type ControlState, type RiskDelta } from '@keyholder/risk';

const DRIFT_PROTOCOL_ID = 'drift';
const ORIGINAL_MULTISIG = '61ApQqLoWVfTuzua9c22SWMj78RGv77x6Z2kzcJVGNjP';
const NEW_MULTISIG = '2LW6PSEjp81xSEttWwXDB6Etb1eKdhYPbFEojYbyhx88';
const CONFIG_AUTHORITY = 'A1eC8n2tQBHPodn8sZHsc5XWciunZy9B1VgmcHgK1xhP';
const OLD_ADMIN = 'E1admb4tW2Y6bpbnpE5jYZsc4TE2NArG7siZqDsafnob';
const NEW_ADMIN = 'AiLGdNitMjv8n5HMS7HAdV2kaeJZZFd4jdfn5xp1PKrW';
const RECOVERY_ADMIN = 'H7PiGqqUaanBovwKgEtreJbKmQe6dbq6VTrw6guy7ZgL';
/** Real member of the new multisig (data/drift-2026/multisig-new/decoded-state.json). */
const NONCE_STEP_ID = 16;

export interface TimelineStep {
  step: number;
  signature: string;
  slot: number;
  blockTime: number;
  blockTimeIso: string;
  program: string;
  instruction: string;
  accounts: string[];
  note: string;
}

export type FrameLabel = 'reconstructed from on-chain transactions' | `not retrieved: ${string}`;

export interface ReplayFrame {
  step: number;
  time: string;
  blockTime: number;
  slot: number;
  signature: string;
  controlState: ControlState;
  deltasFired: RiskDelta[];
  label: FrameLabel;
  /** True for a synthetic frame inserted to name a known gap (no on-chain instruction of its own). */
  isGapFrame: boolean;
}

export interface ReplayResult {
  frames: ReplayFrame[];
  /** Standing-rule deltas (rule.standing === true) active at the very first real frame — posture, not an alert. */
  postureAtWindowStart: RiskDelta[];
  /** The first delta from a non-standing (event/transition) rule anywhere in the replay. */
  firstTransitionAlert: { frame: ReplayFrame; delta: RiskDelta } | null;
  firstDrainFrame: ReplayFrame;
  /** Seconds from firstTransitionAlert to firstDrainFrame — measured, never asserted to a specific value. */
  leadTimeSeconds: number | null;
  rulesVersion: number;
}

export function loadTimeline(): TimelineStep[] {
  const path = join(__dirname, '..', '..', '..', '..', 'data', 'drift-2026', 'timeline.json');
  return JSON.parse(readFileSync(path, 'utf8')) as TimelineStep[];
}

/**
 * A real, decoded durable-nonce creation this session found while
 * addressing DEV-043: data/fixtures-for-decoder/initialize-nonce-account.json
 * is an unmodified real `getTransaction` result (see
 * research/drift-2026-history.md's DEV-008 note) whose second instruction
 * is a genuine System `InitializeNonceAccount` (decoded here with the
 * already-tested `decodeSystemInstruction` from @keyholder/decoder — no new
 * parsing logic). The nonce it creates, `EmYEryTDXtuVCxrjNqJXbiwr4hfiJajd4g5P58vvhQnc`,
 * is authorized to `6UJbu9ut5VAsFYQFgPEa5xPfoyF5bB5oi4EknFPvu924` — a real,
 * confirmed member of the new multisig (data/drift-2026/multisig-new/
 * decoded-state.json's member list) — 4h41m before the first insurance-fund
 * drain (step 8) and used again in the recovery tx (step 12).
 */
function loadSupplementalNonceStep(): TimelineStep {
  const path = join(__dirname, '..', '..', '..', '..', 'data', 'fixtures-for-decoder', 'initialize-nonce-account.json');
  const tx = JSON.parse(readFileSync(path, 'utf8')) as {
    slot: number;
    blockTime: number;
    transaction: { signatures: string[]; message: { accountKeys: string[]; instructions: { programIdIndex: number; accounts: number[]; data: string }[] } };
  };
  const msg = tx.transaction.message;
  const initIx = msg.instructions[1];
  if (!initIx) throw new Error('loadSupplementalNonceStep: expected a second instruction (InitializeNonceAccount)');
  const data = Buffer.from(bs58.decode(initIx.data));
  const decoded = decodeSystemInstruction(data);
  if (decoded.type !== 'InitializeNonceAccount') {
    throw new Error(`loadSupplementalNonceStep: expected InitializeNonceAccount, decoded ${decoded.type}`);
  }
  const nonceAddress = msg.accountKeys[initIx.accounts[0]!]!;

  return {
    step: NONCE_STEP_ID,
    signature: tx.transaction.signatures[0]!,
    slot: tx.slot,
    blockTime: tx.blockTime,
    blockTimeIso: new Date(tx.blockTime * 1000).toISOString(),
    program: '11111111111111111111111111111111',
    instruction: 'InitializeNonceAccount',
    accounts: [nonceAddress, decoded.authorized],
    note: `Real, decoded durable-nonce creation (data/fixtures-for-decoder/initialize-nonce-account.json). Nonce ${nonceAddress} authorized to ${decoded.authorized}, a confirmed member of the new multisig — ~4h41m before the first insurance-fund drain (step 8).`,
  };
}

/**
 * Per-step interpretation: the exact ControlState transition and risk-engine
 * event facts each real step produces, taken directly from that step's own
 * `note` (which itself cites decoded, real log data — see timeline.json) or,
 * for step 16, directly decoded from a real fixture. This is a fixed table
 * over known real events, not a generic decoder — a generic on-chain decoder
 * for arbitrary future Drift incidents is out of this task's scope (Task
 * 3.1/3.2 supply that machinery for live events; this replays one specific,
 * already-researched incident).
 */
interface StepOutcome {
  next: ControlState;
  event: Record<string, unknown>;
  ruleIds?: string[];
  gapNote?: string;
  /**
   * Overrides `state` as the "before" side of the risk-engine comparison for
   * this step only, when a single real instruction reveals a fact (like the
   * admin hijack's old-admin account) that the fold hadn't independently
   * observed yet. Defaults to `state` when omitted.
   */
  before?: ControlState;
}

function applyStep(state: ControlState, step: TimelineStep): StepOutcome {
  switch (step.step) {
    case 1: {
      // Routine pre-incident governance on the original council. First
      // observed multisig snapshot: 2-of-5, timelock 0 (real, and — per the
      // binding truth rule — the SAME numbers observed at every later frame;
      // no reduction is ever modeled).
      const next: ControlState = {
        ...state,
        multisig: { address: ORIGINAL_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY, programVersion: 'v4' },
        asOfSlot: step.slot,
      };
      return { next, event: {} };
    }
    case 2: {
      // The admin hijack. Both old and new admin are decoded from this one
      // instruction's own accounts (UpdateAdmin names both) — real facts
      // simultaneously available regardless of what was tracked before.
      const before: ControlState = { ...state, admin: state.admin ?? OLD_ADMIN };
      const next: ControlState = { ...before, admin: NEW_ADMIN, asOfSlot: step.slot };
      return { next, before, event: {} };
    }
    case 3: {
      // FAILS: old admin locked out. No state change — the attempted ix
      // never executed. Informational only.
      return { next: { ...state, asOfSlot: step.slot }, event: {} };
    }
    case 4: {
      // NEW FINDING: a second multisig, genesis-created ~9h before the
      // hijack (chronologically earlier by slot than step 2, even though it
      // is narrated after it in timeline.json), sharing config_authority
      // with the original council — real decoded state, same 2-of-5/0s.
      const priorConfigAuthority = state.multisig?.configAuthority ?? null;
      const next: ControlState = {
        ...state,
        multisig: { address: NEW_MULTISIG, threshold: 2, memberCount: 5, timeLockS: 0, configAuthority: CONFIG_AUTHORITY, programVersion: 'v4' },
        asOfSlot: step.slot,
      };
      return { next, event: { priorConfigAuthority } };
    }
    case 5:
    case 6:
    case 7: {
      // Privileged config changes to perp market 85 via the new multisig,
      // routed through the still-freshly-hijacked admin.
      const ixName = step.instruction.split('->')[1]?.trim().split(':')[0]?.trim() ?? step.instruction;
      return {
        next: { ...state, asOfSlot: step.slot },
        event: { privileged: true, actorIsRecentAdmin: true, ixName, actor: NEW_ADMIN },
      };
    }
    case 8: {
      // First real fund outflow via the admin channel: this replay's "first
      // drain tx" (see firstDrainStep below). Exact token amount was not
      // decoded this session (needs Drift's IF-withdraw event IDL) — a
      // labelled gap, not a guessed number.
      return {
        next: { ...state, asOfSlot: step.slot },
        event: { privileged: true, actorIsRecentAdmin: true, ixName: 'AdminWithdrawFromInsuranceFundVault', actor: NEW_ADMIN },
        gapNote: 'withdrawal amount not decoded (needs Drift IF-withdraw event IDL)',
      };
    }
    case 9: {
      // Housekeeping cleanup on the new multisig. No control-state signal.
      return { next: { ...state, asOfSlot: step.slot }, event: {} };
    }
    case 10: {
      // Executor wallet stages token accounts — not a control-plane event.
      return { next: { ...state, asOfSlot: step.slot }, event: {} };
    }
    case 11: {
      // Second, larger insurance-fund withdrawal, same admin channel.
      return {
        next: { ...state, asOfSlot: step.slot },
        event: { privileged: true, actorIsRecentAdmin: true, ixName: 'AdminWithdrawFromInsuranceFundVault', actor: NEW_ADMIN },
        gapNote: 'withdrawal amount not decoded (needs Drift IF-withdraw event IDL)',
      };
    }
    case 12: {
      // The recovery: admin rotated away from the attacker's wallet.
      const before: ControlState = { ...state, admin: state.admin ?? NEW_ADMIN };
      const next: ControlState = { ...before, admin: RECOVERY_ADMIN, asOfSlot: step.slot };
      return { next, before, event: {} };
    }
    case 13: {
      // The user-facing drain burst: ordinary Withdraw ix, not an admin
      // action — no control-state rule applies. Exact drained amounts are
      // not decoded here (this replay tracks control-state signals, not
      // fund-flow accounting) — a labelled gap.
      return { next: { ...state, asOfSlot: step.slot }, event: {}, gapNote: 'drained amounts not decoded (fund-flow accounting is out of this replay\'s scope)' };
    }
    case 14: {
      // Laundering leg via Jupiter — not a control-plane event.
      return { next: { ...state, asOfSlot: step.slot }, event: {} };
    }
    case 15: {
      // The negative result: ConfigTransactionCreate x4 rejected on-chain
      // (NotSupportedForControlled) because both multisigs are
      // config_authority-controlled. This CONFIRMS the binding truth rule:
      // no evidence exists in this window for a 3-of-5 -> 2-of-5 threshold
      // change on either multisig.
      return {
        next: { ...state, asOfSlot: step.slot },
        event: {},
        gapNote:
          'rekt.news\'s claimed 3-of-5 -> 2-of-5 threshold reduction is NOT evidenced on-chain in this window (external claim only, never asserted here as fact); both multisigs show 2-of-5 throughout the captured period',
      };
    }
    case NONCE_STEP_ID: {
      // Real durable nonce created by a confirmed member of the controlling
      // (new) multisig — a genuine event-driven transition, not a repeat of
      // the standing no_timelock condition.
      const nonceAddress = step.accounts[0]!;
      const authorized = step.accounts[1]!;
      const next: ControlState = {
        ...state,
        durableNoncesByController: [...state.durableNoncesByController, nonceAddress],
        asOfSlot: step.slot,
      };
      return { next, event: { nonceAuthority: authorized } };
    }
    default:
      return { next: { ...state, asOfSlot: step.slot }, event: {} };
  }
}

const FIRST_DRAIN_STEP = 8;

function isStandingRule(ruleId: string): boolean {
  return RULES_BY_ID.get(ruleId)?.standing ?? false;
}

export function replayDriftIncident(): ReplayResult {
  const steps = [...loadTimeline(), loadSupplementalNonceStep()].sort((a, b) => a.slot - b.slot);
  let state: ControlState = { ...EMPTY_CONTROL_STATE };
  const frames: ReplayFrame[] = [];
  let firstDrainFrame: ReplayFrame | null = null;

  for (const step of steps) {
    const { next, event, ruleIds, gapNote, before } = applyStep(state, step);
    const deltas = evaluateDelta(before ?? state, next, { protocolId: DRIFT_PROTOCOL_ID, slot: step.slot }, event, ruleIds ? { ruleIds } : {});
    state = next;

    const frame: ReplayFrame = {
      step: step.step,
      time: step.blockTimeIso,
      blockTime: step.blockTime,
      slot: step.slot,
      signature: step.signature,
      controlState: next,
      deltasFired: deltas,
      label: 'reconstructed from on-chain transactions',
      isGapFrame: false,
    };
    frames.push(frame);

    if (step.step === FIRST_DRAIN_STEP) {
      firstDrainFrame = frame;
    }

    if (gapNote) {
      frames.push({
        step: step.step,
        time: step.blockTimeIso,
        blockTime: step.blockTime,
        slot: step.slot,
        signature: step.signature,
        controlState: next,
        deltasFired: [],
        label: `not retrieved: ${gapNote}`,
        isGapFrame: true,
      });
    }
  }

  if (!firstDrainFrame) {
    throw new Error(`replayDriftIncident: step ${FIRST_DRAIN_STEP} (first drain) not found in timeline.json`);
  }

  // (a) Posture at window start: standing-rule deltas on the first real frame.
  const firstFrame = frames.find((f) => !f.isGapFrame) ?? null;
  const postureAtWindowStart = firstFrame ? firstFrame.deltasFired.filter((d) => isStandingRule(d.ruleId)) : [];

  // (b) First transition alert: the first non-standing delta anywhere, in chronological order.
  let firstTransitionAlert: { frame: ReplayFrame; delta: RiskDelta } | null = null;
  for (const frame of frames) {
    if (frame.isGapFrame) continue;
    const transitionDelta = frame.deltasFired.find((d) => !isStandingRule(d.ruleId));
    if (transitionDelta) {
      firstTransitionAlert = { frame, delta: transitionDelta };
      break;
    }
  }

  const leadTimeSeconds = firstTransitionAlert ? firstDrainFrame.blockTime - firstTransitionAlert.frame.blockTime : null;

  return {
    frames,
    postureAtWindowStart,
    firstTransitionAlert,
    firstDrainFrame,
    leadTimeSeconds,
    rulesVersion: 1,
  };
}
