import { describe, it, expect } from 'vitest';
import { SignatureLru, dedupCheck } from './dedup';

describe('dedup property: same signature from 3 sources -> exactly 1 "new" verdict', () => {
  it('marks the first sighting new and every subsequent sighting a duplicate', () => {
    const lru = new SignatureLru();
    const sig = 'abc123';

    const first = dedupCheck(lru, sig); // e.g. yellowstone
    const second = dedupCheck(lru, sig); // e.g. ws logsSubscribe
    const third = dedupCheck(lru, sig); // e.g. poller reconciliation

    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    expect(third.isNew).toBe(false);
  });

  it('treats different signatures independently', () => {
    const lru = new SignatureLru();
    expect(dedupCheck(lru, 'a').isNew).toBe(true);
    expect(dedupCheck(lru, 'b').isNew).toBe(true);
    expect(dedupCheck(lru, 'a').isNew).toBe(false);
  });
});

describe('SignatureLru capacity eviction', () => {
  it('evicts the oldest entry once over capacity', () => {
    const lru = new SignatureLru(2);
    lru.mark('a');
    lru.mark('b');
    lru.mark('c'); // evicts 'a'
    expect(lru.has('a')).toBe(false);
    expect(lru.has('b')).toBe(true);
    expect(lru.has('c')).toBe(true);
  });

  it('re-marking an existing key refreshes its recency instead of duplicating', () => {
    const lru = new SignatureLru(2);
    lru.mark('a');
    lru.mark('b');
    lru.mark('a'); // 'a' now most-recent; 'b' is oldest
    lru.mark('c'); // evicts 'b'
    expect(lru.has('b')).toBe(false);
    expect(lru.has('a')).toBe(true);
    expect(lru.has('c')).toBe(true);
  });
});
