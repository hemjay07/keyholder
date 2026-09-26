// File: apps/worker/src/state-builder/seed.ts
// [DESIGNED + BUILT; run live — see this task's VERIFY section for real output]
//
// Task 3.1: seed control_state for all 15 programs in
// apps/worker/src/ingest/verified-programs.json by reading live ProgramData
// + resolving the upgrade authority (authority.ts) + checking
// verify.osec.io (verify-osec.ts), then folding the result into a
// ControlState and writing one control_state row per protocol at the
// current tip slot. Extends, rather than duplicates, the already-tested
// apps/worker/src/ingest/registry.ts pattern: only Drift has an
// independently confirmed controlling-multisig candidate
// (7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM, per registry.ts's
// VERIFIED_SEED_TARGETS and PULSE.md VF-F2); the other 14 are seeded with
// no candidate list, so their authorityKind is honestly
// 'single_key_or_vault_unresolved' unless the live read turns out to be a
// direct Squads Multisig account or an immutable program — never guessed.
//
// Usage: `pnpm --filter @keyholder/worker exec tsx src/state-builder/seed.ts`
// Requires DATABASE_URL and ~/.helius_key or public RPC access. Never
// prints the Helius key (rpc.ts's redact()/withRedaction()).

import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { Connection } from '@solana/web3.js';
import { initDb, type Db } from '../db';
import { programs, authorities, multisigs, protocols, control_state, verification_checks } from '../schema';
import { resolveRpcEndpoints, withRedaction } from '../ingest/rpc';
import { resolveAuthority } from './authority';
import { resolveAuthorityHistorically } from './authority-history';
import { fetchVerificationStatus } from './verify-osec';
import { hashState, type ControlState } from './fold';
import { EMPTY_CONTROL_STATE } from '@keyholder/risk';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

const DRIFT_PROGRAM_ID = 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH';
const DRIFT_CANDIDATE_MULTISIGS = ['7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM'];

interface VerifiedProgramEntry {
  name: string;
  programId: string;
  exists: boolean;
  executable: boolean;
}

/**
 * `authorities.kind` is varchar(20) (ARCHITECTURE.md §4); the richer
 * ControlState.authorityKind values (e.g. 'single_key_or_vault_unresolved')
 * are stored in full inside control_state.state (jsonb, unconstrained) and
 * shortened here only for the fixed-width DB column.
 */
function dbAuthorityKind(kind: ControlState['authorityKind']): string {
  switch (kind) {
    case 'single_key':
      return 'single';
    case 'squads_vault':
      return 'squads_vault';
    case 'squads_v4_direct':
      return 'squads_v4';
    case 'single_key_or_vault_unresolved':
      return 'unresolved';
    default:
      return kind;
  }
}

function protocolIdFor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface SeedRow {
  protocolId: string;
  programId: string;
  authorityKind: ControlState['authorityKind'];
  threshold: number | null;
  memberCount: number | null;
  timeLockS: number | null;
  verifiedStatus: ControlState['verifiedStatus'];
  evidenceSignature: string | null;
  evidenceNote: string | null;
}

export async function seedAllVerifiedPrograms(db: Db, connection: Connection): Promise<SeedRow[]> {
  const listPath = join(__dirname, '..', 'ingest', 'verified-programs.json');
  const list = JSON.parse(readFileSync(listPath, 'utf8')) as { programs: VerifiedProgramEntry[] };
  const tipSlot = await withRedaction(() => connection.getSlot('confirmed'));

  // verified-programs.json (14 entries) plus Drift itself — independently
  // confirmed real and executable in apps/worker/src/ingest/registry.ts
  // (PULSE.md VF-F2) but tracked there rather than in that JSON file. 14 + 1
  // = the 15 programs this task's brief asks to seed.
  const allEntries: VerifiedProgramEntry[] = [
    ...list.programs,
    { name: 'Drift Protocol', programId: DRIFT_PROGRAM_ID, exists: true, executable: true },
  ];

  const rows: SeedRow[] = [];

  for (const entry of allEntries) {
    if (!entry.exists || !entry.executable) continue;
    const protocolId = entry.programId === DRIFT_PROGRAM_ID ? 'drift' : protocolIdFor(entry.name);
    const candidateMultisigs = entry.programId === DRIFT_PROGRAM_ID ? DRIFT_CANDIDATE_MULTISIGS : undefined;

    try {
      const initial = await withRedaction(() =>
        resolveAuthority(connection, { programId: entry.programId, candidateMultisigs })
      );

      // DEV-043 (coordinator review, 2026-09-26): when authority.ts's static
      // check can't tell a wallet apart from an unresolved Squads vault (no
      // known candidate multisig), walk the authority's real transaction
      // history instead — the way Drift's own authority was actually
      // resolved. Never runs for Drift (already fully resolved) or an
      // already-immutable/direct-multisig result.
      let evidenceSignature: string | null = null;
      let evidenceNote: string | null = null;
      let resolved = initial;
      if (initial.authorityKind === 'single_key_or_vault_unresolved' && initial.upgradeAuthority) {
        const historical = await withRedaction(() => resolveAuthorityHistorically(connection, initial.upgradeAuthority!));
        evidenceSignature = historical.evidenceSignature;
        evidenceNote = historical.evidenceNote;
        if (historical.authorityKind !== 'single_key_or_vault_unresolved') {
          resolved = { ...initial, authorityKind: historical.authorityKind, multisig: historical.multisig };
        }
      }

      const verification = await fetchVerificationStatus(entry.programId);

      await db.insert(protocols).values({ id: protocolId, name: entry.name }).onConflictDoNothing({ target: protocols.id });

      await db
        .insert(programs)
        .values({
          program_id: entry.programId,
          protocol_id: protocolId,
          label: entry.name,
          programdata_addr: resolved.programDataAddr,
          loader: 'v3',
          is_executable: true,
          first_seen_slot: tipSlot,
          tracked: true,
        })
        .onConflictDoUpdate({
          target: programs.program_id,
          set: { tracked: true, programdata_addr: resolved.programDataAddr },
        });

      if (resolved.upgradeAuthority) {
        await db
          .insert(authorities)
          .values({
            address: resolved.upgradeAuthority,
            kind: dbAuthorityKind(resolved.authorityKind),
            multisig_addr: resolved.multisig?.address ?? null,
            updated_slot: tipSlot,
            evidence_signature: evidenceSignature,
            evidence_note: evidenceNote,
          })
          .onConflictDoUpdate({
            target: authorities.address,
            set: {
              kind: dbAuthorityKind(resolved.authorityKind),
              multisig_addr: resolved.multisig?.address ?? null,
              updated_slot: tipSlot,
              evidence_signature: evidenceSignature,
              evidence_note: evidenceNote,
            },
          });
      }

      if (resolved.multisig) {
        await db
          .insert(multisigs)
          .values({
            address: resolved.multisig.address,
            kind: resolved.multisig.programVersion === 'v3' ? 'squads_v3' : 'squads_v4',
            threshold: resolved.multisig.threshold,
            time_lock_s: resolved.multisig.timeLockS,
            config_authority: resolved.multisig.configAuthority,
            member_count: resolved.multisig.memberCount,
            updated_slot: tipSlot,
          })
          .onConflictDoUpdate({
            target: multisigs.address,
            set: {
              threshold: resolved.multisig.threshold,
              time_lock_s: resolved.multisig.timeLockS,
              config_authority: resolved.multisig.configAuthority,
              member_count: resolved.multisig.memberCount,
              updated_slot: tipSlot,
            },
          });
      }

      await db
        .insert(verification_checks)
        .values({
          program_id: entry.programId,
          checked_at: verification.checkedAt,
          is_verified: verification.isVerified,
          on_chain_hash: verification.onChainHash,
          executable_hash: verification.executableHash,
          commit: verification.commit,
          repo_url: verification.repoUrl,
          raw: verification.raw,
        })
        .onConflictDoNothing();

      const state: ControlState = {
        ...EMPTY_CONTROL_STATE,
        authorityKind: resolved.authorityKind,
        authorityAddress: resolved.upgradeAuthority,
        multisig: resolved.multisig,
        verifiedStatus: verification.verifiedStatus,
        asOfSlot: tipSlot,
      };

      await db
        .insert(control_state)
        .values({ protocol_id: protocolId, slot: tipSlot, state, state_hash: hashState(state) })
        .onConflictDoNothing({ target: [control_state.protocol_id, control_state.slot] });

      rows.push({
        protocolId,
        programId: entry.programId,
        authorityKind: resolved.authorityKind,
        threshold: resolved.multisig?.threshold ?? null,
        memberCount: resolved.multisig?.memberCount ?? null,
        timeLockS: resolved.multisig?.timeLockS ?? null,
        verifiedStatus: verification.verifiedStatus,
        evidenceSignature,
        evidenceNote,
      });
    } catch (err) {
      console.error(`[seed] FAILED ${entry.name} (${entry.programId}):`, err instanceof Error ? err.message : err);
    }
  }

  return rows;
}

async function main(): Promise<void> {
  const db = initDb();
  const { httpUrl, wsUrl, usingHelius } = resolveRpcEndpoints();
  const connection = new Connection(httpUrl, { commitment: 'confirmed', wsEndpoint: wsUrl });
  console.log(`[seed] RPC source: ${usingHelius ? 'Helius (free tier)' : 'public mainnet-beta'}`);

  const rows = await seedAllVerifiedPrograms(db, connection);

  console.log(`[seed] seeded ${rows.length} program control states:`);
  console.log(
    ['protocol', 'programId', 'authorityKind', 'threshold', 'memberCount', 'timeLockS', 'verified', 'evidence'].join(' | ')
  );
  for (const r of rows) {
    const evidence = r.evidenceSignature ?? r.evidenceNote ?? '-';
    console.log(
      [r.protocolId, r.programId, r.authorityKind, r.threshold ?? '-', r.memberCount ?? '-', r.timeLockS ?? '-', r.verifiedStatus, evidence].join(
        ' | '
      )
    );
  }
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[seed] fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
