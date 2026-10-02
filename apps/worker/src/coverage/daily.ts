// File: apps/worker/src/coverage/daily.ts
// The observation log at full coverage (design/DATA-MOAT.md, layer 3): once a day,
// for every program in the latest coverage file, read its upgrade authority from
// chain and, for a multisig, its threshold and member keys; write one dated row
// per program to program_daily. Re-runs the full resolver only when an authority
// has changed since coverage. Run: npx tsx src/coverage/daily.ts

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Connection, PublicKey } from '@solana/web3.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { parseProgramData, parseSquadsV4Multisig, parseSquadsV3Multisig, parseCoralMultisig, SQUADS_V4_PROGRAM_ID, SQUADS_V3_PROGRAM_ID, CORAL_MULTISIG_PROGRAM_ID, BPF_LOADER_UPGRADEABLE_PROGRAM_ID } from '@keyholder/decoder';
import { resolveAuthority } from '../state-builder/authority';
import { program_daily } from '../schema';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

export interface CoverageRow { programId: string; upgradeAuthority?: string | null; authorityKind?: string; multisig?: { address: string } | null }

/** What to do for one program today, given coverage and the authority read live. */
export function plan(row: CoverageRow, liveAuthority: string | null): 'immutable' | 'reread-multisig' | 'resolve' | 'keep' {
  if (liveAuthority === null) return 'immutable';
  if (liveAuthority !== (row.upgradeAuthority ?? null)) return 'resolve';
  if (row.multisig?.address) return 'reread-multisig';
  return 'keep';
}

function decodeMembers(owner: string, data: Buffer): { threshold: number; members: string[] } | null {
  try {
    if (owner === SQUADS_V4_PROGRAM_ID) { const m = parseSquadsV4Multisig(data); return { threshold: m.threshold, members: m.members.map((x) => x.key) }; }
    if (owner === SQUADS_V3_PROGRAM_ID) { const m = parseSquadsV3Multisig(data); return { threshold: m.threshold, members: m.members }; }
    if (owner === CORAL_MULTISIG_PROGRAM_ID) { const m = parseCoralMultisig(data); return { threshold: Number(m.threshold), members: m.owners }; }
  } catch { /* not a layout we decode */ }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const dir = join(__dirname, '..', '..', '..', '..', 'data', 'coverage');
  const file = process.env.COVERAGE_FILE ?? join(dir, readdirSync(dir).filter((f) => /^coverage-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop()!);
  const rows = (JSON.parse(readFileSync(file, 'utf8')) as { programs: CoverageRow[] }).programs.filter((r) => r.authorityKind && r.authorityKind !== 'immutable');
  const connection = new Connection(process.env.DAILY_RPC_URL ?? 'https://api.mainnet-beta.solana.com', 'confirmed');
  const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
  const db = drizzle(sql);
  const day = new Date().toISOString().slice(0, 10);
  const slot = await connection.getSlot();
  const loader = new PublicKey(BPF_LOADER_UPGRADEABLE_PROGRAM_ID);
  const counts: Record<string, number> = {};
  const changed: string[] = [];
  for (const row of rows) {
    try {
      const [pd] = PublicKey.findProgramAddressSync([new PublicKey(row.programId).toBuffer()], loader);
      const info = await connection.getAccountInfo(pd);
      if (!info) { counts.missing = (counts.missing ?? 0) + 1; continue; }
      const live = parseProgramData(info.data).upgradeAuthority;
      const step = plan(row, live);
      let kind = row.authorityKind!; let multisig = row.multisig?.address ?? null; let threshold: number | null = null; let members: string[] | null = null;
      if (step === 'immutable') kind = 'immutable';
      if (step === 'resolve') {
        changed.push(row.programId);
        const r = await resolveAuthority(connection, { programId: row.programId });
        kind = r.authorityKind; multisig = r.multisig?.address ?? null;
      }
      if (multisig && (step === 'reread-multisig' || step === 'resolve')) {
        const mi = await connection.getAccountInfo(new PublicKey(multisig));
        const d = mi ? decodeMembers(mi.owner.toBase58(), mi.data) : null;
        if (d) { threshold = d.threshold; members = d.members; }
      }
      await db.insert(program_daily).values({ day, program_id: row.programId, slot, upgrade_authority: live, authority_kind: kind, multisig, threshold, members }).onConflictDoNothing();
      counts[kind] = (counts[kind] ?? 0) + 1;
    } catch (e) {
      counts.error = (counts.error ?? 0) + 1;
    }
    await sleep(Number(process.env.DAILY_GAP_MS ?? 120));
  }
  console.log(JSON.stringify({ day, slot, programs: rows.length, counts, authorityChangedSinceCoverage: changed }));
  await sql.end();
}

if (require.main === module) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
