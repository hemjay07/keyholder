// File: packages/decoder/scripts/fetch-fixtures.ts
// Re-captures the real mainnet fixtures used by src/byte-parser.test.ts.
// Method: getAccountInfo (base64 encoding) against a public Solana RPC
// endpoint. Every fixture records which address it came from, the RPC
// endpoint, the method, and the UTC date it was fetched — this is the
// "fetch-fixtures script (public RPC) that re-captures with date and method
// recorded" required by Task 1.4.
//
// Known real addresses (see evidence/2026-09-26-drift-control-state.md):
//   - dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH  Drift v2 program
//   - 7dLgmtcTavcguNoynVimF9ZNVb13FvhXVRfj2HyrDGaP  its ProgramData account
//   - 8jj7zJgdr5bDndc7evM74FMGwzLPmd4u4QxNzFi1BMai  its upgrade authority
//     (a Squads v4 vault PDA, system-owned, 0 bytes of data)
//   - 7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM  the Squads v4 Multisig
//     that controls that vault (found among the vault's recent txs, not
//     derivable from the vault address alone)

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
const FIXTURE_DIR = join(import.meta.dirname, '..', 'test', 'fixtures');

const TARGETS: Record<string, string> = {
  'drift-program': 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
  'pd': '7dLgmtcTavcguNoynVimF9ZNVb13FvhXVRfj2HyrDGaP',
  'drift-authority': '8jj7zJgdr5bDndc7evM74FMGwzLPmd4u4QxNzFi1BMai',
  'drift-squads-multisig': '7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM',
};

async function main(): Promise<void> {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const fetchedAt = new Date().toISOString();

  for (const [fixtureName, address] of Object.entries(TARGETS)) {
    const pubkey = new PublicKey(address);
    const info = await connection.getAccountInfo(pubkey, { commitment: 'confirmed' });
    const slot = await connection.getSlot('confirmed');

    if (!info) {
      console.error(`${fixtureName} (${address}): account not found`);
      process.exitCode = 1;
      continue;
    }

    const fixture = {
      address,
      owner: info.owner.toBase58(),
      data_b64: info.data.toString('base64'),
      fetched: fetchedAt,
      fetch_method: 'getAccountInfo(base64) via ' + RPC_ENDPOINT,
      slot,
    };

    const outPath = join(FIXTURE_DIR, `${fixtureName}.json`);
    writeFileSync(outPath, JSON.stringify(fixture, null, 1));
    console.log(`Saved ${outPath} (${info.data.length} bytes, owner ${fixture.owner})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
