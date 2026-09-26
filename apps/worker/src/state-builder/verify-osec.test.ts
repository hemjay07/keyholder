// File: apps/worker/src/state-builder/verify-osec.test.ts
// Task 3.1 — real live HTTP call to verify.osec.io (REAL ONLY: no mocked
// fetch for the happy-path assertion of the real response shape), plus
// edge/error cases using an injected fetchImpl so a flaky network doesn't
// make those two deterministic.

import { describe, it, expect } from 'vitest';
import { fetchVerificationStatus } from './verify-osec';

const DRIFT_PROGRAM_ID = 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH';

describe('fetchVerificationStatus', () => {
  it('happy: real live call to verify.osec.io for Drift returns a typed, non-fabricated result', async () => {
    const result = await fetchVerificationStatus(DRIFT_PROGRAM_ID);
    expect(result.error).toBeNull();
    expect(['verified', 'unverified']).toContain(result.verifiedStatus);
    expect(typeof result.isVerified).toBe('boolean');
    // Real field observed live 2026-09-26: on_chain_hash present.
    expect(result.onChainHash).not.toBeNull();
  }, 15_000);

  it('edge: HTTP error status maps to unknown, not a thrown error', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const result = await fetchVerificationStatus('anything', { fetchImpl });
    expect(result.verifiedStatus).toBe('unknown');
    expect(result.error).toContain('500');
  });

  it('error: network failure is caught and reported, never fabricated as verified/unverified', async () => {
    const fetchImpl = (async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;
    const result = await fetchVerificationStatus('anything', { fetchImpl });
    expect(result.verifiedStatus).toBe('unknown');
    expect(result.isVerified).toBeNull();
    expect(result.error).toContain('ECONNRESET');
  });
});
