// File: apps/worker/src/coverage/admin-keys.ts
// Admin keys inside program config (design/keybench/KEYBENCH.md, gap 1): Raydium 2022 and Pump.fun 2024 were
// drained through a privileged key stored in the program's own accounts, not through the upgrade authority.
// For each program with a published Anchor IDL: find config-like account types, read every pubkey field whose
// name says it holds power (admin, authority, owner, guardian, ...), and classify the key it holds:
// single_key (on-curve), squads/governance (by the owning program of that address), or pda.
// Only fields at a fixed offset are read (every field before them has a fixed size), so nothing is guessed.
// Run: npx tsx src/coverage/admin-keys.ts [coverage-file] -> data/coverage/admin-keys-<day>.json

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { createHash } from 'node:crypto';
import { discoverIdl, type AnchorIdl } from '@keyholder/decoder';

const DATA = join(__dirname, '..', '..', '..', '..', 'data', 'coverage');
const POWER_FIELD = /(^|_)(admin|authority|owner|guardian|manager|operator|pauser|emergency|council|withdraw_authority|super)/i;
const NOT_POWER = /(mint|vault|token_account|oracle|pyth|switchboard|feed|market$|reserve$|pool$|farm$)/i;
const PER_USER_ACCOUNT = /(referrer|user|obligation|position|ticket|order|stake_?account|deposit|loan|receipt|claim|vote|member)/i;
const CONFIG_ACCOUNT = /(config|global|state|admin|settings|lending_?market|protocol|perpetuals|vault_?config|fee|registry|root)/i;
const OWNERS: Record<string, string> = {
  SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf: 'squads_v4',
  SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu: 'squads_v3',
  msigmtwzgXJHj2ext4XJjCDmpbcMuufFb5cHuwg6Xdt: 'coral_multisig',
  GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw: 'spl_gov',
};

type Ty = string | { array?: [Ty, number]; defined?: { name: string } | string; option?: Ty; vec?: Ty };
const PRIM: Record<string, number> = { bool: 1, u8: 1, i8: 1, u16: 2, i16: 2, u32: 4, i32: 4, f32: 4, u64: 8, i64: 8, f64: 8, u128: 16, i128: 16, pubkey: 32, publicKey: 32 };

/** Fixed byte size of a type, or null if it varies (vec, string, option, enum with data). */
export function fixedSize(t: Ty, types: Map<string, { kind: string; fields?: { type: Ty }[]; variants?: { fields?: unknown[] }[] }>): number | null {
  if (typeof t === 'string') return PRIM[t] ?? null;
  if (t.array) { const s = fixedSize(t.array[0], types); return s == null ? null : s * t.array[1]; }
  if (t.defined) {
    const def = types.get(typeof t.defined === 'string' ? t.defined : t.defined.name);
    if (!def) return null;
    if (def.kind === 'struct') { let n = 0; for (const f of def.fields ?? []) { const s = fixedSize(f.type, types); if (s == null) return null; n += s; } return n; }
    if (def.kind === 'enum' && (def.variants ?? []).every((v) => !v.fields || v.fields.length === 0)) return 1;
    return null;
  }
  return null;
}

export interface PowerField { account: string; field: string; offset: number }

/** Power fields at fixed offsets in config-like accounts (offset includes the 8-byte discriminator). */
export function powerFields(idl: AnchorIdl): { account: string; discriminator: number[]; fields: PowerField[] }[] {
  const types = new Map<string, { kind: string; fields?: { name: string; type: Ty }[] }>();
  for (const t of idl.types ?? []) if (t.type) types.set(t.name, { kind: t.type.kind, fields: t.type.fields, ...(t.type.variants ? { variants: t.type.variants } : {}) } as never);
  const out = [];
  for (const acc of idl.accounts ?? []) {
    if (!CONFIG_ACCOUNT.test(acc.name) || PER_USER_ACCOUNT.test(acc.name)) continue;
    // legacy Anchor IDLs carry no discriminator: it is sha256("account:<Name>")[0..8]
    const discriminator = Array.isArray(acc.discriminator) ? (acc.discriminator as number[]) : [...createHash('sha256').update(`account:${acc.name}`).digest().subarray(0, 8)];
    const def = (acc.type ? { kind: acc.type.kind, fields: acc.type.fields } : types.get(acc.name)) as { kind: string; fields?: { name: string; type: Ty }[] } | undefined;
    if (!def || def.kind !== 'struct') continue;
    let off = 8; const fields: PowerField[] = [];
    for (const f of def.fields ?? []) {
      const s = fixedSize(f.type, types as never);
      const snake = f.name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      if ((f.type === 'pubkey' || f.type === 'publicKey') && POWER_FIELD.test(snake) && !NOT_POWER.test(snake)) fields.push({ account: acc.name, field: f.name, offset: off });
      if (s == null) break;
      off += s;
    }
    if (fields.length) out.push({ account: acc.name, discriminator, fields });
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const file = process.argv[2] ?? join(DATA, readdirSync(DATA).filter((f) => /^coverage-tvl-.*\.json$/.test(f)).sort().pop()!);
  const programs = (JSON.parse(readFileSync(file, 'utf8')) as { programs: { programId: string; authorityKind: string }[] }).programs;
  const conn = new Connection(process.env.DAILY_RPC_URL ?? 'https://api.mainnet-beta.solana.com', 'confirmed');
  const ownerCache = new Map<string, string | null>();
  const classify = async (key: string): Promise<string> => {
    if (key === '11111111111111111111111111111111') return 'none';
    if (PublicKey.isOnCurve(new PublicKey(key).toBytes())) return 'single_key';
    if (!ownerCache.has(key)) { const a = await conn.getAccountInfo(new PublicKey(key)); ownerCache.set(key, a ? a.owner.toBase58() : null); await sleep(150); }
    const o = ownerCache.get(key);
    return o ? OWNERS[o] ?? `pda_owned_by:${o}` : 'pda_no_account';
  };
  const results = [];
  for (const p of programs) {
    const row: Record<string, unknown> = { programId: p.programId, upgradeAuthorityKind: p.authorityKind };
    try {
      const idl = await discoverIdl(new PublicKey(p.programId), conn);
      await sleep(300);
      if (!idl) { results.push({ ...row, idl: null }); console.log(p.programId.slice(0, 8), 'no IDL'); continue; }
      const specs = powerFields(idl.idl as AnchorIdl);
      const keys = [];
      for (const s of specs) {
        const maxEnd = Math.max(...s.fields.map((f) => f.offset + 32));
        const accts = await conn.getProgramAccounts(new PublicKey(p.programId), { dataSlice: { offset: 0, length: maxEnd }, filters: [{ memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(s.discriminator)) } }] });
        await sleep(400);
        if (accts.length > 1000) { keys.push({ account: s.account, skipped: `${accts.length} accounts (per-user, not config)` }); continue; }
        for (const a of accts) for (const f of s.fields) {
          if (a.account.data.length < f.offset + 32) continue;
          const key = new PublicKey(a.account.data.subarray(f.offset, f.offset + 32)).toBase58();
          keys.push({ account: s.account, address: a.pubkey.toBase58(), field: f.field, key, kind: await classify(key) });
        }
      }
      results.push({ ...row, idl: idl.source, keys });
      const singles = keys.filter((k) => (k as { kind?: string }).kind === 'single_key').length;
      console.log(p.programId.slice(0, 8), idl.source, 'power keys', keys.length, 'single_key', singles);
    } catch (e) {
      results.push({ ...row, error: e instanceof Error ? e.message : String(e) });
      console.log(p.programId.slice(0, 8), 'ERROR', e instanceof Error ? e.message : e);
    }
  }
  const day = new Date().toISOString().slice(0, 10);
  writeFileSync(join(DATA, `admin-keys-${day}.json`), JSON.stringify({ day, source: file, programs: results }, null, 1));
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
