// File: apps/worker/src/pipeline/idl-cache.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createIdlCache } from './idl-cache';

vi.mock('@keyholder/decoder', async () => {
  const actual = await vi.importActual<typeof import('@keyholder/decoder')>('@keyholder/decoder');
  return { ...actual, discoverIdl: vi.fn() };
});

import { discoverIdl } from '@keyholder/decoder';

describe('createIdlCache', () => {
  it('happy: caches a resolved IDL across repeated gets for the same program', async () => {
    const idl = { idl: { name: 'test' }, source: 'legacy_anchor' as const, address: 'addr' };
    (discoverIdl as ReturnType<typeof vi.fn>).mockResolvedValue(idl);
    const cache = createIdlCache({} as any);
    const programA = 'SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf';

    const a = await cache.get(programA);
    const b = await cache.get(programA);

    expect(a).toEqual(idl);
    expect(b).toEqual(idl);
    expect(discoverIdl).toHaveBeenCalledTimes(1);
  });

  it('edge: caches a null result (no IDL found) rather than re-fetching', async () => {
    (discoverIdl as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const cache = createIdlCache({} as any);
    const programB = 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH';

    await cache.get(programB);
    await cache.get(programB);

    expect(discoverIdl).toHaveBeenCalledTimes(1);
  });

  it('error: a rejected discoverIdl call resolves to null rather than throwing', async () => {
    (discoverIdl as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('rpc down'));
    const cache = createIdlCache({} as any);

    const result = await cache.get('SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu');

    expect(result).toBeNull();
  });
});
