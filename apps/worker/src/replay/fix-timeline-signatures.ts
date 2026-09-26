// Resolves timeline.json steps whose `signature` field holds a truncated or
// annotated signature ("3pBptza7q... (first failed instr ...)") to the full
// signature, by listing the signatures in that step's block on chain and
// matching the recorded prefix. A step is fixed only on exactly one match;
// otherwise it is reported and left alone. The original text is kept in
// `signatureNote`.
//   npx tsx src/replay/fix-timeline-signatures.ts [--write]

import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { Connection } from '@solana/web3.js';
import { resolveRpcEndpoints, withRedaction } from '../ingest/rpc';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env'), quiet: true });

interface Step { step: number; slot: number; signature: string; signatureNote?: string; [k: string]: unknown }

const TIMELINE = join(__dirname, '..', '..', '..', '..', 'data', 'drift-2026', 'timeline.json');
const FULL_SIG = /^[1-9A-HJ-NP-Za-km-z]{86,88}$/;

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const { httpUrl } = resolveRpcEndpoints();
  const connection = new Connection(httpUrl, 'confirmed');
  const steps = JSON.parse(readFileSync(TIMELINE, 'utf8')) as Step[];

  for (const s of steps) {
    if (FULL_SIG.test(s.signature)) continue;
    // A full signature may already be inside the text (e.g. "24UgR18... / 9zJGhy...").
    const inside = s.signature.match(/[1-9A-HJ-NP-Za-km-z]{86,88}/);
    const prefix = s.signature.match(/^[1-9A-HJ-NP-Za-km-z]+/)?.[0] ?? '';
    // web3.js's getBlock cannot parse transactionDetails: 'signatures'; call the RPC directly.
    const rpc = connection as unknown as { _rpcRequest(method: string, args: unknown[]): Promise<{ result?: { signatures?: string[] }; error?: { message: string } }> };
    const res = await withRedaction(() =>
      rpc._rpcRequest('getBlock', [s.slot, { maxSupportedTransactionVersion: 0, transactionDetails: 'signatures', rewards: false, commitment: 'confirmed' }])
    );
    if (res.error) throw new Error(`getBlock ${s.slot}: ${res.error.message}`);
    const sigs = res.result?.signatures ?? [];
    const matches = sigs.filter((sig) => sig.startsWith(prefix));
    let full: string | null = null;
    if (prefix.length >= 8 && matches.length === 1) full = matches[0]!;
    else if (inside && sigs.includes(inside[0])) full = inside[0];
    console.log([s.step, s.slot, JSON.stringify(s.signature.slice(0, 60)), 'prefix', prefix, 'block sigs', sigs.length, 'matches', matches.length, '->', full ?? 'UNRESOLVED'].join(' '));
    if (full) {
      s.signatureNote = s.signature;
      s.signature = full;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (write) {
    writeFileSync(TIMELINE, JSON.stringify(steps, null, 2) + '\n');
    console.log('written');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
