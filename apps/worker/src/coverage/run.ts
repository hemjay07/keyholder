// File: apps/worker/src/coverage/run.ts
// The data moat, layer 1 (design/DATA-MOAT.md): resolve who controls every
// OtterSec-verified Solana program, down to each signer key. Read-only against
// chain; writes one dated JSON file. Run: npx tsx src/coverage/run.ts
//
// Per program: name from its verified repo URL; ProgramData -> upgrade
// authority (resolveAuthority: immutable / direct Squads v4); otherwise the
// authority's own history (resolveAuthorityHistorically: Squads vault, v3,
// coral, governance); then the multisig account is read and its member keys
// decoded. Anything not resolved is recorded as unresolved, never guessed.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Connection, PublicKey } from '@solana/web3.js';
import { parseSquadsV4Multisig, parseSquadsV3Multisig, parseCoralMultisig, SQUADS_V4_PROGRAM_ID, SQUADS_V3_PROGRAM_ID, CORAL_MULTISIG_PROGRAM_ID } from '@keyholder/decoder';
import { resolveAuthority } from '../state-builder/authority';
import { resolveAuthorityHistorically } from '../state-builder/authority-history';

const RPC = process.env.COVERAGE_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const GAP_MS = Number(process.env.COVERAGE_GAP_MS ?? 400);
const LIMIT = Number(process.env.COVERAGE_LIMIT ?? 10_000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; await sleep(1500 * 2 ** i); }
  }
  throw last;
}

async function verifiedProgramIds(): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page < 100; page++) {
    const r = (await withRetry(() => fetch(`https://verify.osec.io/verified-programs/${page}`).then((x) => x.json()))) as { verified_programs: string[]; meta?: { has_next_page?: boolean } };
    ids.push(...(r.verified_programs as string[]));
    if (!r.meta?.has_next_page) break;
  }
  return [...new Set(ids)];
}

async function repoOf(programId: string): Promise<string | null> {
  try {
    const r = (await withRetry(() => fetch(`https://verify.osec.io/status/${programId}`).then((x) => x.json()), 3)) as { repo_url?: unknown };
    return typeof r.repo_url === 'string' ? r.repo_url : null;
  } catch { return null; }
}

async function members(connection: Connection, multisig: string): Promise<{ program: string; members: string[] } | null> {
  const info = await withRetry(() => connection.getAccountInfo(new PublicKey(multisig)));
  if (!info) return null;
  const owner = info.owner.toBase58();
  try {
    if (owner === SQUADS_V4_PROGRAM_ID) return { program: 'squads_v4', members: parseSquadsV4Multisig(info.data).members.map((m) => m.key) };
    if (owner === SQUADS_V3_PROGRAM_ID) return { program: 'squads_v3', members: parseSquadsV3Multisig(info.data).members };
    if (owner === CORAL_MULTISIG_PROGRAM_ID) return { program: 'coral', members: parseCoralMultisig(info.data).owners };
  } catch { /* not a multisig layout we decode */ }
  return { program: owner, members: [] };
}

async function main(): Promise<void> {
  const connection = new Connection(RPC, 'confirmed');
  // COVERAGE_RESUME=<file>: re-resolve only the unresolved/errored rows of an earlier run, keep the rest.
  const resume = process.env.COVERAGE_RESUME ? (JSON.parse(readFileSync(process.env.COVERAGE_RESUME, 'utf8')) as { programs: Array<Record<string, unknown>> }) : null;
  const kept = resume ? resume.programs.filter((r) => !r.error && r.authorityKind !== 'single_key_or_vault_unresolved') : [];
  const idsFile = process.env.COVERAGE_IDS_FILE ? readFileSync(process.env.COVERAGE_IDS_FILE, 'utf8').split(/\s+/).filter(Boolean) : null;
  const ids = idsFile ? idsFile : resume ? resume.programs.filter((r) => !kept.includes(r)).map((r) => String(r.programId)) : (await verifiedProgramIds()).slice(0, LIMIT);
  const slot = await withRetry(() => connection.getSlot());
  console.log(`coverage: ${ids.length} verified programs, slot ${slot}, rpc ${/api-key|\/v2\//.test(RPC) ? 'keyed' : RPC}`);
  const rows: unknown[] = [...kept];
  let n = 0;
  for (const programId of ids) {
    n++;
    const row: Record<string, unknown> = { programId };
    try {
      row.repo = await repoOf(programId);
      const direct = await withRetry(() => resolveAuthority(connection, { programId }));
      row.programData = direct.programDataAddr;
      row.upgradeAuthority = direct.upgradeAuthority;
      let kind: string = direct.authorityKind;
      let multisig = direct.multisig;
      if (kind === 'single_key_or_vault_unresolved' && direct.upgradeAuthority) {
        const hist = await withRetry(() => resolveAuthorityHistorically(connection, direct.upgradeAuthority!, { limit: 10 }), 2);
        kind = hist.authorityKind; multisig = hist.multisig; row.evidence = hist.evidenceSignature;
      }
      row.authorityKind = kind;
      row.multisig = multisig;
      if (multisig?.address) row.signers = await members(connection, multisig.address);
    } catch (e) {
      row.error = e instanceof Error ? e.message.slice(0, 160) : String(e);
    }
    rows.push(row);
    if (n % 10 === 0) process.stderr.write(`  ${n}/${ids.length}\n`);
    await sleep(GAP_MS);
  }
  const dir = join(__dirname, '..', '..', '..', '..', 'data', 'coverage');
  mkdirSync(dir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const out = join(dir, process.env.COVERAGE_OUT ?? `coverage-${day}.json`);
  writeFileSync(out, JSON.stringify({ day, slot, source: 'verify.osec.io verified programs', programs: rows }, null, 1));
  const kinds: Record<string, number> = {};
  for (const r of rows as Array<{ authorityKind?: string; error?: string }>) { const k = r.error ? 'error' : r.authorityKind ?? '?'; kinds[k] = (kinds[k] ?? 0) + 1; }
  console.log('wrote', out); console.log(kinds);
}

main().catch((e) => { console.error(e); process.exit(1); });
