// File: apps/worker/src/pipeline/verification.ts
//
// Verification poller (arch/B-worker.md's "every 6h call
// fetchVerificationStatus per tracked program, insert verification_checks,
// and when status changes feed it through the state/risk stages"). Reuses
// the already-tested state-builder/verify-osec.ts (real verify.osec.io HTTP
// calls) — this module only adds the "insert + detect change + trigger
// downstream" orchestration.
//
// A status change is recorded as a real `events` row (kind
// 'verify_status_changed', which fold.ts already recognizes and folds into
// ControlState.verifiedStatus) before the state stage runs, so the
// verified -> drifted transition the risk engine's `verification_drift` rule
// needs is visible to `getControlStateAtSlot`.

import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Connection } from '@solana/web3.js';
import type { Db } from '../db';
import { programs, verification_checks, events } from '../schema';
import { fetchVerificationStatus } from '../state-builder/verify-osec';
import { refreshProtocolState } from './state';
import { runRiskStage } from './risk';

export interface VerificationLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

const consoleLogger: VerificationLogger = {
  info: (msg, meta) => console.log(`[verify] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[verify] ${msg}`, meta ?? ''),
};

export interface VerificationPollResult {
  programsChecked: number;
  statusChanges: number;
  errors: number;
}

/**
 * Polls verify.osec.io for every tracked program, records the check, and for
 * any program whose verified status actually changed since its last check,
 * emits a `verify_status_changed` event and re-runs the state + risk stages
 * for that program's protocol.
 */
export interface VerificationPollOptions {
  /** Restrict the poll to these program ids (default: every tracked program). Mainly for test isolation. */
  programIds?: string[];
}

export async function runVerificationPoll(
  db: Db,
  connection: Connection,
  currentSlot: number,
  logger: VerificationLogger = consoleLogger,
  options: VerificationPollOptions = {}
): Promise<VerificationPollResult> {
  const whereClause = options.programIds
    ? and(eq(programs.tracked, true), inArray(programs.program_id, options.programIds))
    : eq(programs.tracked, true);
  const tracked = await db.select({ program_id: programs.program_id, protocol_id: programs.protocol_id }).from(programs).where(whereClause);

  let statusChanges = 0;
  let errors = 0;

  for (const program of tracked) {
    try {
      const [lastCheck] = await db
        .select({ is_verified: verification_checks.is_verified, raw: verification_checks.raw })
        .from(verification_checks)
        .where(eq(verification_checks.program_id, program.program_id))
        .orderBy(desc(verification_checks.checked_at))
        .limit(1);

      const result = await fetchVerificationStatus(program.program_id);

      await db
        .insert(verification_checks)
        .values({
          program_id: program.program_id,
          checked_at: result.checkedAt,
          is_verified: result.isVerified,
          on_chain_hash: result.onChainHash,
          executable_hash: result.executableHash,
          commit: result.commit,
          repo_url: result.repoUrl,
          raw: result.raw,
        })
        .onConflictDoNothing({ target: [verification_checks.program_id, verification_checks.checked_at] });

      const previouslyVerified = lastCheck?.is_verified ?? null;
      const changed = previouslyVerified !== null && previouslyVerified !== result.isVerified && result.verifiedStatus !== 'unknown';

      if (changed && program.protocol_id) {
        statusChanges++;
        await db
          .insert(events)
          .values({
            event_uid: `verify:${program.program_id}:${result.checkedAt.getTime()}`,
            slot: currentSlot,
            block_time: result.checkedAt,
            signature: `verify:${program.program_id}`,
            ix_path: '0',
            protocol_id: program.protocol_id,
            program_id: program.program_id,
            kind: 'verify_status_changed',
            category: 'verification',
            actor: [],
            payload: { newStatus: result.verifiedStatus },
            privilege_basis: null,
            decode_confidence: 'high',
            finalized: true,
          })
          .onConflictDoNothing({ target: events.event_uid });

        const stateResult = await refreshProtocolState(db, connection, program.protocol_id, currentSlot);
        if (stateResult.wrote) {
          await runRiskStage(db, program.protocol_id, currentSlot, stateResult.before, stateResult.after);
        }
      }
    } catch (err) {
      errors++;
      logger.error('verification check failed', { programId: program.program_id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { programsChecked: tracked.length, statusChanges, errors };
}
