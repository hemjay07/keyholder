// Re-reads every step's block time from chain (getBlockTime by slot) and
// reports it against data/drift-2026/timeline.json. Found 2026-09-27: the
// file's `blockTime` and `blockTimeIso` disagree with each other on every
// step and `blockTime` is not even monotonic in slot, so neither was read
// from chain. With --write, both fields are replaced by the chain's value.
//   npx tsx src/replay/fix-timeline-times.ts [--write]

import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { Connection } from '@solana/web3.js';
import { resolveRpcEndpoints, withRedaction } from '../ingest/rpc';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env'), quiet: true });

interface Step { step: number; slot: number; blockTime: number; blockTimeIso: string; [k: string]: unknown }

const TIMELINE = join(__dirname, '..', '..', '..', '..', 'data', 'drift-2026', 'timeline.json');

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const { httpUrl } = resolveRpcEndpoints();
  const connection = new Connection(httpUrl, 'confirmed');
  const steps = JSON.parse(readFileSync(TIMELINE, 'utf8')) as Step[];

  for (const s of steps) {
    const chain = await withRedaction(() => connection.getBlockTime(s.slot));
    if (chain == null) throw new Error(`no block time on chain for slot ${s.slot} (step ${s.step})`);
    const iso = new Date(chain * 1000).toISOString().replace('.000Z', 'Z');
    console.log([s.step, s.slot, 'file', s.blockTime, s.blockTimeIso, 'chain', chain, iso].join(' '));
    s.blockTime = chain;
    s.blockTimeIso = iso;
    await new Promise((r) => setTimeout(r, 300));
  }

  const sorted = [...steps].sort((a, b) => a.slot - b.slot);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].blockTime < sorted[i - 1].blockTime) throw new Error(`chain times not monotonic at step ${sorted[i].step}`);
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
