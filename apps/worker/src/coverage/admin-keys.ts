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
import { discoverIdl, decodeAnchorAccount, anchorAccountDef, type AnchorIdl } from '@keyholder/decoder';

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

const snake = (n: string) => n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const isPower = (name: string) => POWER_FIELD.test(snake(name)) && !NOT_POWER.test(snake(name));
const looksLikeKey = (v: unknown): v is string => typeof v === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);

/** Config-like accounts with a struct definition, and their discriminator (computed for legacy IDLs). */
export function candidateAccounts(idl: AnchorIdl): { account: string; discriminator: number[] }[] {
  return (idl.accounts ?? [])
    .filter((a: { name: string }) => CONFIG_ACCOUNT.test(a.name) && !PER_USER_ACCOUNT.test(a.name) && anchorAccountDef(idl, a.name))
    .map((a: { name: string; discriminator?: number[] }) => ({ account: a.name, discriminator: Array.isArray(a.discriminator) ? a.discriminator : [...createHash('sha256').update(`account:${a.name}`).digest().subarray(0, 8)] }));
}

/** Every pubkey in a decoded account whose field name says it holds power, at any depth (path joined with '.'). */
export function powerKeysIn(v: unknown, path = ''): { field: string; key: string }[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => powerKeysIn(x, `${path}[${i}]`));
  if (!v || typeof v !== 'object') return [];
  return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => {
    const p = path ? `${path}.${k}` : k;
    if (looksLikeKey(x)) return isPower(k) ? [{ field: p, key: x }] : [];
    return powerKeysIn(x, p);
  });
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
      // Full decode (2026-10-08): fields after a vec/option/string are read too; a failed decode marks the program partial.
      const keys: Record<string, unknown>[] = []; const partial: { account: string; instances: number; failed: number }[] = [];
      for (const s of candidateAccounts(idl.idl as AnchorIdl)) {
        const filters = [{ memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(s.discriminator)) } }];
        const count = (await conn.getProgramAccounts(new PublicKey(p.programId), { dataSlice: { offset: 0, length: 0 }, filters })).length;
        await sleep(300);
        if (count === 0) continue;
        if (count > 1000) { keys.push({ account: s.account, skipped: `${count} accounts (per-user, not config)` }); continue; }
        const accts = await conn.getProgramAccounts(new PublicKey(p.programId), { filters });
        await sleep(400);
        for (const a of accts) {
          let decoded: Record<string, unknown>;
          try { decoded = decodeAnchorAccount(idl.idl as AnchorIdl, s.account, a.account.data); }
          catch {
            const e = partial.find((x) => x.account === s.account);
            if (e) e.failed += 1; else partial.push({ account: s.account, instances: accts.length, failed: 1 });
            continue;
          }
          for (const f of powerKeysIn(decoded)) keys.push({ account: s.account, address: a.pubkey.toBase58(), field: f.field, key: f.key, kind: await classify(f.key) });
        }
      }
      results.push({ ...row, idl: idl.source, keys, ...(partial.length ? { partial } : {}) });
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
