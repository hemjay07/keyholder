// File: apps/worker/src/ingest/finality.ts
//
// Confirmed vs finalized tracking per plan/BACKEND.md §2: Solana finality is
// ~32 slots behind the tip under normal operation. A row lands as
// `commitment='confirmed'` and is re-checked once the chain has advanced
// >= FINALITY_SLOT_DEPTH slots past it; on reorg (the re-check comes back
// with a different or absent status) the row is left `confirmed` and
// flagged, never silently upgraded to `finalized`.

export const FINALITY_SLOT_DEPTH = 32;

export type FinalityStatus = 'confirmed' | 'finalized' | 'reorged';

/** True once the tip has advanced far enough past `slot` that finality can be re-checked. */
export function isDueForFinalityCheck(slot: number, tipSlot: number, depth = FINALITY_SLOT_DEPTH): boolean {
  return tipSlot - slot >= depth;
}

export interface SignatureStatusLike {
  slot: number;
  confirmationStatus?: string | null;
  err: unknown;
}

/**
 * Resolves a re-checked signature status into a FinalityStatus.
 * - Status now reports `finalized` at the *same or an earlier* slot with no
 *   error: finalized.
 * - Status missing entirely (dropped from the validator's recent-status
 *   cache with no finalized record), or reports a different slot than the
 *   one we originally recorded: reorged (the tx we saw is no longer where
 *   we thought it was; never silently finalize a moved/absent tx).
 * - Anything else (still only `confirmed`, or has `err`): stays confirmed;
 *   err is a distinct case the caller should log, but not treated as reorg
 *   here since a failed tx can still be canonically confirmed/finalized.
 */
export function resolveFinality(
  recordedSlot: number,
  status: SignatureStatusLike | null
): FinalityStatus {
  if (status === null) {
    return 'reorged';
  }
  if (status.slot !== recordedSlot) {
    return 'reorged';
  }
  if (status.confirmationStatus === 'finalized') {
    return 'finalized';
  }
  return 'confirmed';
}

/** Tracks signatures pending a finality re-check, keyed by signature. */
export class FinalityTracker {
  private readonly pending = new Map<string, number>(); // signature -> recorded slot

  track(signature: string, slot: number): void {
    if (!this.pending.has(signature)) {
      this.pending.set(signature, slot);
    }
  }

  untrack(signature: string): void {
    this.pending.delete(signature);
  }

  /** Signatures whose recorded slot is now old enough to re-check against the given tip. */
  due(tipSlot: number, depth = FINALITY_SLOT_DEPTH): Array<{ signature: string; slot: number }> {
    const out: Array<{ signature: string; slot: number }> = [];
    for (const [signature, slot] of this.pending) {
      if (isDueForFinalityCheck(slot, tipSlot, depth)) {
        out.push({ signature, slot });
      }
    }
    return out;
  }

  size(): number {
    return this.pending.size;
  }
}
