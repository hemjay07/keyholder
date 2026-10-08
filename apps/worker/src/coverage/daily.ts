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
import { program_daily, daily_anchor } from '../schema';
import { eq } from 'drizzle-orm';
import { Keypair } from '@solana/web3.js';
import { digest, memoText, anchor, type DailyRow } from './anchor';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

export interface CoverageRow { programId: string; upgradeAuthority?: string | null; authorityKind?: string; multisig?: { address: string } | null }

/** What to do for one program today, given coverage and the authority read live. */
export function plan(row: CoverageRow, liveAuthority: string | null): 'immutable' | 'reread-multisig' | 'resolve' | 'keep' {
  if (liveAuthority === null) return 'immutable';
  if (liveAuthority !== (row.upgradeAuthority ?? null)) return 'resolve';
  if (row.multisig?.address) return 'reread-multisig';
  return 'keep';
}

/** Threshold, members, timelock and version of a multisig account. Squads v3 and coral have no timelock (null). */
export function decodeMembers(owner: string, data: Buffer): { threshold: number; members: string[]; timelockS: number | null; version: 'v4' | 'v3' | 'coral' } | null {
  try {
    if (owner === SQUADS_V4_PROGRAM_ID) { const m = parseSquadsV4Multisig(data); return { threshold: m.threshold, members: m.members.map((x) => x.key), timelockS: m.timeLock, version: 'v4' }; }
    if (owner === SQUADS_V3_PROGRAM_ID) { const m = parseSquadsV3Multisig(data); return { threshold: m.threshold, members: m.members, timelockS: null, version: 'v3' }; }
    if (owner === CORAL_MULTISIG_PROGRAM_ID) { const m = parseCoralMultisig(data); return { threshold: Number(m.threshold), members: m.owners, timelockS: null, version: 'coral' }; }
  } catch { /* not a layout we decode */ }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Hash the day's rows and write the memo, once per day. Off unless ANCHOR_KEYPAIR_PATH is set. */
export async function anchorDay(db: ReturnType<typeof drizzle>, day: string): Promise<unknown> {
  const keyPath = process.env.ANCHOR_KEYPAIR_PATH;
  if (!keyPath) return 'off';
  const done = await db.select().from(daily_anchor).where(eq(daily_anchor.day, day));
  if (done.length) return { already: done[0]!.signature };
  const rows = (await db.select().from(program_daily).where(eq(program_daily.day, day))) as unknown as DailyRow[];
  const hash = digest(rows);
  const cluster = process.env.ANCHOR_RPC_URL ?? 'https://api.devnet.solana.com';
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keyPath, 'utf8'))));
  const { signature, slot } = await anchor(new Connection(cluster, 'confirmed'), payer, memoText(day, rows.length, hash));
  await db.insert(daily_anchor).values({ day, row_count: rows.length, sha256: hash, cluster, signature, slot });
  return { rows: rows.length, hash, signature, slot };
}

async function main(): Promise<void> {
  const dir = join(__dirname, '..', '..', '..', '..', 'data', 'coverage');
  const file = process.env.COVERAGE_FILE ?? join(dir, readdirSync(dir).filter((f) => /^coverage-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop()!);
  // Universe (record v2, 2026-10-08): every verified program, immutable ones included (closure and
  // re-deploy are still events), plus the money layer (the largest programs, most not OtterSec-verified).
  const tvlFile = readdirSync(dir).filter((f) => /^coverage-tvl-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop();
  const seen = new Set<string>();
  const rows = [file, ...(tvlFile && !process.env.COVERAGE_FILE ? [join(dir, tvlFile)] : [])]
    .flatMap((f) => (JSON.parse(readFileSync(f, 'utf8')) as { programs: CoverageRow[] }).programs)
    .filter((r) => r.authorityKind && !seen.has(r.programId) && seen.add(r.programId));
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
      if (!info) {
        // program data account gone: the program was closed by its authority (loader Close). Record it, never drop the row.
        await db.insert(program_daily).values({ day, program_id: row.programId, slot, upgrade_authority: null, authority_kind: 'closed', multisig: null, threshold: null, members: null }).onConflictDoNothing();
        counts.closed = (counts.closed ?? 0) + 1;
        continue;
      }
      const live = parseProgramData(info.data).upgradeAuthority;
      const step = plan(row, live);
      let kind = row.authorityKind!; let multisig = row.multisig?.address ?? null; let threshold: number | null = null; let members: string[] | null = null; let timelock_s: number | null = null; let ms_version: string | null = null;
      if (step === 'immutable') kind = 'immutable';
      if (step === 'resolve') {
        changed.push(row.programId);
        const r = await resolveAuthority(connection, { programId: row.programId });
        kind = r.authorityKind; multisig = r.multisig?.address ?? null;
      }
      if (multisig && (step === 'reread-multisig' || step === 'resolve')) {
        const mi = await connection.getAccountInfo(new PublicKey(multisig));
        const d = mi ? decodeMembers(mi.owner.toBase58(), mi.data) : null;
        if (d) { threshold = d.threshold; members = d.members; timelock_s = d.timelockS; ms_version = d.version; }
      }
      await db.insert(program_daily).values({ day, program_id: row.programId, slot, upgrade_authority: live, authority_kind: kind, multisig, threshold, members, timelock_s, ms_version }).onConflictDoNothing();
      counts[kind] = (counts[kind] ?? 0) + 1;
    } catch (e) {
      counts.error = (counts.error ?? 0) + 1;
    }
    await sleep(Number(process.env.DAILY_GAP_MS ?? 120));
  }
  const anchored = await anchorDay(db, day).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  console.log(JSON.stringify({ day, slot, programs: rows.length, counts, authorityChangedSinceCoverage: changed, anchored }));
  await sql.end();
}

if (require.main === module) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
