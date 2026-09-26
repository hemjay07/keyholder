// File: apps/worker/src/alert-dispatcher/webhooks.test.ts
import { describe, it, expect } from 'vitest';
import { signPayload, verifySignature } from './webhooks';

describe('webhook HMAC signing', () => {
  it('happy: a signature produced by signPayload verifies with the same secret', () => {
    const payload = JSON.stringify({ hello: 'world' });
    const secret = 'whsec_test';
    const timestamp = 1_700_000_000;
    const header = signPayload(payload, secret, timestamp);
    expect(header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
    expect(verifySignature(header, payload, secret)).toBe(true);
  });

  it('edge: a tampered payload fails verification', () => {
    const secret = 'whsec_test';
    const header = signPayload(JSON.stringify({ a: 1 }), secret, 1_700_000_000);
    expect(verifySignature(header, JSON.stringify({ a: 2 }), secret)).toBe(false);
  });

  it('edge: the wrong secret fails verification', () => {
    const payload = JSON.stringify({ a: 1 });
    const header = signPayload(payload, 'secret-a', 1_700_000_000);
    expect(verifySignature(header, payload, 'secret-b')).toBe(false);
  });

  it('error: a malformed header is rejected, not thrown', () => {
    expect(verifySignature('not-a-signature', '{}', 'secret')).toBe(false);
  });
});
