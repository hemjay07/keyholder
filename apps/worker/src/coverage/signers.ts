// File: apps/worker/src/coverage/signers.ts
// The data moat, layer 2 (design/DATA-MOAT.md): from a coverage file, find signer
// keys that sit in more than one multisig, and say which organisations those
// multisigs control programs for. Pure analysis of the coverage JSON; no chain reads.
// Run: npx tsx src/coverage/signers.ts [data/coverage/coverage-YYYY-MM-DD.json]

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

interface Row {
  programId: string;
  repo?: string | null;
  authorityKind?: string;
  multisig?: { address: string; threshold: number; memberCount: number } | null;
  signers?: { program: string; members: string[] } | null;
}

/** github.com/<org>/<repo>/... -> org (lower-cased); null when not a GitHub URL. */
export function orgOf(repo: string | null | undefined): string | null {
  const m = repo?.match(/github\.com\/([^/]+)\//i);
  return m ? m[1]!.toLowerCase() : null;
}

export interface SharedSigner {
  key: string;
  multisigs: Array<{ address: string; kind: string; threshold: number; members: number; orgs: string[]; programs: string[] }>;
  distinctOrgs: string[];
}

/** Keys found in two or more distinct multisigs, most multisigs first. */
export function sharedSigners(rows: Row[]): SharedSigner[] {
  const byMs = new Map<string, { kind: string; threshold: number; members: string[]; programs: string[]; orgs: Set<string> }>();
  for (const r of rows) {
    if (!r.multisig?.address || !r.signers?.members?.length) continue;
    const e = byMs.get(r.multisig.address) ?? { kind: r.signers.program, threshold: r.multisig.threshold, members: r.signers.members, programs: [], orgs: new Set<string>() };
    e.programs.push(r.programId);
    const org = orgOf(r.repo);
    if (org) e.orgs.add(org);
    byMs.set(r.multisig.address, e);
  }
  const byKey = new Map<string, string[]>();
  for (const [ms, e] of byMs) for (const k of new Set(e.members)) byKey.set(k, [...(byKey.get(k) ?? []), ms]);
  const out: SharedSigner[] = [];
  for (const [key, mss] of byKey) {
    if (mss.length < 2) continue;
    const multisigs = mss.map((a) => { const e = byMs.get(a)!; return { address: a, kind: e.kind, threshold: e.threshold, members: e.members.length, orgs: [...e.orgs], programs: e.programs }; });
    const distinctOrgs = [...new Set(multisigs.flatMap((m) => m.orgs))];
    out.push({ key, multisigs, distinctOrgs });
  }
  return out.sort((a, b) => b.distinctOrgs.length - a.distinctOrgs.length || b.multisigs.length - a.multisigs.length);
}

function main(): void {
  const dir = join(__dirname, '..', '..', '..', '..', 'data', 'coverage');
  const file = process.argv[2] ?? join(dir, readdirSync(dir).filter((f) => f.startsWith('coverage-')).sort().pop()!);
  const data = JSON.parse(readFileSync(file, 'utf8')) as { day: string; slot: number; programs: Row[] };
  const rows = data.programs;
  const kinds: Record<string, number> = {};
  for (const r of rows) kinds[r.authorityKind ?? 'error'] = (kinds[r.authorityKind ?? 'error'] ?? 0) + 1;
  const shared = sharedSigners(rows);
  const crossOrg = shared.filter((s) => s.distinctOrgs.length >= 2);
  const out = file.replace(/coverage-(\d{4}-\d{2}-\d{2})\.json$/, 'signers-$1.json');
  writeFileSync(out, JSON.stringify({ day: data.day, slot: data.slot, programs: rows.length, kinds, sharedSigners: shared }, null, 1));
  console.log(`programs ${rows.length}`, kinds);
  console.log(`keys in 2+ multisigs: ${shared.length}; spanning 2+ GitHub orgs: ${crossOrg.length}`);
  for (const s of crossOrg.slice(0, 10)) console.log(`  ${s.key.slice(0, 6)}…${s.key.slice(-4)}  ${s.multisigs.length} multisigs  orgs: ${s.distinctOrgs.join(', ')}`);
  console.log('wrote', out);
}

if (require.main === module) main();
