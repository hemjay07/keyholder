// File: apps/worker/src/ingest/scripts/live-check.ts
//
// Manual, real-network verification for Task 2.3 — NOT part of `pnpm test`
// (a 90-second network-dependent run has no place in the default CI/test
// loop; this is invoked explicitly, per this task's VERIFY instructions).
// It does two things against real mainnet:
//   1. Seeds the Drift registry entry (registry.ts) — a real ProgramData +
//      Squads v4 multisig read.
//   2. Runs the WS+poller ingest source (poller.ts) for 90 seconds and
//      reports counts, including whatever the poller's 30s reconciliation
//      pass found.
//
// Usage: `pnpm --filter @keyholder/worker exec tsx src/ingest/scripts/live-check.ts`
// Requires DATABASE_URL (for the registry seed write) and ~/.helius_key or
// public RPC access. Never prints the Helius key (see rpc.ts's redact()).

import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { Connection } from '@solana/web3.js';
import { initDb } from '../../db';
import { resolveRpcEndpoints, withRedaction } from '../rpc';
import { seedProtocolControlAccounts, VERIFIED_SEED_TARGETS } from '../registry';
import { startPoller } from '../poller';
import { writeCandidate } from '../index';
import { BPF_LOADER_UPGRADEABLE_PROGRAM_ID, SQUADS_V4_PROGRAM_ID } from '@keyholder/decoder';
import { SPL_GOVERNANCE_PROGRAM_ID } from '../filter';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '..', '.env') });

const RUN_MS = 90_000;

async function main(): Promise<void> {
  const db = initDb();
  const { httpUrl, wsUrl, usingHelius } = resolveRpcEndpoints();
  const connection = new Connection(httpUrl, { commitment: 'confirmed', wsEndpoint: wsUrl });
  console.log(`[live-check] RPC source: ${usingHelius ? 'Helius (free tier)' : 'public mainnet-beta'}`);

  console.log('[live-check] seeding Drift registry entry from live mainnet reads...');
  const tipSlot = await withRedaction(() => connection.getSlot('confirmed'));
  const seedResults = [];
  for (const target of VERIFIED_SEED_TARGETS) {
    try {
      const result = await withRedaction(() => seedProtocolControlAccounts(db, connection, target, tipSlot));
      seedResults.push(result);
      console.log(
        `[live-check] seeded ${target.protocolId}: programData=${result.programDataAddr} authorityKind=${result.authorityKind}` +
          (result.multisig
            ? ` multisig=${result.multisig.address} threshold=${result.multisig.threshold} timeLockS=${result.multisig.timeLockS} members=${result.multisig.memberCount}`
            : '')
      );
    } catch (err) {
      console.error(`[live-check] FAILED to seed ${target.protocolId}:`, err instanceof Error ? err.message : err);
    }
  }

  // Per plan/BACKEND.md §2.4: never getSignaturesForAddress-poll a tracked
  // protocol's own program ID directly (millions of user txs); reconcile
  // against its low-volume control accounts (ProgramData, multisig) instead.
  // The program ID still gets real-time coverage via onLogs (watchedProgramIds
  // below) — that leg only fires on a log notification, it never pages history.
  const driftResult = seedResults.find((r) => r.protocolId === 'drift');
  const watchedAccounts = [driftResult?.programDataAddr, driftResult?.multisig?.address].filter(
    (v): v is string => Boolean(v)
  );

  console.log(`[live-check] watched accounts for the 90s reconciliation poll: ${watchedAccounts.join(', ')}`);

  let insertedCount = 0;
  const handle = startPoller({
    connection,
    watchedProgramIds: [
      BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
      SQUADS_V4_PROGRAM_ID,
      SPL_GOVERNANCE_PROGRAM_ID,
      ...VERIFIED_SEED_TARGETS.map((t) => t.programId),
    ],
    watchedAccounts,
    filter: {
      trackedProgramIds: new Set(VERIFIED_SEED_TARGETS.map((t) => t.programId)),
      watchedSigners: new Set(),
    },
    onCandidate: async (candidate) => {
      const wasInserted = await writeCandidate(db, candidate);
      if (wasInserted) insertedCount++;
      console.log(
        `[live-check] candidate kept: ${candidate.signature} slot=${candidate.slot} source=${candidate.source} dbInsert=${wasInserted}`
      );
    },
    onReconcileTick: (info) => {
      console.log(`[live-check] reconcile tick: ${info.address} newSignatures=${info.newSignatures}`);
    },
    reconcileIntervalMs: 30_000,
  });

  console.log(`[live-check] running for ${RUN_MS / 1000}s...`);
  await new Promise((resolve) => setTimeout(resolve, RUN_MS));

  const stats = handle.stats();
  handle.stop();

  console.log('[live-check] FINAL COUNTS', {
    ...stats,
    candidatesWrittenToDb: insertedCount,
  });

  if (stats.candidatesEmitted === 0 && stats.reconcileNewSignatures === 0) {
    console.log(
      '[live-check] no control-plane event occurred on any watched account during this 90s window — reporting honestly, no event injected.'
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[live-check] fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
