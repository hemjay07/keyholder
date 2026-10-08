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

if (require.main === module) {
  void (async () => {
    const day = process.argv[2]; const outDir = process.argv[3] ?? join(DATA, 'records');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) throw new Error('usage: build.ts YYYY-MM-DD [out-dir]');
    const postgres = (await import('postgres')).default; const dotenv = await import('dotenv');
    dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    const rows = (await sql`select program_id, slot, upgrade_authority, authority_kind, multisig, threshold, members, timelock_s, ms_version from program_daily where day = ${day!}`) as unknown as DayRow[];
    const laterDay = (await sql`select min(day)::text as d from program_daily where day > ${day!} and ms_version is not null`)[0]?.d as string | null;
    const carry = new Map<string, DayRow>();
    if (laterDay) for (const r of (await sql`select program_id, slot, upgrade_authority, authority_kind, multisig, threshold, members, timelock_s, ms_version from program_daily where day = ${laterDay}`) as unknown as DayRow[]) carry.set(r.program_id, r);
    const anchor = (await sql`select sha256, signature, slot, cluster from daily_anchor where day = ${day!}`)[0] ?? null;
    await sql.end();
    const records = await buildRecords(day!, rows, new Connection(process.env.DAILY_RPC_URL ?? 'https://api.mainnet-beta.solana.com', 'confirmed'), { carry });
    mkdirSync(outDir, { recursive: true });
    const doc = { day, rulesVersion: RULES_VERSION, recordVersion: 'record/v2', anchor, timelockCarriedFrom: laterDay, summary: summarize(records), programs: records };
    writeFileSync(join(outDir, `${day}.json`), JSON.stringify(doc));
    const signers = buildSignerIndex(records);
    writeFileSync(join(outDir, `signers-${day}.json`), JSON.stringify({ day, ...signers }));
    // the feed: changes since the latest earlier record in the same directory
    const prior = readdirSync(outDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f < `${day}.json`).sort().pop();
    const changes: ReturnType<typeof diffRecords> = prior && existsSync(join(outDir, prior)) ? diffRecords(day!, (JSON.parse(readFileSync(join(outDir, prior), 'utf8')) as { programs: ProgramRecord[] }).programs, records) : [];
    // Proof of Control: every signed claim in data/claims, checked against today's record; breaks join the feed.
    const claimsDir = join(DATA, 'claims');
    const byId = new Map(records.map((r) => [r.programId, r]));
    const claimChecks = existsSync(claimsDir) ? readdirSync(claimsDir).filter((f) => f.endsWith('.json')).map((f) => ({ file: f, ...checkClaim(JSON.parse(readFileSync(join(claimsDir, f), 'utf8')) as SignedClaim, day!, byId) })) : [];
    writeFileSync(join(outDir, `claims-${day}.json`), JSON.stringify({ day, checks: claimChecks }));
    for (const c of claimChecks) for (const b of c.breaks) changes.push({ day: day!, programId: b.programId, kind: 'claim_broken', path: b.path, from: b.expected, to: b.actual });
    writeFileSync(join(outDir, `changes-${day}.json`), JSON.stringify({ day, since: prior?.slice(0, 10) ?? null, events: changes }));
    console.log(JSON.stringify({ day, ...doc.summary, signers: signers.signers.length, multisigs: signers.multisigs.length, overlaps: signers.overlaps.length, changes: changes.length }));
  })().catch((e) => { console.error(e); process.exit(1); });
}
