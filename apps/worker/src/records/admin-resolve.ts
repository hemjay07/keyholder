// File: apps/worker/src/records/admin-resolve.ts
// Resolve an admin key that is a PDA to the multisig behind it (record v2, design/REVAMP-3.md D2).
// A Squads vault is a PDA of the multisig: v4 seeds ["multisig", ms, "vault", index u8] under SQDS4…,
// v3 seeds ["squad", ms, authority_index u32 LE, "authority"] under SMPLec…. We derive vaults for every
// multisig we already know, and for an unknown PDA we look for a Squads multisig in its own recent
// transactions and test the derivation. Nothing is guessed: a key resolves only when a derivation matches.

import { Connection, PublicKey } from '@solana/web3.js';
import { SQUADS_V4_PROGRAM_ID, SQUADS_V3_PROGRAM_ID } from '@keyholder/decoder';

const V4 = new PublicKey(SQUADS_V4_PROGRAM_ID);
const V3 = new PublicKey(SQUADS_V3_PROGRAM_ID);
const MAX_INDEX = 8;

export interface VaultMatch { vault: string; multisig: string; version: 'v4' | 'v3'; index: number }

export function v4Vault(multisig: string, index: number): string {
  return PublicKey.findProgramAddressSync([Buffer.from('multisig'), new PublicKey(multisig).toBuffer(), Buffer.from('vault'), Buffer.from([index])], V4)[0].toBase58();
}
export function v3Authority(multisig: string, index: number): string {
  const i = Buffer.alloc(4); i.writeUInt32LE(index);
  return PublicKey.findProgramAddressSync([Buffer.from('squad'), new PublicKey(multisig).toBuffer(), i, Buffer.from('authority')], V3)[0].toBase58();
}

/** vault address -> multisig, for every known multisig and vault index 0..MAX_INDEX-1. */
export function vaultIndex(multisigs: { address: string; version: 'v4' | 'v3' | 'coral' | string }[]): Map<string, VaultMatch> {
  const out = new Map<string, VaultMatch>();
  for (const m of multisigs) {
    for (let i = 0; i < MAX_INDEX; i++) {
      if (m.version === 'v4') out.set(v4Vault(m.address, i), { vault: v4Vault(m.address, i), multisig: m.address, version: 'v4', index: i });
      if (m.version === 'v3') out.set(v3Authority(m.address, i + 1), { vault: v3Authority(m.address, i + 1), multisig: m.address, version: 'v3', index: i + 1 });
    }
  }
  return out;
}

/** For a PDA not in the index: find Squads multisig accounts in its recent transactions and test them. */
export async function resolveFromHistory(conn: Connection, key: string, limit = 5): Promise<VaultMatch | null> {
  const sigs = await conn.getSignaturesForAddress(new PublicKey(key), { limit });
  for (const s of sigs) {
    const tx = await conn.getTransaction(s.signature, { maxSupportedTransactionVersion: 1 });
    const keys = tx?.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta?.loadedAddresses }).keySegments().flat() ?? [];
    for (const k of keys) {
      const a = k.toBase58();
      for (let i = 0; i < MAX_INDEX; i++) {
        if (v4Vault(a, i) === key) return { vault: key, multisig: a, version: 'v4', index: i };
        if (v3Authority(a, i + 1) === key) return { vault: key, multisig: a, version: 'v3', index: i + 1 };
      }
    }
  }
  return null;
}
