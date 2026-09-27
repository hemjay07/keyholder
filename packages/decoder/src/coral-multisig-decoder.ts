// File: packages/decoder/src/coral-multisig-decoder.ts
// [TESTED against real mainnet bytes, 2026-09-27: Marinade's upgrade
// authority, see coral-multisig-decoder.test.ts.]
//
// The Anchor multisig of the coral-xyz/multisig layout, deployed at
// msigmtwz…Xdt. Found controlling Marinade: its July 2026 upgrade
// (wyCLBNG7…) was executed by this program, and the account's signer PDA is
// Marinade's upgrade authority. The program has no timelock field: an
// approved transaction executes as soon as the threshold signs.
//
// Account layout (Anchor, `#[account] pub struct Multisig`):
//   [0..8)   discriminator = sha256("account:Multisig")[..8]  (e07479ba44a14fec, matches the chain)
//   [8..12)  owners: Vec<Pubkey> length (u32 LE), then 32 bytes each
//   then     threshold: u64 LE
//   then     nonce: u8           (bump of the signer PDA)
//   then     owner_set_seqno: u32 LE
// Signer PDA = create_program_address([multisig, [nonce]], program).

import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { DiscriminatorMismatchError, TruncatedBufferError } from './errors';

/** Read from the owner field of Marinade's authority multisig on chain, 2026-09-27. */
export const CORAL_MULTISIG_PROGRAM_ID = 'msigmtwzgXJHj2ext4XJjCDmpbcMuufFb5cHuwg6Xdt';

export interface CoralMultisig {
  owners: string[];
  threshold: number;
  nonce: number;
  ownerSetSeqno: number;
}

const DISCRIMINATOR = createHash('sha256').update('account:Multisig').digest().subarray(0, 8);

export function parseCoralMultisig(data: Buffer): CoralMultisig {
  const ctx = 'coral multisig';
  if (data.length < 12) throw new TruncatedBufferError(ctx, 12, data.length);
  const disc = data.subarray(0, 8);
  if (!disc.equals(DISCRIMINATOR)) throw new DiscriminatorMismatchError(ctx, DISCRIMINATOR.toString('hex'), disc.toString('hex'));
  const n = data.readUInt32LE(8);
  const tail = 12 + 32 * n;
  const need = tail + 8 + 1 + 4;
  if (data.length < need) throw new TruncatedBufferError(ctx, need, data.length);
  const owners: string[] = [];
  for (let i = 0; i < n; i++) owners.push(new PublicKey(data.subarray(12 + 32 * i, 44 + 32 * i)).toBase58());
  return {
    owners,
    threshold: Number(data.readBigUInt64LE(tail)),
    nonce: data[tail + 8]!,
    ownerSetSeqno: data.readUInt32LE(tail + 9),
  };
}

/** The PDA that signs for a coral multisig: seeds [multisig, [nonce]]. */
export function coralMultisigSigner(multisig: string, nonce: number): string {
  return PublicKey.createProgramAddressSync(
    [new PublicKey(multisig).toBuffer(), Buffer.from([nonce])],
    new PublicKey(CORAL_MULTISIG_PROGRAM_ID)
  ).toBase58();
}
