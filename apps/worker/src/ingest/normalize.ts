// File: apps/worker/src/ingest/normalize.ts
//
// Converts a @solana/web3.js `VersionedTransactionResponse` (from
// `connection.getTransaction`) into an `IngestCandidate`, flattening
// top-level and inner instructions and resolving program IDs and signer
// flags through the message's real account-keys table (including
// address-lookup-table-loaded accounts via `meta.loadedAddresses`, and
// inner-instruction program IDs which are always in that same table).

import type { VersionedTransactionResponse } from '@solana/web3.js';
import type { IngestCandidate, RawInstruction, CommitmentTier } from './types';

export function normalizeTransactionResponse(
  signature: string,
  tx: VersionedTransactionResponse,
  source: IngestCandidate['source'],
  commitment: CommitmentTier
): IngestCandidate {
  const message = tx.transaction.message;
  const accountKeys = message.getAccountKeys({
    accountKeysFromLookups: tx.meta?.loadedAddresses ?? undefined,
  });

  const keyAt = (index: number): string => {
    const pk = accountKeys.get(index);
    return pk ? pk.toBase58() : '';
  };
  const signerAt = (index: number): boolean => {
    try {
      return message.isAccountSigner(index);
    } catch {
      return false;
    }
  };

  const instructions: RawInstruction[] = [];

  for (const ix of message.compiledInstructions) {
    instructions.push({
      programId: keyAt(ix.programIdIndex),
      data: Buffer.from(ix.data),
      accounts: ix.accountKeyIndexes.map((idx) => ({ pubkey: keyAt(idx), isSigner: signerAt(idx) })),
    });
  }

  for (const innerSet of tx.meta?.innerInstructions ?? []) {
    for (const ix of innerSet.instructions) {
      // Inner instructions come back either fully parsed or as
      // PartiallyDecodedInstruction ({programId, data(base58), accounts:[]});
      // getTransaction (non-"jsonParsed") always returns the compiled form.
      const compiled = ix as unknown as { programIdIndex: number; accounts: number[]; data: string };
      instructions.push({
        programId: keyAt(compiled.programIdIndex),
        data: Buffer.from(decodeBase58(compiled.data)),
        accounts: compiled.accounts.map((idx) => ({ pubkey: keyAt(idx), isSigner: signerAt(idx) })),
      });
    }
  }

  return {
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime ? new Date(tx.blockTime * 1000) : null,
    commitment,
    source,
    instructions,
    raw: tx,
  };
}

// Minimal base58 decode kept local so normalize.ts has one obvious
// dependency edge (bs58) rather than re-exporting it; matches the decoder
// package's own bs58 usage.
import bs58 from 'bs58';
function decodeBase58(s: string): Uint8Array {
  return bs58.decode(s);
}
