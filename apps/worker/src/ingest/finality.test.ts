import { describe, it, expect } from 'vitest';
import { isDueForFinalityCheck, resolveFinality, FinalityTracker, FINALITY_SLOT_DEPTH } from './finality';

describe('isDueForFinalityCheck', () => {
  it('is not due before 32 slots have passed', () => {
    expect(isDueForFinalityCheck(100, 100 + FINALITY_SLOT_DEPTH - 1)).toBe(false);
  });

  it('is due at exactly 32 slots', () => {
    expect(isDueForFinalityCheck(100, 100 + FINALITY_SLOT_DEPTH)).toBe(true);
  });
});

describe('resolveFinality', () => {
  it('finalizes when the status matches the recorded slot and reports finalized', () => {
    const verdict = resolveFinality(100, { slot: 100, confirmationStatus: 'finalized', err: null });
    expect(verdict).toBe('finalized');
  });

  it('stays confirmed when still only confirmed at the recorded slot', () => {
    const verdict = resolveFinality(100, { slot: 100, confirmationStatus: 'confirmed', err: null });
    expect(verdict).toBe('confirmed');
  });

  it('treats a missing status as reorged, never silently finalized', () => {
    expect(resolveFinality(100, null)).toBe('reorged');
  });

  it('treats a different recorded slot as reorged', () => {
    const verdict = resolveFinality(100, { slot: 105, confirmationStatus: 'finalized', err: null });
    expect(verdict).toBe('reorged');
  });
});

describe('FinalityTracker', () => {
  it('reports signatures due for re-check once the tip has advanced', () => {
    const tracker = new FinalityTracker();
    tracker.track('sig1', 100);
    tracker.track('sig2', 200);

    expect(tracker.due(132)).toEqual([{ signature: 'sig1', slot: 100 }]);
    expect(tracker.due(232)).toEqual(
      expect.arrayContaining([
        { signature: 'sig1', slot: 100 },
        { signature: 'sig2', slot: 200 },
      ])
    );
  });

  it('untrack removes a signature from future due() results', () => {
    const tracker = new FinalityTracker();
    tracker.track('sig1', 100);
    tracker.untrack('sig1');
    expect(tracker.due(1000)).toEqual([]);
  });

  it('does not double-track the same signature at a different slot', () => {
    const tracker = new FinalityTracker();
    tracker.track('sig1', 100);
    tracker.track('sig1', 999); // should be a no-op; first recorded slot wins
    expect(tracker.size()).toBe(1);
    expect(tracker.due(132)).toEqual([{ signature: 'sig1', slot: 100 }]);
  });
});
