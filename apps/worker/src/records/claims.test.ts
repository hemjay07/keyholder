import { describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { signClaim, checkClaim, signatureValid, CLAIM_VERSION, type ClaimBody } from './claims';
import type { ProgramRecord } from './build';

const member = nacl.sign.keyPair(); const outsider = nacl.sign.keyPair();
const M = bs58.encode(member.publicKey);
const rec = (o: { threshold?: number; timelockS?: number; address?: string; closed?: boolean } = {}): ProgramRecord => ({
  programId: 'P', repo: null, usdFloor: null,
  upgrade: { authority: 'V', kind: 'squads_vault', multisig: { address: o.address ?? 'MS', threshold: o.threshold ?? 3, members: 5, memberKeys: [M, 'b', 'c', 'd', 'e'], timelockS: o.timelockS ?? 172800, version: 'v4' }, timelockCarried: false },
  admin: { status: 'read', undecoded: [], programWide: [], perInstance: [] },
  stage: { programId: 'P', rulesVersion: 'stages/v1', stage: 2, bindingPath: 'upgrade', paths: [], modifiers: o.closed ? ['closed'] : [], cap: null },
});
const body: ClaimBody = { version: CLAIM_VERSION, protocol: 'Example', issuedAt: '2026-10-08T00:00:00Z', programs: [{ programId: 'P', upgrade: { kind: 'multisig', threshold: { min: 3 }, timelockS: { min: 86400 }, multisig: 'MS' } }] };
const day = (r: ProgramRecord) => new Map([[r.programId, r]]);

describe('Proof of Control', () => {
  const claim = signClaim(body, member.secretKey);
  it('a claim signed by a member of the controlling multisig holds while the chain matches', () => {
    expect(signatureValid(claim)).toBe(true);
    expect(checkClaim(claim, '2026-10-08', day(rec())).status).toBe('holds');
  });
  it('Drift-shaped: the timelock goes to zero -> broken, with expected and actual', () => {
    const c = checkClaim(claim, '2026-03-27', day(rec({ timelockS: 0 })), day(rec()));
    expect(c.status).toBe('broken');
    expect(c.breaks).toEqual([{ programId: 'P', path: 'upgrade', expected: 'timelock >= 86400 s', actual: '0 s' }]);
  });
  it('threshold lowered, multisig swapped, program closed: each is a break', () => {
    expect(checkClaim(claim, 'd', day(rec({ threshold: 2 })), day(rec())).breaks[0]!.actual).toBe('2 of 5');
    expect(checkClaim(claim, 'd', day(rec({ address: 'OTHER' })), day(rec())).breaks[0]!.expected).toBe('multisig MS');
    expect(checkClaim(claim, 'd', day(rec({ closed: true })), day(rec())).breaks[0]!.actual).toBe('closed or missing');
  });
  it('invalid: tampered body, or a signer with no control over the program', () => {
    const tampered = { ...claim, programs: [{ ...claim.programs[0]!, upgrade: { ...claim.programs[0]!.upgrade, timelockS: { min: 0 } } }] };
    expect(checkClaim(tampered, 'd', day(rec())).status).toBe('invalid');
    const byOutsider = signClaim(body, outsider.secretKey);
    expect(signatureValid(byOutsider)).toBe(true);
    expect(checkClaim(byOutsider, 'd', day(rec())).reasons[0]).toMatch(/signer is not/);
  });
});
