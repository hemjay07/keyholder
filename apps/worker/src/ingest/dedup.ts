// File: apps/worker/src/ingest/dedup.ts
//
// Dedup by signature. raw_tx.signature is the table's primary key
// (apps/worker/src/schema.ts), so the DB is the authoritative dedup point —
// three sources (Yellowstone, WS, poller) racing to insert the same
// signature collapses to one row via `ON CONFLICT (signature) DO NOTHING`.
// This module adds a small in-process LRU in front of that so a hot
// duplicate (all three sources see the same tx within milliseconds) does
// not round-trip to Postgres three times.

export class SignatureLru {
  private readonly seen = new Map<string, true>();
  constructor(private readonly capacity: number = 10_000) {}

  /** Returns true if this signature was already seen (and re-marks it as most-recent). */
  has(signature: string): boolean {
    if (this.seen.has(signature)) {
      this.seen.delete(signature);
      this.seen.set(signature, true);
      return true;
    }
    return false;
  }

  /** Marks a signature as seen, evicting the oldest entry if over capacity. */
  mark(signature: string): void {
    if (this.seen.has(signature)) {
      this.seen.delete(signature);
    }
    this.seen.set(signature, true);
    if (this.seen.size > this.capacity) {
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
  }

  size(): number {
    return this.seen.size;
  }
}

/**
 * Property this enforces: the same tx signature arriving from up to 3
 * independent sources within one process lifetime results in at most one
 * `mark()`-worthy "new" verdict from the in-memory layer, and (via the DB's
 * primary key + ON CONFLICT DO NOTHING in index.ts) exactly one row in
 * raw_tx regardless of process restarts or multiple workers.
 */
export function dedupCheck(lru: SignatureLru, signature: string): { isNew: boolean } {
  if (lru.has(signature)) {
    return { isNew: false };
  }
  lru.mark(signature);
  return { isNew: true };
}
