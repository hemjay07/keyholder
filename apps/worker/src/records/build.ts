// File: apps/worker/src/records/build.ts
// Control Record v2 (design/REVAMP-3.md D2/D3): for one day, every covered program's facts and stage.
// Inputs: that day's program_daily rows (the anchored log), the latest admin-key scan, the dollar
// census, the coverage file (verified build repo). Output: data/records/<day>.json.
// Facts not observed that day are labelled: a timelock carried back from a later day (v1 days
// recorded none) is marked `timelockCarried`, and only when the multisig and threshold match.
// Run: npx tsx src/records/build.ts <YYYY-MM-DD> [out-dir]

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Connection, PublicKey } from '@solana/web3.js';
import { computeStage, RULES_VERSION, type ControlPath, type ProgramFacts, type StageResult } from '@keyholder/stages';
import { vaultIndex, resolveFromHistory, type VaultMatch } from './admin-resolve';
import { decodeMembers } from '../coverage/daily';
import { buildSignerIndex } from './signers';
import { diffRecords } from './diff';
import { checkClaim, type SignedClaim } from './claims';
import { existsSync } from 'node:fs';

const DATA = join(__dirname, '..', '..', '..', '..', 'data');

export interface DayRow {
  program_id: string; slot: number; upgrade_authority: string | null; authority_kind: string;
  multisig: string | null; threshold: number | null; members: string[] | null;
  timelock_s: number | null; ms_version: string | null;
}
export interface AdminKey { account: string; address: string; field: string; key: string; kind: string }
export interface AdminScanProgram { programId: string; idl: string | null; keys?: (AdminKey | { account: string; skipped: string })[]; error?: string; partial?: { account: string; instances: number; failed: number }[] }
export interface MultisigFacts { address: string; threshold: number; members: number; timelockS: number | null; version: 'v4' | 'v3' | 'coral'; memberKeys: string[] }

export interface ProgramRecord {
  programId: string;
  repo: string | null;
  usdFloor: number | null;
  upgrade: { authority: string | null; kind: string; multisig: MultisigFacts | null; timelockCarried: boolean };
  admin: { status: 'read' | 'unknown'; undecoded: { account: string; instances: number; failed: number }[]; programWide: { account: string; field: string; key: string; resolvedAs: string; multisig: MultisigFacts | null }[]; perInstance: { account: string; instances: number; singleKeyOwners: number }[] };
  stage: StageResult;
  /** Programs whose controlling multisigs share 2+ signers with this one's (set after the signer index is built). */
  contagion?: { programId: string; sharedSigners: number; via: [string, string] }[];
}

/** Program-wide admin accounts exist once per program; accounts with many instances (markets, pools) belong to their creators. */
export function splitAdmin(keys: AdminKey[]): { programWide: AdminKey[]; perInstance: Map<string, AdminKey[]> } {
  const byAccount = new Map<string, AdminKey[]>();
  for (const k of keys) byAccount.set(k.account, [...(byAccount.get(k.account) ?? []), k]);
  const programWide: AdminKey[] = []; const perInstance = new Map<string, AdminKey[]>();
  for (const [acc, ks] of byAccount) {
    const instances = new Set(ks.map((k) => k.address)).size;
    if (instances === 1) programWide.push(...ks); else perInstance.set(acc, ks);
  }
  return { programWide, perInstance };
}

export function upgradePath(r: DayRow, ms: MultisigFacts | null): ControlPath {
  if (r.authority_kind === 'immutable') return { path: 'upgrade', kind: 'immutable' };
  if (r.authority_kind === 'single_key') return { path: 'upgrade', kind: 'single_key', key: r.upgrade_authority ?? '' };
  // Governance hold-up is not read yet (needs the governance account's config): treated as none, which can only understate the stage.
  if (r.authority_kind === 'spl_gov') return { path: 'upgrade', kind: 'governance', address: r.upgrade_authority ?? '', holdUpS: null };
  if (ms) return { path: 'upgrade', kind: 'multisig', address: ms.address, threshold: ms.threshold, members: ms.members, timelockS: ms.timelockS, version: ms.version };
  return { path: 'upgrade', kind: 'unresolved', key: r.upgrade_authority, note: r.authority_kind };
}

export function adminPath(k: AdminKey, ms: MultisigFacts | null): ControlPath {
  const path = `admin:${k.account}.${k.field}`;
  if (k.kind === 'single_key') return { path, kind: 'single_key', key: k.key };
  if (ms) return { path, kind: 'multisig', address: ms.address, threshold: ms.threshold, members: ms.members, timelockS: ms.timelockS, version: ms.version };
  return { path, kind: 'unresolved', key: k.key, note: k.kind };
}

function latestAdminScans(): Map<string, AdminScanProgram> {
  const dir = join(DATA, 'coverage');
  const files = readdirSync(dir).filter((f) => /^admin-keys-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const out = new Map<string, AdminScanProgram>();
  for (const f of files) for (const p of (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { programs: AdminScanProgram[] }).programs) {
    if (!p.error) out.set(p.programId, p); // later scans overwrite earlier ones
  }
  return out;
}

export async function buildRecords(day: string, rows: DayRow[], conn: Connection, opts: { carry?: Map<string, DayRow>; scans?: Map<string, AdminScanProgram> } = {}): Promise<ProgramRecord[]> {
  const cov = JSON.parse(readFileSync(join(DATA, 'coverage', 'coverage-2026-10-01.json'), 'utf8')) as { programs: { programId: string; repo?: string }[] };
  const repo = new Map(cov.programs.map((p) => [p.programId, p.repo || null]));
  const usd = new Map<string, number>();
  for (const f of readdirSync(join(DATA, 'coverage')).filter((f) => /^dollars-by-class-.*\.json$/.test(f)).sort())
    for (const p of (JSON.parse(readFileSync(join(DATA, 'coverage', f), 'utf8')) as { programs: { programId: string; usd_floor: number }[] }).programs) usd.set(p.programId, p.usd_floor);
  const scans = opts.scans ?? latestAdminScans();

  // Multisig facts from the day itself, with carried-back timelocks for v1 days.
  const msFacts = new Map<string, MultisigFacts & { carried: boolean }>();
  for (const r of rows) {
    if (!r.multisig || r.threshold == null) continue;
    let timelockS = r.timelock_s; let version = r.ms_version as MultisigFacts['version'] | null; let carried = false;
    const later = opts.carry?.get(r.program_id);
    if (version == null && later && later.multisig === r.multisig && later.threshold === r.threshold && later.ms_version) {
      timelockS = later.timelock_s; version = later.ms_version as MultisigFacts['version']; carried = true;
    }
    msFacts.set(r.multisig, { address: r.multisig, threshold: r.threshold, members: (r.members ?? []).length, memberKeys: [...(r.members ?? [])].sort(), timelockS: timelockS ?? null, version: version ?? 'v4', carried });
  }
  const vaults = vaultIndex([...msFacts.values()].map((m) => ({ address: m.address, version: m.version })));

  const resolveAdminMultisig = async (k: AdminKey): Promise<MultisigFacts | null> => {
    if (k.kind === 'single_key' || k.kind === 'none') return null;
    let match: VaultMatch | null = vaults.get(k.key) ?? null;
    if (!match) match = await resolveFromHistory(conn, k.key).catch(() => null);
    if (!match) return null;
    const known = msFacts.get(match.multisig);
    if (known) return { address: known.address, threshold: known.threshold, members: known.members, memberKeys: known.memberKeys, timelockS: known.timelockS, version: known.version };
    const acc = await conn.getAccountInfo(new PublicKey(match.multisig));
    const d = acc ? decodeMembers(acc.owner.toBase58(), acc.data) : null;
    if (!d) return null;
    const f: MultisigFacts = { address: match.multisig, threshold: d.threshold, members: d.members.length, memberKeys: [...d.members].sort(), timelockS: d.timelockS, version: d.version };
    msFacts.set(match.multisig, { ...f, carried: false });
    return f;
  };

  const out: ProgramRecord[] = [];
  for (const r of rows) {
    const scan = scans.get(r.program_id);
    const keys = (scan?.keys ?? []).filter((k): k is AdminKey => 'address' in k && k.kind !== 'none');
    const { programWide, perInstance } = splitAdmin(keys);
    const resolved = [] as ProgramRecord['admin']['programWide'];
    const adminPaths: ControlPath[] = [];
    for (const k of programWide) {
      const ms = await resolveAdminMultisig(k);
      resolved.push({ account: k.account, field: k.field, key: k.key, resolvedAs: k.kind === 'single_key' ? 'single_key' : ms ? `multisig ${ms.version}` : 'unresolved', multisig: ms });
      adminPaths.push(adminPath(k, ms));
    }
    const ms = r.multisig ? msFacts.get(r.multisig) ?? null : null;
    // A program-wide config account (one instance) that failed to decode leaves admin unknown; per-instance failures do not.
    const programWideFailed = (scan?.partial ?? []).filter((x) => x.instances === 1).map((x) => x.account);
    const facts: ProgramFacts = { programId: r.program_id, upgrade: upgradePath(r, ms), admin: adminPaths, adminStatus: scan?.idl && !programWideFailed.length ? 'read' : 'unknown', closed: r.authority_kind === 'closed' };
    out.push({
      programId: r.program_id, repo: repo.get(r.program_id) ?? null, usdFloor: usd.get(r.program_id) ?? null,
      upgrade: { authority: r.upgrade_authority, kind: r.authority_kind, multisig: ms ? { address: ms.address, threshold: ms.threshold, members: ms.members, memberKeys: ms.memberKeys, timelockS: ms.timelockS, version: ms.version } : null, timelockCarried: ms?.carried ?? false },
      admin: { status: facts.adminStatus, undecoded: scan?.partial ?? [], programWide: resolved, perInstance: [...perInstance].map(([account, ks]) => ({ account, instances: new Set(ks.map((k) => k.address)).size, singleKeyOwners: new Set(ks.filter((k) => k.kind === 'single_key').map((k) => k.address)).size })) },
      stage: computeStage(facts),
    });
  }
  return out.sort((a, b) => (a.programId < b.programId ? -1 : 1));
}

export function summarize(records: ProgramRecord[]): Record<string, unknown> {
  const byStage = [0, 1, 2, 3].map((s) => ({ stage: s, programs: records.filter((r) => r.stage.stage === s).length, usdFloor: Math.round(records.filter((r) => r.stage.stage === s).reduce((a, r) => a + (r.usdFloor ?? 0), 0)) }));
  return { programs: records.length, byStage, closed: records.filter((r) => r.stage.modifiers.includes('closed')).length, adminRead: records.filter((r) => r.admin.status === 'read').length };
}

/** For each program_closed event: the loader Close transaction (last signature on the program-data account), its signer and time. */
export async function attachClosures(events: ReturnType<typeof diffRecords>, conn: Connection): Promise<void> {
  const loader = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
  for (const e of events) {
    if (e.kind !== 'program_closed') continue;
    try {
      const [pd] = PublicKey.findProgramAddressSync([new PublicKey(e.programId).toBuffer()], loader);
      const [last] = await conn.getSignaturesForAddress(pd, { limit: 1 });
      if (!last) continue;
      const tx = await conn.getTransaction(last.signature, { maxSupportedTransactionVersion: 1 });
      const signer = tx?.transaction.message.getAccountKeys().staticAccountKeys[0]?.toBase58() ?? null;
      Object.assign(e, { closeSignature: last.signature, closedBy: signer, closedAt: last.blockTime ? new Date(last.blockTime * 1000).toISOString() : null });
    } catch { /* leave the event without close details rather than guess */ }
  }
}

/** Write a built day to the database (idempotent: a rebuilt day replaces its rows). */
export async function writeDay(
  sql: import('postgres').Sql,
  doc: { day: string; rulesVersion: string; recordVersion: string; anchor: unknown; timelockCarriedFrom: string | null; summary: unknown; programs: ProgramRecord[] },
  signers: ReturnType<typeof buildSignerIndex>,
  changes: ReturnType<typeof diffRecords>,
  claimChecks: ({ file: string } & ReturnType<typeof checkClaim>)[],
): Promise<void> {
  const day = doc.day;
  await sql.begin(async (tx) => {
    await tx`insert into record_day (day, rules_version, record_version, summary, anchor, "overlaps", timelock_carried_from)
      values (${day}, ${doc.rulesVersion}, ${doc.recordVersion}, ${tx.json(doc.summary as never)}, ${doc.anchor ? tx.json(doc.anchor as never) : null}, ${tx.json(signers.overlaps as never)}, ${doc.timelockCarriedFrom})
      on conflict (day) do update set rules_version = excluded.rules_version, record_version = excluded.record_version, summary = excluded.summary,
        anchor = excluded.anchor, "overlaps" = excluded."overlaps", timelock_carried_from = excluded.timelock_carried_from, built_at = now()`;
    await tx`delete from control_record where day = ${day}`;
    await tx`delete from signer_entry where day = ${day}`;
    await tx`delete from control_event where day = ${day}`;
    await tx`delete from claim_check where day = ${day}`;
    for (const r of doc.programs) {
      await tx`insert into control_record (day, program_id, stage, usd_floor, record) values (${day}, ${r.programId}, ${r.stage.stage}, ${r.usdFloor}, ${tx.json(r as never)})`;
    }
    for (const e of signers.signers) {
      await tx`insert into signer_entry (day, key, usd_behind, worst_stage, entry) values (${day}, ${e.key}, ${e.usdBehind}, ${e.worstStage}, ${tx.json(e as never)})`;
    }
    for (const e of changes) {
      const { day: _d, programId, kind, path, from, to, ...extra } = e;
      await tx`insert into control_event (day, program_id, kind, path, from_value, to_value, extra)
        values (${day}, ${programId}, ${kind}, ${path}, ${tx.json((from ?? null) as never)}, ${tx.json((to ?? null) as never)}, ${tx.json(extra as never)}) on conflict do nothing`;
    }
    for (const c of claimChecks) await tx`insert into claim_check (day, file, protocol, status, "check") values (${day}, ${c.file}, ${c.protocol}, ${c.status}, ${tx.json(c as never)})`;
  });
}

/** Build one day: files in outDir, and the database when toDb. Days must be built oldest first for the feed. */
export async function runDay(sql: import('postgres').Sql, day: string, outDir: string, toDb: boolean): Promise<void> {
  const rows = (await sql`select program_id, slot, upgrade_authority, authority_kind, multisig, threshold, members, timelock_s, ms_version from program_daily where day = ${day}`) as unknown as DayRow[];
  if (!rows.length) throw new Error(`no program_daily rows for ${day}`);
  const laterDay = (await sql`select min(day)::text as d from program_daily where day > ${day} and ms_version is not null`)[0]?.d as string | null;
  const carry = new Map<string, DayRow>();
  if (laterDay) for (const r of (await sql`select program_id, slot, upgrade_authority, authority_kind, multisig, threshold, members, timelock_s, ms_version from program_daily where day = ${laterDay}`) as unknown as DayRow[]) carry.set(r.program_id, r);
  const anchor = (await sql`select sha256, signature, slot, cluster from daily_anchor where day = ${day}`)[0] ?? null;
  const records = await buildRecords(day, rows, new Connection(process.env.DAILY_RPC_URL ?? 'https://api.mainnet-beta.solana.com', 'confirmed'), { carry });
  const signers = buildSignerIndex(records);
  for (const r of records) r.contagion = signers.contagion[r.programId] ?? [];
  mkdirSync(outDir, { recursive: true });
  const doc = { day: day, rulesVersion: RULES_VERSION, recordVersion: 'record/v2', anchor, timelockCarriedFrom: laterDay, summary: summarize(records), programs: records };
  writeFileSync(join(outDir, `${day}.json`), JSON.stringify(doc));
  writeFileSync(join(outDir, `signers-${day}.json`), JSON.stringify({ day, ...signers }));
  // the feed: changes since the latest earlier record in the same directory
  const prior = readdirSync(outDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f < `${day}.json`).sort().pop();
  const changes: ReturnType<typeof diffRecords> = prior ? diffRecords(day, (JSON.parse(readFileSync(join(outDir, prior), 'utf8')) as { programs: ProgramRecord[] }).programs, records) : [];
  await attachClosures(changes, new Connection(process.env.DAILY_RPC_URL ?? 'https://api.mainnet-beta.solana.com', 'confirmed'));
  // Proof of Control: every signed claim in data/claims, checked against today's record; breaks join the feed.
  const claimsDir = join(DATA, 'claims');
  const byId = new Map(records.map((r) => [r.programId, r]));
  const claimChecks = existsSync(claimsDir) ? readdirSync(claimsDir).filter((f) => f.endsWith('.json')).map((f) => ({ file: f, ...checkClaim(JSON.parse(readFileSync(join(claimsDir, f), 'utf8')) as SignedClaim, day, byId) })) : [];
  writeFileSync(join(outDir, `claims-${day}.json`), JSON.stringify({ day, checks: claimChecks }));
  for (const c of claimChecks) for (const b of c.breaks) changes.push({ day: day, programId: b.programId, kind: 'claim_broken', path: b.path, from: b.expected, to: b.actual });
  writeFileSync(join(outDir, `changes-${day}.json`), JSON.stringify({ day, since: prior?.slice(0, 10) ?? null, events: changes }));
  if (toDb) await writeDay(sql, doc, signers, changes, claimChecks);
  console.log(JSON.stringify({ day, ...doc.summary, signers: signers.signers.length, multisigs: signers.multisigs.length, overlaps: signers.overlaps.length, changes: changes.length, claims: claimChecks.length, db: toDb }));
}

if (require.main === module) {
  void (async () => {
    const arg = process.argv[2];
    const outDir = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : join(DATA, 'records');
    const toDb = process.argv.includes('--db');
    if (arg !== 'all' && !/^\d{4}-\d{2}-\d{2}$/.test(arg ?? '')) throw new Error('usage: build.ts <YYYY-MM-DD | all> [out-dir] [--db]');
    const postgres = (await import('postgres')).default; const dotenv = await import('dotenv');
    dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    try {
      const days = arg === 'all' ? ((await sql`select distinct day::text as d from program_daily order by 1`) as unknown as { d: string }[]).map((r) => r.d) : [arg!];
      for (const d of days) await runDay(sql, d, outDir, toDb);
    } finally { await sql.end(); }
  })().catch((e) => { console.error(e); process.exit(1); });
}
