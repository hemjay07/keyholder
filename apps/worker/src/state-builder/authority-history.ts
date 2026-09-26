// File: apps/worker/src/state-builder/authority-history.ts
// [DESIGNED + BUILT; live end-to-end run in seed.ts's output — see this
// task's VERIFY section]
//
// DEV-043 (coordinator review, 2026-09-26): `authority.ts` alone cannot
// distinguish a plain wallet key from an unresolved Squads vault PDA when
// no candidate multisig is already known — both are system-owned, 0-byte
// accounts. This module resolves that ambiguity the way Drift's authority
// was actually resolved: walk the authority's real transaction history
// (`getSignaturesForAddress` -> `getTransaction`), and look for direct
// evidence of who controls it:
//   1. A transaction that invokes Squads v4 (SQDS4ep6...) or Squads v3
//      (SMPLecH...) and carries a program-owned Multisig/`Ms` account in its
//      account list -> parse that account, confirm with
//      resolveSquadsVault/resolveSquadsV3Vault that the authority derives
//      from it as a vault (index 0..3 for v4, 1..4 for v3) -> `squads_vault`.
//   2. A transaction where the authority itself signed a BPF Upgradeable
//      Loader Upgrade/SetAuthority(Checked) instruction, with no Squads
//      program present -> `single_key`, evidenced by that signature.
//   3. The authority account is owned by the SPL Governance (Realms)
//      program -> `spl_gov`.
//   4. No transactions at all -> `unresolved` with a "no history" note and
//      the observed signature count.
//   5. Transactions exist but none of the above matched within the scanned
//      window -> stays `single_key_or_vault_unresolved`, honestly, with the
//      count of signatures actually scanned (never guessed past the real
//      evidence).

import { PublicKey, type Connection, type ParsedTransactionWithMeta, type ConfirmedSignatureInfo } from '@solana/web3.js';
import {
  parseSquadsV4Multisig,
  resolveSquadsVault,
  SQUADS_V4_PROGRAM_ID,
  parseSquadsV3Multisig,
  resolveSquadsV3Vault,
  SQUADS_V3_PROGRAM_ID,
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
} from '@keyholder/decoder';
import { SPL_GOVERNANCE_PROGRAM_ID } from '../ingest/filter';
import type { AuthorityKind, ControlState } from '@keyholder/risk';

export interface HistoricalResolution {
  authorityKind: AuthorityKind;
  multisig: ControlState['multisig'];
  evidenceSignature: string | null;
  evidenceNote: string;
  signaturesScanned: number;
}

function unresolved(signaturesScanned: number, note: string): HistoricalResolution {
  return { authorityKind: 'single_key_or_vault_unresolved', multisig: null, evidenceSignature: null, evidenceNote: note, signaturesScanned };
}

/** Every program-owned account key in a parsed transaction's static + loaded address list. */
function allAccountKeys(tx: ParsedTransactionWithMeta): string[] {
  const msg = tx.transaction.message;
  const keys = msg.accountKeys.map((k) => k.pubkey.toBase58());
  const loaded = tx.meta?.loadedAddresses;
  if (loaded) {
    keys.push(...loaded.writable.map((k) => k.toBase58()), ...loaded.readonly.map((k) => k.toBase58()));
  }
  return keys;
}

function invokesProgram(tx: ParsedTransactionWithMeta, programId: string): boolean {
  const top = tx.transaction.message.instructions.some((ix) => ix.programId.toBase58() === programId);
  const inner = (tx.meta?.innerInstructions ?? []).some((group) =>
    group.instructions.some((ix) => ix.programId.toBase58() === programId)
  );
  return top || inner;
}

function signerAddresses(tx: ParsedTransactionWithMeta): string[] {
  return tx.transaction.message.accountKeys.filter((k) => k.signer).map((k) => k.pubkey.toBase58());
}

/**
 * Try to resolve `authorityAddress` against a Squads program's Multisig
 * account found live in one transaction's account list. Returns null if
 * this transaction doesn't yield a confirmed vault derivation.
 */
async function tryResolveSquadsFromTx(
  connection: Connection,
  authorityAddress: string,
  tx: ParsedTransactionWithMeta,
  signature: string
): Promise<HistoricalResolution | null> {
  const v4Present = invokesProgram(tx, SQUADS_V4_PROGRAM_ID);
  const v3Present = invokesProgram(tx, SQUADS_V3_PROGRAM_ID);
  if (!v4Present && !v3Present) return null;

  for (const key of allAccountKeys(tx)) {
    const info = await connection.getAccountInfo(new PublicKey(key));
    if (!info) continue;

    if (v4Present && info.owner.toBase58() === SQUADS_V4_PROGRAM_ID) {
      try {
        const ms = parseSquadsV4Multisig(info.data);
        const resolved = resolveSquadsVault(authorityAddress, [key], 3);
        if (resolved) {
          return {
            authorityKind: 'squads_vault',
            multisig: {
              address: key,
              threshold: ms.threshold,
              memberCount: ms.members.length,
              timeLockS: ms.timeLock,
              configAuthority: ms.configAuthority,
              programVersion: 'v4',
            },
            evidenceSignature: signature,
            evidenceNote: `resolved via Squads v4 invocation, vault index ${resolved.vaultIndex}`,
            signaturesScanned: 0,
          };
        }
      } catch {
        // owned by the v4 program but not a Multisig-typed account — keep scanning other keys.
      }
    }

    if (v3Present && info.owner.toBase58() === SQUADS_V3_PROGRAM_ID) {
      try {
        const ms = parseSquadsV3Multisig(info.data);
        const resolved = resolveSquadsV3Vault(authorityAddress, [key], 4);
        if (resolved) {
          return {
            authorityKind: 'squads_vault',
            multisig: {
              address: key,
              threshold: ms.threshold,
              memberCount: ms.members.length,
              timeLockS: 0, // v3 has no timelock field — see types.ts's ControlState.multisig doc.
              configAuthority: null, // v3 has no config_authority field.
              programVersion: 'v3',
            },
            evidenceSignature: signature,
            evidenceNote: `resolved via Squads v3 invocation, authority index ${resolved.authorityIndex} (v3 has no timelock/config_authority field)`,
            signaturesScanned: 0,
          };
        }
      } catch {
        // owned by the v3 program but not an Ms-typed account — keep scanning.
      }
    }
  }

  return null;
}

export interface ResolveHistoricallyOptions {
  /** How many recent signatures to scan (task brief: 20-50). */
  limit?: number;
}

/**
 * Resolve a system-owned, zero-data upgrade authority by walking its real
 * transaction history. Read-only — makes no DB writes.
 */
export async function resolveAuthorityHistorically(
  connection: Connection,
  authorityAddress: string,
  opts: ResolveHistoricallyOptions = {}
): Promise<HistoricalResolution> {
  const limit = opts.limit ?? 25;

  // (3) SPL Governance native treasury — a single getAccountInfo check, no history walk needed.
  const authorityInfo = await connection.getAccountInfo(new PublicKey(authorityAddress));
  if (authorityInfo && authorityInfo.owner.toBase58() === SPL_GOVERNANCE_PROGRAM_ID) {
    return {
      authorityKind: 'spl_gov',
      multisig: null,
      evidenceSignature: null,
      evidenceNote: `account owned by SPL Governance (Realms) program ${SPL_GOVERNANCE_PROGRAM_ID}`,
      signaturesScanned: 0,
    };
  }

  let signatures: ConfirmedSignatureInfo[];
  try {
    signatures = await connection.getSignaturesForAddress(new PublicKey(authorityAddress), { limit });
  } catch (err) {
    return unresolved(0, `getSignaturesForAddress failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (signatures.length === 0) {
    return unresolved(0, 'no on-chain history: 0 signatures observed');
  }

  for (const sigInfo of signatures) {
    let tx: ParsedTransactionWithMeta | null;
    try {
      tx = await connection.getParsedTransaction(sigInfo.signature, { maxSupportedTransactionVersion: 0 });
    } catch {
      continue;
    }
    if (!tx) continue;

    // (1) Squads v4/v3 evidence.
    const squadsResolution = await tryResolveSquadsFromTx(connection, authorityAddress, tx, sigInfo.signature);
    if (squadsResolution) {
      return { ...squadsResolution, signaturesScanned: signatures.length };
    }

    // (2) The authority signed a loader Upgrade/SetAuthority(Checked) ix itself, no Squads involved.
    const loaderInvoked = invokesProgram(tx, BPF_LOADER_UPGRADEABLE_PROGRAM_ID);
    const squadsInvoked = invokesProgram(tx, SQUADS_V4_PROGRAM_ID) || invokesProgram(tx, SQUADS_V3_PROGRAM_ID);
    if (loaderInvoked && !squadsInvoked && signerAddresses(tx).includes(authorityAddress)) {
      return {
        authorityKind: 'single_key',
        multisig: null,
        evidenceSignature: sigInfo.signature,
        evidenceNote: 'authority itself signed a BPF Upgradeable Loader instruction directly, no Squads program present',
        signaturesScanned: signatures.length,
      };
    }
  }

  return unresolved(
    signatures.length,
    `${signatures.length} signatures scanned, no Squads vault / direct-loader-signer / governance evidence found`
  );
}
