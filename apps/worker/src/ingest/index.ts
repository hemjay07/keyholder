// File: apps/worker/src/ingest/index.ts
//
// Ingest orchestrator (Task 2.3): wires the poller source (works today) and
// the Yellowstone source (disabled until YELLOWSTONE_TOKEN exists) into the
// shared filter -> dedup -> raw_tx write path, and runs the finality sweep
// (confirmed -> finalized, per finality.ts) on an interval.

import { Connection } from '@solana/web3.js';
import { sql } from 'drizzle-orm';
import type { Db } from '../db';
import { raw_tx } from '../schema';
import { resolveRpcEndpoints } from './rpc';
import { startPoller, type PollerHandle, type PollerStats } from './poller';
import {
  resolveYellowstoneConfig,
  connectYellowstone,
  normalizeYellowstoneUpdate,
  YellowstoneDisabledError,
} from './yellowstone';
import { shouldKeepCandidate, SPL_GOVERNANCE_PROGRAM_ID, type FilterConfig } from './filter';
import { FinalityTracker, resolveFinality, type SignatureStatusLike } from './finality';
import type { IngestCandidate } from './types';
import { BPF_LOADER_UPGRADEABLE_PROGRAM_ID, SQUADS_V4_PROGRAM_ID } from '@keyholder/decoder';

export interface IngestLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

const consoleLogger: IngestLogger = {
  info: (msg, meta) => console.log(`[ingest] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[ingest] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[ingest] ${msg}`, meta ?? ''),
};

/** JSON-safe serialization for the raw_tx.tx bytea column: BigInt -> string, everything else as-is. */
function serializeRaw(raw: unknown): Buffer {
  return Buffer.from(
    JSON.stringify(raw, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)) ?? 'null',
    'utf8'
  );
}

export async function writeCandidate(db: Db, candidate: IngestCandidate): Promise<boolean> {
  const rows = await db
    .insert(raw_tx)
    .values({
      signature: candidate.signature,
      slot: candidate.slot,
      block_time: candidate.blockTime ?? new Date(),
      commitment: candidate.commitment,
      source: candidate.source,
      tx: serializeRaw(candidate.raw),
      status: 'pending',
    })
    .onConflictDoNothing({ target: raw_tx.signature })
    .returning({ signature: raw_tx.signature });
  return rows.length > 0;
}

export interface IngestServiceConfig {
  db: Db;
  watchedAccounts: string[];
  trackedProgramIds?: Set<string>;
  watchedSigners?: Set<string>;
  logger?: IngestLogger;
  reconcileIntervalMs?: number;
  finalitySweepIntervalMs?: number;
}

export interface IngestService {
  stop(): void;
  pollerStats(): PollerStats | null;
}

const BASE_WATCHED_PROGRAMS = [
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  SQUADS_V4_PROGRAM_ID,
  SPL_GOVERNANCE_PROGRAM_ID,
];

export function startIngestService(config: IngestServiceConfig): IngestService {
  const logger = config.logger ?? consoleLogger;
  const { httpUrl, wsUrl, usingHelius } = resolveRpcEndpoints();
  logger.info('starting ingest service', { usingHelius, watchedAccounts: config.watchedAccounts.length });

  const connection = new Connection(httpUrl, { commitment: 'confirmed', wsEndpoint: wsUrl });

  const filterConfig: FilterConfig = {
    trackedProgramIds: config.trackedProgramIds ?? new Set(),
    watchedSigners: config.watchedSigners ?? new Set(),
  };

  const finalityTracker = new FinalityTracker();

  const poller: PollerHandle = startPoller({
    connection,
    watchedProgramIds: BASE_WATCHED_PROGRAMS,
    watchedAccounts: config.watchedAccounts,
    filter: filterConfig,
    onCandidate: async (candidate) => {
      const inserted = await writeCandidate(config.db, candidate);
      finalityTracker.track(candidate.signature, candidate.slot);
      if (inserted) logger.info('raw_tx inserted', { signature: candidate.signature, source: candidate.source });
    },
  });

  // Yellowstone: disabled until YELLOWSTONE_TOKEN is provisioned. Logged
  // clearly once at startup; never silently replaced with a mock.
  try {
    resolveYellowstoneConfig([...BASE_WATCHED_PROGRAMS, ...config.watchedAccounts]);
    logger.warn('YELLOWSTONE_TOKEN present but connectYellowstone() is not auto-started by this task — wire in once verified live');
  } catch (err) {
    if (err instanceof YellowstoneDisabledError) {
      logger.warn(`Yellowstone stream DISABLED: ${err.message}`);
    } else {
      throw err;
    }
  }

  const finalitySweepMs = config.finalitySweepIntervalMs ?? 15_000;
  const finalityInterval = setInterval(() => {
    void sweepFinality(config.db, connection, finalityTracker, logger);
  }, finalitySweepMs);

  return {
    stop(): void {
      poller.stop();
      clearInterval(finalityInterval);
    },
    pollerStats(): PollerStats | null {
      return poller.stats();
    },
  };
}

export async function sweepFinality(
  db: Db,
  connection: Connection,
  tracker: FinalityTracker,
  logger: IngestLogger
): Promise<void> {
  const tipSlot = await connection.getSlot('confirmed');
  const due = tracker.due(tipSlot);
  if (due.length === 0) return;

  const signatures = due.map((d) => d.signature);
  const { value: statuses } = await connection.getSignatureStatuses(signatures);

  for (let i = 0; i < due.length; i++) {
    const entry = due[i];
    if (!entry) continue;
    const { signature, slot } = entry;
    const raw = statuses[i];
    const statusLike: SignatureStatusLike | null = raw
      ? { slot: raw.slot, confirmationStatus: raw.confirmationStatus ?? null, err: raw.err }
      : null;
    const verdict = resolveFinality(slot, statusLike);
    tracker.untrack(signature);

    if (verdict === 'finalized') {
      await db.execute(
        sql`UPDATE raw_tx SET commitment = 'finalized' WHERE signature = ${signature} AND commitment <> 'finalized'`
      );
    } else if (verdict === 'reorged') {
      logger.warn('signature reorged or dropped on finality re-check', { signature, recordedSlot: slot });
      await db.execute(
        sql`UPDATE raw_tx SET status = 'reorged' WHERE signature = ${signature}`
      );
    }
    // 'confirmed': left as-is; re-tracked implicitly if it reappears via a source.
  }
}
