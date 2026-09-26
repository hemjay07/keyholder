// File: apps/worker/src/pipeline/state.ts
//
// State stage: for a protocol with newly-decoded events, re-derive
// control_state using the existing authority resolution (state-builder/
// authority.ts's `resolveAuthority`, a live chain read — the same function
// seed.ts uses) merged with the events-derived facts fold.ts already knows
// how to fold (admin, durable nonces, verification status). Writes a new
// control_state row only when the resulting state's hash differs from the
// most recent one on file (arch/B-worker.md's "only when the state hash
// changes").
//
// Design note (DEV-071, see this task's report): Squads config-changing
// events (threshold/timelock/member changes) are recorded at
// configTransactionCreate time (decode.ts), before they are approved and
// executed — this package has no Anchor *account* decoder to re-read the
// ConfigTransaction's stored actions at execute time. Rather than fold a
// possibly-not-yet-applied multisig snapshot into control_state, this stage
// trusts `resolveAuthority`'s live read of the actual on-chain Multisig
// account for the authority/multisig facts, and only uses fold.ts's output
// for the facts it doesn't cover (admin, durable nonces, verified status).
// This is correct by construction: whatever the multisig's *current* live
// config is, that's what a live read returns, regardless of when/how it got
// there.

import { desc, eq } from 'drizzle-orm';
import type { Connection } from '@solana/web3.js';
import type { Db } from '../db';
import { control_state, programs, multisigs } from '../schema';
import { resolveAuthority } from '../state-builder/authority';
import { getControlStateAtSlot, hashState, type ControlState } from '../state-builder/fold';
import { withRedaction } from '../ingest/rpc';

export interface StateStageLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
}

const consoleLogger: StateStageLogger = {
  info: (msg, meta) => console.log(`[state] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[state] ${msg}`, meta ?? ''),
};

/**
 * The facts a change is judged on. `asOfSlot` moves on every read, and the
 * multisig object can carry descriptive fields (e.g. `programVersion`, set by
 * the seed but not by the live resolver) that are not control facts; either
 * would otherwise register as a change.
 */
function controlFacts(state: ControlState): ControlState {
  const m = state.multisig;
  return {
    ...state,
    asOfSlot: 0,
    multisig: m
      ? ({ address: m.address, threshold: m.threshold, memberCount: m.memberCount, timeLockS: m.timeLockS, configAuthority: m.configAuthority } as ControlState['multisig'])
      : null,
  };
}

export interface StateStageResult {
  protocolId: string;
  wrote: boolean;
  /** True when the live read failed: nothing was written and the risk stage must not run. */
  skipped?: boolean;
  slot: number;
  before: ControlState | null;
  after: ControlState;
}

/**
 * Re-derives and (if changed) writes one protocol's control_state at `slot`.
 * Returns the before/after states either way, so the risk stage can
 * evaluate a transition even when the hash didn't change enough to warrant
 * a new row... in practice callers only invoke the risk stage when `wrote`
 * is true (an unchanged hash means nothing for evaluateDelta to fire on).
 */
export async function refreshProtocolState(
  db: Db,
  connection: Connection,
  protocolId: string,
  slot: number,
  logger: StateStageLogger = consoleLogger
): Promise<StateStageResult> {
  const [programRow] = await db.select({ program_id: programs.program_id }).from(programs).where(eq(programs.protocol_id, protocolId)).limit(1);

  const [previousRow] = await db
    .select({ state: control_state.state, state_hash: control_state.state_hash })
    .from(control_state)
    .where(eq(control_state.protocol_id, protocolId))
    .orderBy(desc(control_state.slot))
    .limit(1);
  const previousState = (previousRow?.state as ControlState | undefined) ?? null;

  const folded = await getControlStateAtSlot(db, protocolId, slot);

  // A state is only written from a successful live read. On an RPC failure
  // (a Helius 429 on 2026-09-26) nothing is written and the caller retries
  // later: a partial read must never look like a control change.
  if (!programRow?.program_id) {
    return { protocolId, wrote: false, skipped: true, slot, before: previousState, after: previousState ?? folded };
  }
  let resolved;
  try {
    const allMultisigs = await db.select({ address: multisigs.address }).from(multisigs);
    resolved = await withRedaction(() =>
      resolveAuthority(connection, { programId: programRow.program_id, candidateMultisigs: allMultisigs.map((m) => m.address) })
    );
  } catch (err) {
    logger.warn('live authority read failed; state not written, will retry', {
      protocolId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { protocolId, wrote: false, skipped: true, slot, before: previousState, after: previousState ?? folded };
  }

  // Same upgrade authority as before, but this read could not map the vault
  // to its multisig (the seed resolved most of them from transaction
  // history): keep the multisig already known rather than report a change.
  const sameAuthority = previousState != null && resolved.upgradeAuthority === previousState.authorityAddress;
  const keepKnown = sameAuthority && resolved.multisig == null && previousState!.multisig != null;
  const authorityFacts: Pick<ControlState, 'authorityKind' | 'authorityAddress' | 'multisig'> = keepKnown
    ? { authorityKind: previousState!.authorityKind, authorityAddress: resolved.upgradeAuthority, multisig: previousState!.multisig }
    : { authorityKind: resolved.authorityKind, authorityAddress: resolved.upgradeAuthority, multisig: resolved.multisig };

  // Non-authority facts (verification status etc.) carry over from the last
  // known state; the events table only holds recent history.
  const after: ControlState = { ...(previousState ?? folded), ...authorityFacts, asOfSlot: slot };
  const afterHash = hashState(after);

  // `hashState` hashes the whole ControlState, including `asOfSlot` — which
  // changes on every call by construction (it's the slot being evaluated).
  // Comparing full hashes would defeat "only write when the state hash
  // changes" (arch/B-worker.md), since it would always differ. Compare the
  // facts with `asOfSlot` pinned to a constant instead; `state_hash` itself
  // is still stored as the full hash (matching seed.ts's existing
  // convention, since downstream code may key off the true per-slot hash).
  const beforeFactsHash = previousState ? hashState(controlFacts(previousState)) : null;
  const afterFactsHash = hashState(controlFacts(after));
  const wrote = !previousRow || !beforeFactsHash || Buffer.compare(beforeFactsHash, afterFactsHash) !== 0;

  if (wrote) {
    await db
      .insert(control_state)
      .values({ protocol_id: protocolId, slot, state: after, state_hash: afterHash })
      .onConflictDoNothing({ target: [control_state.protocol_id, control_state.slot] });
  }

  return { protocolId, wrote, slot, before: previousState, after };
}
