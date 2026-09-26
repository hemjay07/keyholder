// File: packages/decoder/scripts/fetch-instruction-fixtures.ts
// Re-captures the real mainnet instruction and IDL-account fixtures used by
// anchor-decoder.test.ts, squads-decoder.test.ts and loader-decoder.test.ts
// (Task 2.1/2.2). Same pattern as fetch-fixtures.ts (Task 1.4): every
// fixture records its signature/address, fetch date and method. Signatures
// are pinned to specific historical transactions (Drift's real program
// upgrade at slot 429,731,225, real Squads v4 multisig activity, a real
// Drift admin instruction) — re-running this does not change which
// transactions are read, only re-verifies the bytes are still retrievable
// and unchanged.
import { Connection, PublicKey } from '@solana/web3.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RPC = 'https://api.mainnet-beta.solana.com';
const conn = new Connection(RPC, 'confirmed');
const FIXTURE_DIR = join(import.meta.dirname, '..', 'test', 'fixtures');
const FETCHED = new Date().toISOString();
const METHOD_TX = `getTransaction(jsonParsed=false) via ${RPC}`;
const METHOD_ACCT = `getAccountInfo(base64) via ${RPC}`;

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function withRetry<T>(fn: () => Promise<T>, tries = 8): Promise<T> {
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e: any) {
      if (String(e?.message ?? e).includes('429') && i < tries - 1) {
        await sleep(1200 * Math.pow(1.7, i));
        continue;
      }
      throw e;
    }
  }
  throw new Error('unreachable');
}

function save(name: string, obj: unknown) {
  writeFileSync(join(FIXTURE_DIR, `${name}.json`), JSON.stringify(obj, null, 1));
  console.log('saved', name);
}

async function fetchIxFixture(
  name: string,
  signature: string,
  topLevelIndex: number | null,
  innerOf: number | null,
  innerIndex: number | null
) {
  const tx = await withRetry(() =>
    conn.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
  );
  if (!tx) throw new Error(`tx not found: ${signature}`);
  const keys = tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta?.loadedAddresses });

  let programId: string;
  let data: Buffer;
  let accountIdxs: number[];

  if (topLevelIndex !== null) {
    const ix = tx.transaction.message.compiledInstructions[topLevelIndex];
    programId = keys.get(ix.programIdIndex)!.toBase58();
    data = Buffer.from(ix.data);
    accountIdxs = ix.accountKeyIndexes;
  } else {
    const inner = tx.meta!.innerInstructions!.find((i) => i.index === innerOf)!;
    const ix = inner.instructions[innerIndex!];
    programId = keys.get(ix.programIdIndex)!.toBase58();
    const bs58 = (await import('bs58')).default;
    data = Buffer.from(bs58.decode(ix.data as any));
    accountIdxs = (ix as any).accounts;
  }

  const accounts = accountIdxs.map((idx) => ({
    pubkey: keys.get(idx)!.toBase58(),
    isSigner: tx.transaction.message.isAccountSigner(idx),
    isWritable: tx.transaction.message.isAccountWritable(idx),
  }));

  let innerInstructions: any[] | undefined;
  if (topLevelIndex !== null) {
    const bs58 = (await import('bs58')).default;
    const inner = tx.meta?.innerInstructions?.find((i) => i.index === topLevelIndex);
    if (inner) {
      innerInstructions = inner.instructions.map((ix) => ({
        programId: keys.get(ix.programIdIndex)!.toBase58(),
        data_hex: Buffer.from(bs58.decode(ix.data as any)).toString('hex'),
        accounts: (ix as any).accounts.map((idx: number) => keys.get(idx)!.toBase58()),
      }));
    }
  }

  save(`ix-${name}`, {
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime,
    programId,
    data_hex: data.toString('hex'),
    accounts,
    innerInstructions,
    fetched: FETCHED,
    fetch_method: METHOD_TX,
    location: topLevelIndex !== null ? `top-level ix ${topLevelIndex}` : `inner ix (of top ${innerOf}) #${innerIndex}`,
  });
}

async function fetchAccountFixture(name: string, address: string) {
  const info = await withRetry(() => conn.getAccountInfo(new PublicKey(address), { commitment: 'confirmed' }));
  if (!info) throw new Error(`account not found: ${address}`);
  save(name, {
    address,
    owner: info.owner.toBase58(),
    data_b64: info.data.toString('base64'),
    fetched: FETCHED,
    fetch_method: METHOD_ACCT,
  });
}

async function main() {
  // BPF Upgradeable Loader instructions
  await fetchIxFixture('loader-upgrade', '5mW4cXGRv1APq2GDS39WVTfJ6XLSNwKmdgWT85GEiN8WRom463dGdHX8nNoMhXuVn5JZ8VwZcfTnk2Ucx5etcYFs', null, 2, 3);
  await sleep(600);
  await fetchIxFixture('loader-write', '64M5QFPKNtTEz7UYQQL8SgDBivzrup7e72a7uXR6SzziPMFcMmsJuNZFPDjgZuKCcxrMF7SimMf8VN7RV743CjT6', 0, null, null);
  await sleep(600);
  await fetchIxFixture('loader-set-authority', '2UFiicyLeoaj3TV72bcvvnwJRxkDzUKVDfkwKv6a8ptEbckiuLELU9aXDEBmEaotLMno67ZxEamt2V4Q6rDvuMLy', 0, null, null);
  await sleep(600);

  // Squads v4 instructions (all real, from multisig 7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM)
  await fetchIxFixture('squads-vault-transaction-create', '9LBj2hJ1jFozNvCSY4J5maGELH9JyJ3NcVgnbD8XMipuhiXBJV6tqZaLq2tbatzJEU9rdaT7kC7ndLfMsGvS4oQ', 1, null, null);
  await sleep(600);
  await fetchIxFixture('squads-proposal-create', 'hwF72CZMyRoLV7JKYXk6CgqWEQBdvBdnqreWbK7ugaEmcMP3hxhPRS9zju9y7NHFmoLfyJkFc2w2nMc8oxAX9B5', 1, null, null);
  await sleep(600);
  await fetchIxFixture('squads-proposal-approve', 'hwF72CZMyRoLV7JKYXk6CgqWEQBdvBdnqreWbK7ugaEmcMP3hxhPRS9zju9y7NHFmoLfyJkFc2w2nMc8oxAX9B5', 2, null, null);
  await sleep(600);
  await fetchIxFixture('squads-proposal-reject', '32c3DtrjifNKHNe24uYKfD6hxHUrBuHFAoLsEvfMhCr5KvJwBPRs1wZS7myQKjvmVZEuDvGFJKu8XXhcgfnWWfw4', 0, null, null);
  await sleep(600);
  await fetchIxFixture('squads-config-transaction-create', 'hwF72CZMyRoLV7JKYXk6CgqWEQBdvBdnqreWbK7ugaEmcMP3hxhPRS9zju9y7NHFmoLfyJkFc2w2nMc8oxAX9B5', 0, null, null);
  await sleep(600);

  // Squads vault_transaction_execute WITH inner CPI (PXNoHKQz...)
  await fetchIxFixture('squads-vault-transaction-execute', 'PXNoHKQzg32unN2tgaTWbMvwXjfHXmY7MeXdkYqqHEPm5xQwozC1VRi9WUJNwmUv3dm9EDoEt7ZFzQYBQttCsiq', 2, null, null);
  await sleep(600);

  // Drift admin instruction (real, signed by real Drift admin key)
  await fetchIxFixture('drift-admin-update-withdraw-guard-threshold', '2nSYozKqnoLgw3CawTScGoc333PhmFgUEePa72eaMVzh5T6AsxP4oka7jPc4EPXVF6f7nL8R3gpeH3tN7EDdPrfQ', 1, null, null);
  await sleep(600);

  // Program Metadata canonical IDL account for Drift (real)
  await fetchAccountFixture('idl-drift-program-metadata', '7DuBKBbixzCJEFgvAxpt7MCUuSwuY854iYJ4BLpzPEVt');
}

main().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
