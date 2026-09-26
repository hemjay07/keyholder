// File: apps/worker/src/state-builder/authority.ts
// [TESTED against real mainnet bytes via mocked Connection — see
// authority.test.ts; live end-to-end run in seed.ts's script output]
//
// Task 3.1: classify a program's upgrade authority into the risk package's
// `AuthorityKind`, live. Builds on the already-tested primitives in
// @keyholder/decoder (parseProgramData, parseSquadsV4Multisig,
// resolveSquadsVault) and mirrors apps/worker/src/ingest/registry.ts's
// pattern, but is more conservative about what it calls "resolved":
// registry.ts's `resolveControlAccounts` labels a no-candidate authority
// 'wallet' outright; here, absent a known candidate multisig, we cannot
// actually tell a single-key wallet apart from an unresolved Squads vault
// PDA (both are system-owned, typically zero-data accounts on-chain) — see
// registry.ts's own DEV-030 note. That case is reported honestly as
// `single_key_or_vault_unresolved`, never guessed at as either extreme.

import { PublicKey, type Connection } from '@solana/web3.js';
import {
  parseProgramData,
  parseSquadsV4Multisig,
  resolveSquadsVault,
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  SQUADS_V4_PROGRAM_ID,
} from '@keyholder/decoder';
import type { AuthorityKind, ControlState } from '@keyholder/risk';

export interface AuthorityTarget {
  programId: string;
  /** Multisig addresses independently confirmed (not guessed) to control this program, if any. */
  candidateMultisigs?: string[];
}

export interface ResolvedAuthority {
  programDataAddr: string;
  upgradeAuthority: string | null;
  authorityKind: AuthorityKind;
  multisig: ControlState['multisig'];
}

function deriveProgramDataAddress(programId: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [new PublicKey(programId).toBuffer()],
    new PublicKey(BPF_LOADER_UPGRADEABLE_PROGRAM_ID)
  );
  return pda.toBase58();
}

/**
 * Reads ProgramData live, resolves and classifies the upgrade authority.
 * Read-only: makes no DB writes (see seed.ts for the write path).
 */
export async function resolveAuthority(connection: Connection, target: AuthorityTarget): Promise<ResolvedAuthority> {
  const programDataAddr = deriveProgramDataAddress(target.programId);
  const info = await connection.getAccountInfo(new PublicKey(programDataAddr));
  if (!info) {
    throw new Error(`ProgramData account not found for ${target.programId} (${programDataAddr})`);
  }
  const parsed = parseProgramData(info.data);
  const upgradeAuthority = parsed.upgradeAuthority;

  if (!upgradeAuthority) {
    return { programDataAddr, upgradeAuthority: null, authorityKind: 'immutable', multisig: null };
  }

  // (a) Authority set directly to a Squads v4 Multisig account (not a vault PDA).
  const authorityInfo = await connection.getAccountInfo(new PublicKey(upgradeAuthority));
  if (authorityInfo && authorityInfo.owner.toBase58() === SQUADS_V4_PROGRAM_ID) {
    try {
      const multisig = parseSquadsV4Multisig(authorityInfo.data);
      return {
        programDataAddr,
        upgradeAuthority,
        authorityKind: 'squads_v4_direct',
        multisig: {
          address: upgradeAuthority,
          threshold: multisig.threshold,
          memberCount: multisig.members.length,
          timeLockS: multisig.timeLock,
          configAuthority: multisig.configAuthority,
        },
      };
    } catch {
      // Owned by the Squads program but not a Multisig account layout (e.g. a Proposal/VaultTransaction PDA) — fall through.
    }
  }

  // (b) Resolve as a Squads vault PDA against known candidate multisigs.
  const candidates = target.candidateMultisigs ?? [];
  const resolved = candidates.length > 0 ? resolveSquadsVault(upgradeAuthority, candidates) : null;
  if (resolved) {
    const multisigInfo = await connection.getAccountInfo(new PublicKey(resolved.multisig));
    if (!multisigInfo) {
      throw new Error(`multisig account not found: ${resolved.multisig}`);
    }
    const multisig = parseSquadsV4Multisig(multisigInfo.data);
    return {
      programDataAddr,
      upgradeAuthority,
      authorityKind: 'squads_vault',
      multisig: {
        address: resolved.multisig,
        threshold: multisig.threshold,
        memberCount: multisig.members.length,
        timeLockS: multisig.timeLock,
        configAuthority: multisig.configAuthority,
      },
    };
  }

  // (c) No known candidate resolved it — honestly ambiguous (could be a
  // plain wallet key, or a Squads vault whose controlling multisig we don't
  // have on file to check against).
  return {
    programDataAddr,
    upgradeAuthority,
    authorityKind: 'single_key_or_vault_unresolved',
    multisig: null,
  };
}
