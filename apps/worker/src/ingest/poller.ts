// File: apps/worker/src/ingest/poller.ts
//
// WebSocket + polling ingest source — the one that works today on the
// Helius free tier (no LaserStream gRPC needed). Three legs, per this
// task's brief:
//   1. `logsSubscribe` (web3.js `onLogs`) with a `mentions` filter on each
//      watched program ID (BPF Upgradeable Loader, Squads v4, SPL
//      Governance) — real-time notification that *a* tx involving that
//      program landed; the log notification itself carries no
//      instruction data, so on each hit we fetch the full transaction.
//   2. `accountSubscribe` (web3.js `onAccountChange`) on every watched
//      ProgramData and multisig/admin account — real-time notification
//      that a watched account's data changed; same fetch-on-hit pattern,
//      resolved by pulling that account's most recent signature.
//   3. A `getSignaturesForAddress` poll every 30s per watched account —
//      gap reconciliation: catches anything the two subscriptions above
//      missed (dropped WS message, reconnect window, etc).
//
// All three legs converge on the same `handleSignature` path, which is
// itself dedup-safe (dedup.ts's in-memory LRU + the DB's primary key), so
// duplicate delivery across legs is expected and harmless.

import { Connection, PublicKey, type Logs } from '@solana/web3.js';
import { normalizeTransactionResponse } from './normalize';
import { dedupCheck, SignatureLru } from './dedup';
import { shouldKeepCandidate, type FilterConfig } from './filter';
import { FinalityTracker } from './finality';
import type { IngestCandidate } from './types';
import { withRedaction } from './rpc';

export const RECONCILE_POLL_INTERVAL_MS = 30_000;

export interface PollerConfig {
  connection: Connection;
  watchedProgramIds: string[];
  watchedAccounts: string[];
  filter: FilterConfig;
  onCandidate: (candidate: IngestCandidate) => void | Promise<void>;
  onReconcileTick?: (info: { address: string; newSignatures: number }) => void;
  reconcileIntervalMs?: number;
}

export interface PollerHandle {
  stop(): void;
  stats(): PollerStats;
}

export interface PollerStats {
  logsEvents: number;
  accountChangeEvents: number;
  reconcileTicks: number;
  reconcileNewSignatures: number;
  candidatesEmitted: number;
  candidatesFiltered: number;
  fetchErrors: number;
}

/**
 * Starts all three legs and returns a handle to stop them and read live
 * stats (used by the 90s live-check script and by tests with a fake
 * Connection).
 */
export function startPoller(config: PollerConfig): PollerHandle {
  const lru = new SignatureLru();
  const finality = new FinalityTracker();
  const stats: PollerStats = {
    logsEvents: 0,
    accountChangeEvents: 0,
    reconcileTicks: 0,
    reconcileNewSignatures: 0,
    candidatesEmitted: 0,
    candidatesFiltered: 0,
    fetchErrors: 0,
  };

  const seenPerAddress = new Map<string, string | undefined>(); // address -> most recent known signature (for `until`)
  for (const addr of config.watchedAccounts) seenPerAddress.set(addr, undefined);

  async function handleSignature(signature: string, source: IngestCandidate['source']): Promise<void> {
    const { isNew } = dedupCheck(lru, signature);
    if (!isNew) return;
    try {
      const tx = await withRedaction(() =>
        config.connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 })
      );
      if (!tx) return;
      const candidate = normalizeTransactionResponse(signature, tx, source, 'confirmed');
      finality.track(signature, candidate.slot);
      if (shouldKeepCandidate(candidate, config.filter)) {
        stats.candidatesEmitted++;
        await config.onCandidate(candidate);
      } else {
        stats.candidatesFiltered++;
      }
    } catch (err) {
      stats.fetchErrors++;
      throw err;
    }
  }

  const logsSubscriptions: number[] = [];
  for (const programId of config.watchedProgramIds) {
    const pk = new PublicKey(programId);
    const id = config.connection.onLogs(
      pk,
      (logs: Logs) => {
        stats.logsEvents++;
        if (logs.err) return; // failed txs are dropped at ingest per BACKEND.md §2 (failed:false)
        void handleSignature(logs.signature, 'ws').catch(() => {
          /* fetch/decode errors are counted in stats.fetchErrors; never crash the subscription */
        });
      },
      'confirmed'
    );
    logsSubscriptions.push(id);
  }

  const accountSubscriptions: number[] = [];
  for (const address of config.watchedAccounts) {
    const pk = new PublicKey(address);
    const id = config.connection.onAccountChange(
      pk,
      () => {
        stats.accountChangeEvents++;
        // An account-change notification carries the new data, not the
        // signature that produced it. Resolve it via the address's most
        // recent signature rather than guessing from account data.
        void config.connection
          .getSignaturesForAddress(pk, { limit: 1 })
          .then((sigs) => {
            const sig = sigs[0]?.signature;
            if (sig) return handleSignature(sig, 'ws');
          })
          .catch(() => {
            stats.fetchErrors++;
          });
      },
      'confirmed'
    );
    accountSubscriptions.push(id);
  }

  async function reconcileOnce(): Promise<void> {
    for (const address of config.watchedAccounts) {
      try {
        const pk = new PublicKey(address);
        const until = seenPerAddress.get(address);
        const sigs = await withRedaction(() =>
          config.connection.getSignaturesForAddress(pk, { limit: 100, until })
        );
        const first = sigs[0];
        if (first) seenPerAddress.set(address, first.signature);
        let newCount = 0;
        // Oldest-first, so finality/ordering downstream sees monotonic slots.
        for (const info of [...sigs].reverse()) {
          if (info.err) continue;
          const wasNew = !lru.has(info.signature);
          if (wasNew) newCount++;
          await handleSignature(info.signature, 'poller');
        }
        stats.reconcileNewSignatures += newCount;
        config.onReconcileTick?.({ address, newSignatures: newCount });
      } catch (err) {
        stats.fetchErrors++;
      }
    }
    stats.reconcileTicks++;
  }

  const intervalMs = config.reconcileIntervalMs ?? RECONCILE_POLL_INTERVAL_MS;
  // Run once immediately so a short-lived process (e.g. the 90s live-check)
  // still gets a reconciliation pass, then on the interval.
  void reconcileOnce();
  const interval = setInterval(() => void reconcileOnce(), intervalMs);

  return {
    stop(): void {
      clearInterval(interval);
      for (const id of logsSubscriptions) void config.connection.removeOnLogsListener(id);
      for (const id of accountSubscriptions) void config.connection.removeAccountChangeListener(id);
    },
    stats(): PollerStats {
      return { ...stats };
    },
  };
}
