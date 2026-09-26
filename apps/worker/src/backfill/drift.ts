// Drift March-April 2026 history backfill (Task 2.4, day-2 KILL CHECK).
//
// Pages getSignaturesForAddress backwards (newest -> oldest) for a given
// address, with rate-limiting and 429 backoff, stops once it passes a
// target lower-bound timestamp, and stores every signature-info record
// plus (optionally) the full transaction for signatures that fall inside
// the requested [sinceUnix, untilUnix] window as raw JSON under
// data/drift-2026/<label>/.
//
// This is a research/verification tool, not a production ingest path.
// Real RPC only: no synthetic signatures or transactions are ever written.

import { Connection, PublicKey, type ConfirmedSignatureInfo } from '@solana/web3.js';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import path from 'path';

const RPC_URL = process.env.DRIFT_BACKFILL_RPC ?? 'https://api.mainnet-beta.solana.com';
const PAGE_LIMIT = 1000;
const SLEEP_MS = 800;
const MAX_PAGE_RETRIES = 5;

export interface BackfillTarget {
  label: string;
  address: string;
}

export interface BackfillResult {
  label: string;
  address: string;
  pagesFetched: number;
  totalSignatures: number;
  inRangeSignatures: number;
  oldestBlockTimeSeen: number | null;
  reachedSinceBound: boolean;
  errors: string[];
  txFetchAttempted: number;
  txFetchOk: number;
  txFetchFailed: number;
  failedTxSignatures: string[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Page getSignaturesForAddress backward in time for `address`, from the
 * current tip, until either `maxPages` is hit or the oldest signature in a
 * page is older than `sinceUnix`. Every signature-info record whose
 * blockTime falls in [sinceUnix, untilUnix] is kept; if `fetchTx` is true,
 * the full transaction is also fetched for those and written to disk.
 */
export async function backfillAddress(
  connection: Connection,
  target: BackfillTarget,
  opts: {
    sinceUnix: number;
    untilUnix: number;
    maxPages: number;
    fetchTx: boolean;
    outDir: string;
  },
): Promise<BackfillResult> {
  const { sinceUnix, untilUnix, maxPages, fetchTx, outDir } = opts;
  const pk = new PublicKey(target.address);
  const result: BackfillResult = {
    label: target.label,
    address: target.address,
    pagesFetched: 0,
    totalSignatures: 0,
    inRangeSignatures: 0,
    oldestBlockTimeSeen: null,
    reachedSinceBound: false,
    errors: [],
    txFetchAttempted: 0,
    txFetchOk: 0,
    txFetchFailed: 0,
    failedTxSignatures: [],
  };

  const targetDir = path.join(outDir, target.label);
  mkdirSync(targetDir, { recursive: true });

  const inRangeSigs: ConfirmedSignatureInfo[] = [];
  let before: string | undefined = undefined;

  for (let page = 0; page < maxPages; page++) {
    let batch: ConfirmedSignatureInfo[] | null = null;
    for (let attempt = 0; attempt < MAX_PAGE_RETRIES; attempt++) {
      try {
        batch = await connection.getSignaturesForAddress(pk, { limit: PAGE_LIMIT, before });
        break;
      } catch (e) {
        result.errors.push(`page ${page} attempt ${attempt}: ${(e as Error).message}`);
        await sleep(SLEEP_MS * (attempt + 2));
      }
    }
    if (batch === null) {
      result.errors.push(`page ${page}: gave up after ${MAX_PAGE_RETRIES} retries (persistent 429/error)`);
      break;
    }
    if (batch.length === 0) break;

    result.pagesFetched++;
    result.totalSignatures += batch.length;

    for (const s of batch) {
      if (s.blockTime != null) {
        if (result.oldestBlockTimeSeen === null || s.blockTime < result.oldestBlockTimeSeen) {
          result.oldestBlockTimeSeen = s.blockTime;
        }
        if (s.blockTime >= sinceUnix && s.blockTime <= untilUnix) {
          inRangeSigs.push(s);
          result.inRangeSignatures++;
        }
      }
    }

    const lastEntry = batch[batch.length - 1]!;
    before = lastEntry.signature;
    const lastTime = lastEntry.blockTime ?? 0;
    if (lastTime !== 0 && lastTime < sinceUnix) {
      result.reachedSinceBound = true;
      break;
    }
    await sleep(SLEEP_MS);
  }

  writeFileSync(
    path.join(targetDir, 'signatures-in-range.json'),
    JSON.stringify(inRangeSigs, null, 2),
  );

  if (fetchTx) {
    const txDir = path.join(targetDir, 'transactions');
    mkdirSync(txDir, { recursive: true });
    for (const sigInfo of inRangeSigs) {
      const outFile = path.join(txDir, `${sigInfo.signature}.json`);
      if (existsSync(outFile)) continue; // resumable
      result.txFetchAttempted++;
      try {
        const tx = await connection.getTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (tx === null) {
          result.txFetchFailed++;
          result.failedTxSignatures.push(sigInfo.signature);
        } else {
          writeFileSync(outFile, JSON.stringify(tx, null, 2));
          result.txFetchOk++;
        }
      } catch (e) {
        result.txFetchFailed++;
        result.failedTxSignatures.push(sigInfo.signature);
        result.errors.push(`getTransaction ${sigInfo.signature}: ${(e as Error).message}`);
      }
      await sleep(SLEEP_MS);
    }
  }

  return result;
}

export async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const outDir = path.resolve(process.cwd(), '../../data/drift-2026');

  // Window: March 1, 2026 00:00 UTC - April 3, 2026 00:00 UTC
  const sinceUnix = Math.floor(new Date('2026-03-01T00:00:00Z').getTime() / 1000);
  const untilUnix = Math.floor(new Date('2026-04-03T00:00:00Z').getTime() / 1000);

  const targets: Array<BackfillTarget & { maxPages: number; fetchTx: boolean }> = [
    { label: 'state-account', address: '5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN', maxPages: 20, fetchTx: false },
    { label: 'nonce-member-1', address: '45cZ5Fj97Va5Abipr6NN8Zf1BqZqWneSek1hU5cQRvhw', maxPages: 30, fetchTx: true },
    { label: 'nonce-member-2', address: '39JyWrdbVdRqjzw9yyEjxNtTbTKcTPLdtdCgbz7C7Aq8', maxPages: 30, fetchTx: true },
    { label: 'nonce-attacker-1', address: 'CZRBcHAvXU6TzzjGuG4rT98UuTR7PBUeSGPZRDW5mfYW', maxPages: 10, fetchTx: true },
    { label: 'nonce-attacker-2', address: '48cV6Mw5Y5afT8ofukvtFaMtrsCohHhsv8MfbdW8agh3', maxPages: 10, fetchTx: true },
    { label: 'new-member-nonce', address: '6UJbu9ut5VAsFYQFgPEa5xPfoyF5bB5oi4EknFPvu924', maxPages: 10, fetchTx: true },
    { label: 'cvt-mint', address: 'G84LEhbNMR1yYbHgHbnNYNSK8mpTKcazh5jcW5yMPQKo', maxPages: 30, fetchTx: true },
    { label: 'executor-wallet', address: '55udxhScWQxM7cC9d1NPBQoEDC7B38w81EWKPZsM7ZCW', maxPages: 15, fetchTx: true },
    { label: 'receiving-wallet', address: 'HkGz4KmoZ7Zmk7HN6ndJ31UJ1qZ2qgwQxgVqQwovpZES', maxPages: 15, fetchTx: true },
    { label: 'consolidation-wallet', address: '8ubo4HbWJHKyFJYJc2Gh74dxCP7bN7Fu2Pi13KZ9rGxw', maxPages: 15, fetchTx: true },
  ];

  const results: BackfillResult[] = [];
  for (const t of targets) {
    console.log(`\n--- backfilling ${t.label} (${t.address}) ---`);
    const r = await backfillAddress(connection, t, {
      sinceUnix,
      untilUnix,
      maxPages: t.maxPages,
      fetchTx: t.fetchTx,
      outDir,
    });
    console.log(JSON.stringify(r, null, 2));
    results.push(r);
  }

  writeFileSync(path.join(outDir, 'backfill-summary.json'), JSON.stringify(results, null, 2));
  console.log('\n=== SUMMARY WRITTEN ===', path.join(outDir, 'backfill-summary.json'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
