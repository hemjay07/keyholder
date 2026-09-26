// File: apps/worker/src/runner.ts
//
// Service runner (arch/B-worker.md §2, "Worker Initialization & Service
// Runner" — elided in the doc; designed here per this task's brief). Starts
// every stage of the pipeline in one process, sharing one DB pool and one
// RPC connection:
//   [1. Ingest] (already built, ingest/index.ts) -> raw_tx
//   [2. Decode] (pipeline/decode.ts) -> events, on a poll loop
//   [3. State]  (pipeline/state.ts) -> control_state, for protocols decode just touched
//   [4. Risk]   (pipeline/risk.ts) -> risk_deltas
//   [5. Verification poller] (pipeline/verification.ts), every 6h
//   [6. Alert dispatcher] (pipeline/alerts.ts), LISTEN-driven
//   [7. Attestation writer]: NOT started — the keyholder program is live on
//   devnet (BUILD-REPORT.md Phase 5) but no attester key path is configured
//   for the worker yet. Logged once at startup.
//
// Graceful shutdown: SIGTERM/SIGINT stop the ingest service, clear the
// decode/verification timers, close the alert LISTEN connection, and close
// the DB pool, in that order, then exit(0). The Helius API key is never
// logged — every log call that might carry an RPC error message is routed
// through ingest/rpc.ts's `redact()`.

import * as dotenv from 'dotenv';
import { join } from 'node:path';
import pino from 'pino';
import { Connection } from '@solana/web3.js';
import { eq } from 'drizzle-orm';
import { initDb, type Db } from './db';
import { programs, authorities, multisigs } from './schema';
import { startIngestService, type IngestService } from './ingest/index';
import { resolveRpcEndpoints, redact } from './ingest/rpc';
import { createIdlCache } from './pipeline/idl-cache';
import { buildProtocolIndex, type ProtocolIndex } from './pipeline/protocol-index';
import { runDecodeStage } from './pipeline/decode';
import { refreshProtocolState } from './pipeline/state';
import { runRiskStage } from './pipeline/risk';
import { runVerificationPoll } from './pipeline/verification';
import { startAlertListener, type AlertListenerHandle } from './pipeline/alerts';

dotenv.config({ path: join(__dirname, '..', '..', '..', '.env') });

const DECODE_INTERVAL_MS = Number(process.env.DECODE_INTERVAL_MS ?? 5_000);
const PROTOCOL_INDEX_REFRESH_MS = Number(process.env.PROTOCOL_INDEX_REFRESH_MS ?? 2 * 60_000);
const VERIFICATION_POLL_INTERVAL_MS = Number(process.env.VERIFICATION_POLL_INTERVAL_MS ?? 6 * 60 * 60_000);

const pinoLogger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

/** Wraps pino so every logged string/meta value is redacted before it leaves the process. */
function redactMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return meta;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) out[k] = typeof v === 'string' ? redact(v) : v;
  return out;
}

const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => pinoLogger.info(redactMeta(meta) ?? {}, redact(msg)),
  warn: (msg: string, meta?: Record<string, unknown>) => pinoLogger.warn(redactMeta(meta) ?? {}, redact(msg)),
  error: (msg: string, meta?: Record<string, unknown>) => pinoLogger.error(redactMeta(meta) ?? {}, redact(msg)),
};

async function gatherWatchedAccounts(db: Db): Promise<{ watchedAccounts: string[]; trackedProgramIds: Set<string> }> {
  const [programRows, authorityRows, multisigRows] = await Promise.all([
    db.select({ program_id: programs.program_id, programdata_addr: programs.programdata_addr }).from(programs).where(eq(programs.tracked, true)),
    db.select({ address: authorities.address }).from(authorities),
    db.select({ address: multisigs.address }).from(multisigs),
  ]);

  const accounts = new Set<string>();
  for (const row of programRows) if (row.programdata_addr) accounts.add(row.programdata_addr);
  for (const row of authorityRows) accounts.add(row.address);
  for (const row of multisigRows) accounts.add(row.address);

  return { watchedAccounts: [...accounts], trackedProgramIds: new Set(programRows.map((r) => r.program_id)) };
}

export interface RunnerHandle {
  stop(): Promise<void>;
}

export async function startRunner(): Promise<RunnerHandle> {
  const db = initDb();
  const { httpUrl, wsUrl, usingHelius } = resolveRpcEndpoints();
  const connection = new Connection(httpUrl, { commitment: 'confirmed', wsEndpoint: wsUrl });
  logger.info('runner starting', { usingHelius });

  const { watchedAccounts, trackedProgramIds } = await gatherWatchedAccounts(db);
  logger.info('watched accounts loaded', { count: watchedAccounts.length, trackedPrograms: trackedProgramIds.size });

  const ingest: IngestService = startIngestService({ db, watchedAccounts, trackedProgramIds, logger });

  const idlCache = createIdlCache(connection);
  const protocolIndexRef = { current: await buildProtocolIndex(db) };
  const protocolIndexInterval = setInterval(() => {
    void buildProtocolIndex(db)
      .then((index) => {
        protocolIndexRef.current = index;
      })
      .catch((err) => logger.warn('protocol index refresh failed', { error: err instanceof Error ? err.message : String(err) }));
  }, PROTOCOL_INDEX_REFRESH_MS);

  // One decode tick at a time: under RPC backoff a tick can outlast the
  // interval, and overlapping ticks raced on the same protocol (2026-09-26).
  let decodeRunning = false;
  const decodeInterval = setInterval(() => {
    if (decodeRunning) return;
    decodeRunning = true;
    void (async () => {
      try {
        const decodeResult = await runDecodeStage({ db, connection, idlCache, protocolIndex: protocolIndexRef.current, logger });
        if (decodeResult.rawTxProcessed > 0) logger.info('decode tick', decodeResult as unknown as Record<string, unknown>);

        if (decodeResult.protocolIdsTouched.length > 0) {
          const tipSlot = await connection.getSlot('confirmed');
          for (const protocolId of decodeResult.protocolIdsTouched) {
            try {
              const stateResult = await refreshProtocolState(db, connection, protocolId, tipSlot, logger);
              if (stateResult.wrote) {
                const riskResult = await runRiskStage(db, protocolId, tipSlot, stateResult.before, stateResult.after);
                if (riskResult.deltasInserted > 0) logger.info('risk deltas inserted', { ...riskResult });
              }
            } catch (err) {
              logger.error('state/risk stage failed for protocol', { protocolId, error: err instanceof Error ? err.message : String(err) });
            }
          }
        }
      } catch (err) {
        logger.error('decode tick failed', { error: err instanceof Error ? err.message : String(err) });
      }
    })().finally(() => {
      decodeRunning = false;
    });
  }, DECODE_INTERVAL_MS);

  const verificationInterval = setInterval(() => {
    void (async () => {
      try {
        const tipSlot = await connection.getSlot('confirmed');
        const result = await runVerificationPoll(db, connection, tipSlot, logger);
        logger.info('verification poll complete', result as unknown as Record<string, unknown>);
      } catch (err) {
        logger.error('verification poll failed', { error: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, VERIFICATION_POLL_INTERVAL_MS);

  const databaseUrl = process.env.DATABASE_URL;
  let alertListener: AlertListenerHandle | null = null;
  if (databaseUrl) {
    alertListener = startAlertListener(databaseUrl, logger);
    logger.info('alert listener started (LISTEN risk_delta_created)');
  } else {
    logger.warn('DATABASE_URL not set; alert listener not started');
  }

  // Attestation writer (arch §11): not started. Devnet deploy is blocked
  // (BUILD-REPORT.md DEV-063: deployer wallet unfunded, faucet refused) and
  // no attester key path is configured for this environment — see this
  // task's DEV entries. Logged once, honestly, rather than started against
  // an unconfirmed target.
  logger.warn('attestation writer NOT started: no attester key path configured for the worker (program is live on devnet)');

  let stopping = false;
  async function stop(): Promise<void> {
    if (stopping) return;
    stopping = true;
    logger.info('runner stopping');
    ingest.stop();
    clearInterval(decodeInterval);
    clearInterval(verificationInterval);
    clearInterval(protocolIndexInterval);
    if (alertListener) await alertListener.stop();
    logger.info('runner stopped');
  }

  return { stop };
}

/* c8 ignore start -- process entrypoint, not unit tested */
if (require.main === module) {
  void (async () => {
    const handle = await startRunner();
    let shuttingDown = false;
    const shutdown = (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info(`received ${signal}, shutting down`);
      void handle.stop().then(() => process.exit(0));
    };
    // A transient RPC failure (a free-tier 429) in any un-awaited promise must
    // not take the whole worker down; it crashed the runner on 2026-09-26.
    process.on('unhandledRejection', (reason) => {
      logger.error('unhandled rejection (worker kept running)', { error: reason instanceof Error ? reason.message : String(reason) });
    });
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })().catch((err) => {
    logger.error('runner failed to start', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
}
/* c8 ignore stop */
