// File: packages/decoder/src/squads-v3-decoder.test.ts
// Layout-correct synthetic bytes (per squads-v3-decoder.ts's file header: no
// real on-chain v3 fixture was found among the 15 tracked programs this
// session — this is the same honest UNTESTED-against-a-real-fixture
// labeling as system-decoder.ts's DEV-008), built field-by-field from the
// real, published `Ms` struct layout.

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  parseSquadsV3Multisig,
  deriveSquadsV3VaultPda,
  resolveSquadsV3Vault,
  SQUADS_V3_PROGRAM_ID,
} from './squads-v3-decoder';

function buildV3MultisigBuffer(threshold: number, createKey: PublicKey, members: PublicKey[], allowExternalExecute = false): Buffer {
  const disc = createHash('sha256').update('account:Ms').digest().subarray(0, 8);
  const head = Buffer.alloc(58);
  disc.copy(head, 0);
  head.writeUInt16LE(threshold, 8);
  head.writeUInt16LE(1, 10); // authority_index
  head.writeUInt32LE(5, 12); // transaction_index
  head.writeUInt32LE(2, 16); // ms_change_index
  head.writeUInt8(255, 20); // bump
  createKey.toBuffer().copy(head, 21);
  head.writeUInt8(allowExternalExecute ? 1 : 0, 53);
  head.writeUInt32LE(members.length, 54);
  const memberBytes = Buffer.concat(members.map((m) => m.toBuffer()));
  return Buffer.concat([head, memberBytes]);
}

describe('parseSquadsV3Multisig', () => {
  it('happy: parses threshold, indices, create_key and members from a real-layout buffer', () => {
    const createKey = Keypair.generate().publicKey;
    const members = [Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate().publicKey];
    const buf = buildV3MultisigBuffer(2, createKey, members);
    const parsed = parseSquadsV3Multisig(buf);
    expect(parsed.threshold).toBe(2);
    expect(parsed.authorityIndex).toBe(1);
    expect(parsed.transactionIndex).toBe(5);
    expect(parsed.msChangeIndex).toBe(2);
    expect(parsed.createKey).toBe(createKey.toBase58());
    expect(parsed.members).toEqual(members.map((m) => m.toBase58()));
    expect(parsed.allowExternalExecute).toBe(false);
  });

  it('edge: zero members parses to an empty array, not an error', () => {
    const buf = buildV3MultisigBuffer(1, Keypair.generate().publicKey, []);
    const parsed = parseSquadsV3Multisig(buf);
    expect(parsed.members).toEqual([]);
  });

  it('error: wrong discriminator throws DiscriminatorMismatchError', () => {
    const buf = buildV3MultisigBuffer(2, Keypair.generate().publicKey, [Keypair.generate().publicKey]);
    buf.writeUInt8(buf.readUInt8(0) ^ 0xff, 0); // corrupt the discriminator's first byte
    expect(() => parseSquadsV3Multisig(buf)).toThrow(/discriminator/i);
  });

  it('error: truncated buffer throws TruncatedBufferError rather than reading garbage', () => {
    const buf = buildV3MultisigBuffer(2, Keypair.generate().publicKey, [Keypair.generate().publicKey]);
    expect(() => parseSquadsV3Multisig(buf.subarray(0, 40))).toThrow(/58 bytes|truncated/i);
  });
});

describe('resolveSquadsV3Vault', () => {
  it('happy: resolves a vault PDA to its multisig at authority index 1 (the default vault)', () => {
    const multisigPk = Keypair.generate().publicKey;
    const vaultPda = deriveSquadsV3VaultPda(multisigPk, 1, new PublicKey(SQUADS_V3_PROGRAM_ID));
    const resolved = resolveSquadsV3Vault(vaultPda.toBase58(), [multisigPk.toBase58()]);
    expect(resolved).toEqual({ multisig: multisigPk.toBase58(), authorityIndex: 1 });
  });

  it('edge: resolves a non-default authority index (2)', () => {
    const multisigPk = Keypair.generate().publicKey;
    const vaultPda = deriveSquadsV3VaultPda(multisigPk, 2, new PublicKey(SQUADS_V3_PROGRAM_ID));
    const resolved = resolveSquadsV3Vault(vaultPda.toBase58(), [multisigPk.toBase58()], 4);
    expect(resolved?.authorityIndex).toBe(2);
  });

  it('error: no candidate multisig derives the given vault -> null, not a guess', () => {
    const unrelated = Keypair.generate().publicKey;
    const resolved = resolveSquadsV3Vault(unrelated.toBase58(), [Keypair.generate().publicKey.toBase58()]);
    expect(resolved).toBeNull();
  });
});
