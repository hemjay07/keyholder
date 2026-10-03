import { describe, expect, it } from 'vitest';
import { scoreIncident, scoreAll, type Incident } from './score';

const inc = (events: Incident['events'], cls = 'governance_upgrade'): Incident => ({ id: 't', name: 't', class: cls, governance: 'G', attack_proposal: 'P', events });

describe('scoreIncident', () => {
  it('happy: an upgrade proposal before the loss gives a lead time from the proposal', () => {
    const s = scoreIncident(inc([
      { kind: 'upgrade_proposal_created', what: '', sig: 'a', slot: 1, time: '2023-10-09 08:00:00' },
      { kind: 'first_loss', what: '', sig: 'b', slot: 2, time: '2023-10-10 08:00:00' },
    ]), ['control_proposal_pending']);
    expect(s.firstAlert?.ruleId).toBe('control_proposal_pending');
    expect(s.leadTimeSeconds).toBe(86400);
  });
  it('edge: an event after the loss never counts', () => {
    const s = scoreIncident(inc([
      { kind: 'first_loss', what: '', sig: 'b', slot: 2, time: '2023-10-10 08:00:00' },
      { kind: 'upgrade_proposal_created', what: '', sig: 'a', slot: 3, time: '2023-10-11 08:00:00' },
    ]), ['control_proposal_pending']);
    expect(s.firstAlert).toBeNull();
    expect(s.leadTimeSeconds).toBeNull();
  });
  it('error: without the rule enabled there is no warning; no first_loss throws', () => {
    expect(scoreIncident(inc([
      { kind: 'upgrade_proposal_created', what: '', sig: 'a', slot: 1, time: '2023-10-09 08:00:00' },
      { kind: 'first_loss', what: '', sig: 'b', slot: 2, time: '2023-10-10 08:00:00' },
    ]), ['admin_changed']).leadTimeSeconds).toBeNull();
    expect(() => scoreIncident(inc([]), [])).toThrow(/first_loss/);
  });
});

describe('scoreAll on the chain-verified incident files', () => {
  const r = Object.fromEntries(scoreAll().map((x) => [x.id, x]));
  it('Raydium 2022: no warning under any rule set (compiled admin key)', () => {
    expect(r['raydium-2022']!.shipped.leadTimeSeconds).toBeNull();
    expect(r['raydium-2022']!.current.leadTimeSeconds).toBeNull();
  });
  it('Synthetify 2023: shipped rules miss; the proposal rule warns from creation (2023-10-09 08:42:35) to first loss', () => {
    expect(r['synthetify-2023']!.shipped.leadTimeSeconds).toBeNull();
    expect(r['synthetify-2023']!.current.firstAlert?.sig.startsWith('3rLEAWpH')).toBe(true);
    expect(r['synthetify-2023']!.current.leadTimeSeconds).toBeGreaterThan(8 * 86400);
  });
  it('BonkDAO 2026: shipped rules miss; the proposal rule warns ~6 days ahead', () => {
    expect(r['bonkdao-2026']!.shipped.leadTimeSeconds).toBeNull();
    expect(Math.round(r['bonkdao-2026']!.current.leadTimeSeconds! / 86400)).toBe(6);
  });
});
