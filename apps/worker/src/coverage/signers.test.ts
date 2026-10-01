import { describe, expect, it } from 'vitest';
import { orgOf, sharedSigners } from './signers';

const ms = (address: string, members: string[], repo: string, programId: string) => ({
  programId, repo, authorityKind: 'squads_vault',
  multisig: { address, threshold: 2, memberCount: members.length },
  signers: { program: 'squads_v4', members },
});

describe('orgOf', () => {
  it('happy: reads the org from a GitHub URL', () => expect(orgOf('https://github.com/Marinade-Finance/x/tree/abc')).toBe('marinade-finance'));
  it('edge: null for a non-GitHub or missing repo', () => { expect(orgOf('https://gitlab.com/a/b')).toBeNull(); expect(orgOf(null)).toBeNull(); });
});

describe('sharedSigners', () => {
  it('happy: a key in two multisigs of different orgs is cross-org', () => {
    const out = sharedSigners([ms('M1', ['K', 'A'], 'https://github.com/orgA/p/', 'P1'), ms('M2', ['K', 'B'], 'https://github.com/orgB/q/', 'P2')]);
    expect(out).toHaveLength(1);
    expect(out[0]!.key).toBe('K');
    expect(out[0]!.distinctOrgs.sort()).toEqual(['orga', 'orgb']);
  });
  it('edge: one multisig controlling two programs is not a shared signer', () => {
    const out = sharedSigners([ms('M1', ['K', 'A'], 'https://github.com/orgA/p/', 'P1'), ms('M1', ['K', 'A'], 'https://github.com/orgA/q/', 'P2')]);
    expect(out).toHaveLength(0);
  });
  it('error: rows without signers are ignored, not counted', () => {
    const out = sharedSigners([{ programId: 'P', authorityKind: 'immutable', multisig: null, signers: null }]);
    expect(out).toHaveLength(0);
  });
});
