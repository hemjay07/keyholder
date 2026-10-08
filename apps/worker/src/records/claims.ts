// File: apps/worker/src/records/claims.ts
// Proof of Control (design/REVAMP-3.md, Part 1 §4, D5): a protocol states the control it intends,
// signs it, and Keyholder checks the chain against it every day. The claim is the protocol's statement;
// Keyholder only reports whether the chain matches it, and the transaction-level facts when it does not.

import nacl from 'tweetnacl';
import bs58 from 'bs58';
import type { ProgramRecord } from './build';

export const CLAIM_VERSION = 'keyholder-claim/v1';

export interface PathClaim {
  kind: 'immutable' | 'multisig' | 'governance' | 'single_key';
  /** multisig only */
  threshold?: { min: number };
  timelockS?: { min: number };
  /** pin a specific multisig address (optional) */
  multisig?: string;
}
export interface ProgramClaim { programId: string; upgrade: PathClaim; admin?: ({ account: string; field: string } & PathClaim)[] }
export interface ClaimBody { version: typeof CLAIM_VERSION; protocol: string; issuedAt: string; programs: ProgramClaim[] }
export interface SignedClaim extends ClaimBody { signer: string; signature: string }

/** Deterministic bytes to sign: JSON with keys sorted at every level. */
export function canonicalClaim(body: ClaimBody): Uint8Array {
  const sort = (v: unknown): unknown => (Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v);
  return new TextEncoder().encode(JSON.stringify(sort(body)));
}

export function signClaim(body: ClaimBody, secretKey: Uint8Array): SignedClaim {
  const kp = nacl.sign.keyPair.fromSecretKey(secretKey);
  return { ...body, signer: bs58.encode(kp.publicKey), signature: bs58.encode(nacl.sign.detached(canonicalClaim(body), kp.secretKey)) };
}

export function bodyOf(c: SignedClaim): ClaimBody {
  const { signer: _s, signature: _g, ...body } = c;
  return body;
}

export function signatureValid(c: SignedClaim): boolean {
  try { return nacl.sign.detached.verify(canonicalClaim(bodyOf(c)), bs58.decode(c.signature), bs58.decode(c.signer)); } catch { return false; }
}

/** Who may speak for a program: its single-key upgrade authority, or a member of the multisig that controls its upgrade. */
export function signerAuthorized(signer: string, r: ProgramRecord): boolean {
  if (r.upgrade.kind === 'single_key') return r.upgrade.authority === signer;
  return (r.upgrade.multisig?.memberKeys ?? []).includes(signer);
}

export interface Break { programId: string; path: string; expected: string; actual: string }
export interface ClaimCheck { protocol: string; day: string; status: 'holds' | 'broken' | 'invalid'; reasons: string[]; breaks: Break[] }

function checkPath(programId: string, path: string, c: PathClaim, actual: { kind: string; threshold?: number | null; members?: number | null; timelockS?: number | null; address?: string | null } | null): Break[] {
  const b = (expected: string, act: string): Break => ({ programId, path, expected, actual: act });
  if (!actual) return [b(c.kind, 'not found')];
  if (c.kind !== actual.kind) return [b(c.kind, actual.kind)];
  const out: Break[] = [];
  if (c.multisig && actual.address !== c.multisig) out.push(b(`multisig ${c.multisig}`, `multisig ${actual.address ?? 'none'}`));
  if (c.threshold && (actual.threshold ?? 0) < c.threshold.min) out.push(b(`threshold >= ${c.threshold.min}`, `${actual.threshold ?? 0} of ${actual.members ?? '?'}`));
  if (c.timelockS && (actual.timelockS ?? 0) < c.timelockS.min) out.push(b(`timelock >= ${c.timelockS.min} s`, `${actual.timelockS ?? 0} s`));
  return out;
}

const upgradeActual = (r: ProgramRecord) => r.upgrade.kind === 'immutable' ? { kind: 'immutable' }
  : r.upgrade.kind === 'single_key' ? { kind: 'single_key' }
  : r.upgrade.kind === 'spl_gov' ? { kind: 'governance' }
  : r.upgrade.multisig ? { kind: 'multisig', threshold: r.upgrade.multisig.threshold, members: r.upgrade.multisig.members, timelockS: r.upgrade.multisig.timelockS, address: r.upgrade.multisig.address }
  : { kind: r.upgrade.kind };

/** Check a signed claim against one day's records. `issued` are the records of the issue day (who could sign then). */
export function checkClaim(c: SignedClaim, day: string, records: Map<string, ProgramRecord>, issued: Map<string, ProgramRecord> = records): ClaimCheck {
  const reasons: string[] = [];
  if (c.version !== CLAIM_VERSION) reasons.push(`unknown claim version ${c.version}`);
  if (!signatureValid(c)) reasons.push('signature does not verify');
  for (const p of c.programs) {
    const r = issued.get(p.programId);
    if (!r) reasons.push(`${p.programId}: not covered`);
    else if (!signerAuthorized(c.signer, r)) reasons.push(`${p.programId}: signer is not the upgrade key or a member of its controlling multisig`);
  }
  if (reasons.length) return { protocol: c.protocol, day, status: 'invalid', reasons, breaks: [] };

  const breaks: Break[] = [];
  for (const p of c.programs) {
    const r = records.get(p.programId);
    if (!r || r.stage.modifiers.includes('closed')) { breaks.push({ programId: p.programId, path: 'program', expected: 'live program', actual: 'closed or missing' }); continue; }
    breaks.push(...checkPath(p.programId, 'upgrade', p.upgrade, upgradeActual(r)));
    for (const a of p.admin ?? []) {
      const x = r.admin.programWide.find((y) => y.account === a.account && y.field === a.field);
      const act = !x ? null : x.resolvedAs === 'single_key' ? { kind: 'single_key' } : x.multisig ? { kind: 'multisig', threshold: x.multisig.threshold, members: x.multisig.members, timelockS: x.multisig.timelockS, address: x.multisig.address } : { kind: 'unresolved' };
      breaks.push(...checkPath(p.programId, `admin:${a.account}.${a.field}`, a, act));
    }
  }
  return { protocol: c.protocol, day, status: breaks.length ? 'broken' : 'holds', reasons: [], breaks };
}
