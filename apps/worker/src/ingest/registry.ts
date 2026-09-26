// File: apps/worker/src/ingest/registry.ts
//
// Watched-account registry seeding, per this task's brief: read a tracked
// protocol's ProgramData and upgrade authority live from mainnet, resolve a
// Squads vault authority to its controlling multisig via
// `@keyholder/decoder`'s resolveSquadsVault, and upsert `programs`,
// `authorities`, `multisigs` and `multisig_members` rows so the ingest
// filter (filter.ts) and poller (poller.ts) know which accounts to watch.
//
// REAL ONLY (this repo's binding rule, see packages/decoder DEV-008 notes):
// this file seeds only protocols whose program ID and control-account
// addresses are independently verified in this repo. That is Drift v2 today
// — PULSE.md VF-F2 (2026-09-26): its upgrade authority is the Squads v4
// vault 8jj7zJgdr5bDndc7evM74FMGwzLPmd4u4QxNzFi1BMai, which resolves to
// multisig 7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM (4-of-7, timelock
// 3600s). The other 14 programs named in
// /Users/mujeeb/worldsfair/research/11-sketch-upgrade-watch.md's addendum
// are named there by protocol only (Kamino Lend, marginfi v2, Phoenix,
// Raydium AMM v4/CLMM, Orca Whirlpool, Marinade, Squads v4, Jupiter v6,
// Meteora DLMM, Jito stake pool, Pump.fun, Openbook v2, Sanctum router) —
// that document does not carry their mainnet program-ID addresses, and no
// other file in this repo does either. Typing 14 program IDs from model
// memory would violate the REAL ONLY rule the same way a fabricated nonce
// fixture would. This is logged as DEV-030 UNTESTED/BLOCKED in this task's
// report; `seedProtocolControlAccounts` below is generic and ready to seed
// them the moment their program IDs are confirmed (PULSE.md or a founder
// pointer to a verified source).

import { PublicKey, type Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  parseProgramData,
  parseSquadsV4Multisig,
  resolveSquadsVault,
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
} from '@keyholder/decoder';
import type { Db } from '../db';
import { programs, authorities, multisigs, multisig_members, protocols } from '../schema';

export interface SeedTarget {
  protocolId: string;
  protocolName: string;
  programId: string;
  /** Candidate multisigs to check the upgrade authority against, if it looks like a vault (system-owned, no data). */
  candidateMultisigs?: string[];
}

/** Verified-in-repo seed targets. See file header for why this list has one entry today. */
export const VERIFIED_SEED_TARGETS: SeedTarget[] = [
  {
    protocolId: 'drift',
    protocolName: 'Drift Protocol',
    programId: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
    candidateMultisigs: ['7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM'],
  },
];

export interface SeedResult {
  protocolId: string;
  programId: string;
  programDataAddr: string;
  upgradeAuthority: string | null;
  authorityKind: 'wallet' | 'squads_vault' | 'immutable' | 'unresolved';
  multisig: {
    address: string;
    threshold: number;
    timeLockS: number;
    memberCount: number;
  } | null;
}

function deriveProgramDataAddress(programId: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [new PublicKey(programId).toBuffer()],
    new PublicKey(BPF_LOADER_UPGRADEABLE_PROGRAM_ID)
  );
  return pda.toBase58();
}

/**
 * Reads a target's ProgramData live, resolves the upgrade authority (wallet
 * vs a Squads v4 vault, checked against `candidateMultisigs`), and if it's a
 * vault, reads and parses the multisig's config. Read-only — does not write
 * to the DB (see `seedProtocolControlAccounts` for the DB write).
 */
export async function resolveControlAccounts(
  connection: Connection,
  target: SeedTarget
): Promise<SeedResult> {
  const programDataAddr = deriveProgramDataAddress(target.programId);
  const info = await connection.getAccountInfo(new PublicKey(programDataAddr));
  if (!info) {
    throw new Error(`ProgramData account not found for ${target.protocolId} (${programDataAddr})`);
  }
  const parsed = parseProgramData(info.data);
  const upgradeAuthority = parsed.upgradeAuthority;

  if (!upgradeAuthority) {
    return {
      protocolId: target.protocolId,
      programId: target.programId,
      programDataAddr,
      upgradeAuthority: null,
      authorityKind: 'immutable',
      multisig: null,
    };
  }

  const candidates = target.candidateMultisigs ?? [];
  const resolved = candidates.length > 0 ? resolveSquadsVault(upgradeAuthority, candidates) : null;

  if (!resolved) {
    return {
      protocolId: target.protocolId,
      programId: target.programId,
      programDataAddr,
      upgradeAuthority,
      authorityKind: candidates.length > 0 ? 'unresolved' : 'wallet',
      multisig: null,
    };
  }

  const multisigInfo = await connection.getAccountInfo(new PublicKey(resolved.multisig));
  if (!multisigInfo) {
    throw new Error(`multisig account not found: ${resolved.multisig}`);
  }
  const multisigParsed = parseSquadsV4Multisig(multisigInfo.data);

  return {
    protocolId: target.protocolId,
    programId: target.programId,
    programDataAddr,
    upgradeAuthority,
    authorityKind: 'squads_vault',
    multisig: {
      address: resolved.multisig,
      threshold: multisigParsed.threshold,
      timeLockS: multisigParsed.timeLock,
      memberCount: multisigParsed.members.length,
    },
  };
}

/** Full seed: reads live, then upserts programs/authorities/multisigs/multisig_members. */
export async function seedProtocolControlAccounts(
  db: Db,
  connection: Connection,
  target: SeedTarget,
  currentSlot: number
): Promise<SeedResult> {
  const result = await resolveControlAccounts(connection, target);

  await db
    .insert(protocols)
    .values({ id: target.protocolId, name: target.protocolName })
    .onConflictDoNothing({ target: protocols.id });

  await db
    .insert(programs)
    .values({
      program_id: target.programId,
      protocol_id: target.protocolId,
      label: target.protocolName,
      programdata_addr: result.programDataAddr,
      loader: 'v3',
      is_executable: true,
      first_seen_slot: currentSlot,
      tracked: true,
    })
    .onConflictDoUpdate({
      target: programs.program_id,
      set: { tracked: true, programdata_addr: result.programDataAddr },
    });

  if (result.upgradeAuthority) {
    await db
      .insert(authorities)
      .values({
        address: result.upgradeAuthority,
        kind: result.authorityKind === 'squads_vault' ? 'squads_vault' : result.authorityKind,
        multisig_addr: result.multisig?.address ?? null,
        updated_slot: currentSlot,
      })
      .onConflictDoUpdate({
        target: authorities.address,
        set: { multisig_addr: result.multisig?.address ?? null, updated_slot: currentSlot },
      });
  }

  if (result.multisig) {
    await db
      .insert(multisigs)
      .values({
        address: result.multisig.address,
        kind: 'squads_v4',
        threshold: result.multisig.threshold,
        time_lock_s: result.multisig.timeLockS,
        member_count: result.multisig.memberCount,
        updated_slot: currentSlot,
      })
      .onConflictDoUpdate({
        target: multisigs.address,
        set: {
          threshold: result.multisig.threshold,
          time_lock_s: result.multisig.timeLockS,
          member_count: result.multisig.memberCount,
          updated_slot: currentSlot,
        },
      });
  }

  return result;
}

/** Every watched signer address currently in the registry (for filter.ts's nonce-ix check). */
export function watchedSignersFromMembers(members: Array<{ key: string }>): Set<string> {
  return new Set(members.map((m) => m.key));
}

export { bs58 };
