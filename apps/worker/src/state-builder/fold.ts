// File: apps/worker/src/state-builder/fold.ts
// [TESTED — see fold.test.ts, real Drift incident facts]
//
// ARCHITECTURE.md §7 / BACKEND.md §4: fold a protocol's `events` rows (in
// slot order) into a `control_state` snapshot, queryable AS OF any slot.
// Pure and deterministic: same event list -> same ControlState, always
// (the replay engine in ../replay/drift-replay.ts and the risk engine both
// depend on this).
//
// Each control-changing event's payload carries the *full* freshly-read
// sub-state it produced (e.g. the whole multisig snapshot after a config
// change), not an isolated field diff — that matches how these events are
// actually produced upstream: a decoded config-changing instruction is
// paired with a live/derived re-read of the account it touched, because a
// partial diff off `payload` alone can't be trusted to be complete (Anchor
// config actions can change threshold, time_lock and members together in
// one ConfigTransactionExecute).

import { createHash } from 'node:crypto';
import { EMPTY_CONTROL_STATE, type ControlState, type VerifiedStatus } from '@keyholder/risk';
import type { Db } from '../db';
import { events } from '../schema';
import { and, asc, eq, lte } from 'drizzle-orm';

export type { ControlState };

/** The subset of an `events` row fold.ts needs. Matches apps/worker/src/schema.ts's `events` table shape. */
export interface FoldableEvent {
  slot: number;
  kind: string;
  payload: unknown;
  actor?: string[] | null;
}

interface MultisigPayload {
  address: string;
  threshold: number;
  memberCount: number;
  timeLockS: number;
  configAuthority: string | null;
}

function isMultisigPayload(v: unknown): v is MultisigPayload {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>).address === 'string' &&
    typeof (v as Record<string, unknown>).threshold === 'number'
  );
}

function payloadObj(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
}

/**
 * Fold a slot-ordered (or unordered — this sorts defensively) list of events
 * for one protocol into the ControlState they produce. Unknown event kinds
 * and malformed payloads are skipped, never guessed at (REAL ONLY: an event
 * this function can't interpret leaves the prior state untouched rather than
 * inventing a value).
 */
export function foldEvents(events: FoldableEvent[]): ControlState {
  const sorted = [...events].sort((a, b) => a.slot - b.slot);
  let state: ControlState = { ...EMPTY_CONTROL_STATE };

  for (const event of sorted) {
    const p = payloadObj(event.payload);

    switch (event.kind) {
      case 'set_authority': {
        const newAuthority = typeof p.newAuthority === 'string' ? p.newAuthority : null;
        const authorityKind = typeof p.authorityKind === 'string' ? (p.authorityKind as ControlState['authorityKind']) : 'unknown';
        state = { ...state, authorityAddress: newAuthority, authorityKind, asOfSlot: event.slot };
        break;
      }
      case 'threshold_changed':
      case 'timelock_changed':
      case 'member_added': {
        if (isMultisigPayload(p.multisig)) {
          state = {
            ...state,
            authorityKind: state.authorityKind === 'unknown' ? 'squads_vault' : state.authorityKind,
            multisig: { ...p.multisig },
            asOfSlot: event.slot,
          };
        }
        break;
      }
      case 'nonce_created': {
        const nonceAddress = typeof p.nonceAddress === 'string' ? p.nonceAddress : null;
        const authority = typeof p.authority === 'string' ? p.authority : null;
        const isController =
          (authority && authority === state.admin) ||
          (authority && state.multisig?.address === authority) ||
          p.authorityIsController === true;
        if (nonceAddress && isController && !state.durableNoncesByController.includes(nonceAddress)) {
          state = { ...state, durableNoncesByController: [...state.durableNoncesByController, nonceAddress], asOfSlot: event.slot };
        }
        break;
      }
      case 'privileged_ix': {
        if (p.field === 'admin' && typeof p.newValue === 'string') {
          state = { ...state, admin: p.newValue, asOfSlot: event.slot };
        } else {
          state = { ...state, asOfSlot: event.slot };
        }
        break;
      }
      case 'verify_status_changed': {
        const newStatus = typeof p.newStatus === 'string' ? (p.newStatus as VerifiedStatus) : 'unknown';
        state = { ...state, verifiedStatus: newStatus, asOfSlot: event.slot };
        break;
      }
      default:
        // upgrade / proposal_created / proposal_executed / nonce_advanced /
        // unknown_privileged_ix / idl_changed / account_changed_undecoded /
        // close: no ControlState field this function tracks changes as a
        // direct result of these kinds today. Advance asOfSlot only.
        state = { ...state, asOfSlot: event.slot };
        break;
    }
  }

  return state;
}

/** Canonical, order-independent JSON for hashing (object keys sorted recursively). */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = canonicalize(obj[k]);
        return acc;
      }, {});
  }
  return value;
}

export function hashState(state: ControlState): Buffer {
  return createHash('sha256').update(JSON.stringify(canonicalize(state))).digest();
}

/**
 * AS-OF query: fold every event for `protocolId` at or before `slot` into a
 * ControlState. Reads directly from the `events` table (not the
 * `control_state` snapshot cache), so it is correct even for a slot that
 * was never snapshotted.
 */
export async function getControlStateAtSlot(db: Db, protocolId: string, slot: number): Promise<ControlState> {
  const rows = await db
    .select({ slot: events.slot, kind: events.kind, payload: events.payload, actor: events.actor })
    .from(events)
    .where(and(eq(events.protocol_id, protocolId), lte(events.slot, slot)))
    .orderBy(asc(events.slot));

  return foldEvents(rows.map((r) => ({ slot: r.slot, kind: r.kind, payload: r.payload, actor: r.actor })));
}
