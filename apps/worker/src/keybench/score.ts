// File: apps/worker/src/keybench/score.ts
// KeyBench (design/MOAT-BUILD.md, A): run each chain-verified incident through Keyholder's
// risk engine and measure the warning it would have given before the first loss.
// Two scores per incident, never merged:
//   - shipped: rules that existed before KeyBench (the honest out-of-sample result);
//   - current: shipped + rules added after studying these incidents (in-sample, labelled so).
// Incidents live in data/keybench/<id>.json (written by scripts/keybench/*.py from chain reads).
// Run: npx tsx src/keybench/score.ts  -> writes data/keybench/results.json

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateDelta, RULES, RULES_BY_ID, EMPTY_CONTROL_STATE, type ControlState, type RiskDelta } from '@keyholder/risk';
import { replayDriftIncident } from '../replay/drift-replay';

const DIR = join(__dirname, '..', '..', '..', '..', 'data', 'keybench');

/** Rules added after KeyBench started; everything else counts as shipped. */
export const ADDED_AFTER_KEYBENCH = new Set(['control_proposal_pending']);
const SHIPPED = RULES.map((r) => r.id).filter((id) => !ADDED_AFTER_KEYBENCH.has(id));
const CURRENT = RULES.map((r) => r.id);

export interface IncidentEvent { kind: string; what: string; sig: string; slot: number; time: string }
export interface Incident { id: string; name: string; class: string; events: IncidentEvent[]; [k: string]: unknown }

export interface Alert { ruleId: string; severity: RiskDelta['severity']; at: string; slot: number; sig: string }
export interface Score { firstAlert: Alert | null; leadTimeSeconds: number | null; posture: string[] }
export interface IncidentResult { id: string; name: string; class: string; firstLoss: { time: string; sig: string; slot: number }; shipped: Score; current: Score; note: string }

const seconds = (t: string) => Date.parse(t.replace(' ', 'T') + 'Z') / 1000;

/** Control state each incident's protocol was in before the attack, as read from chain (see the incident file). */
export function initialState(inc: Incident): ControlState {
  if (inc.class.startsWith('governance')) return { ...EMPTY_CONTROL_STATE, authorityKind: 'spl_gov', authorityAddress: String(inc.governance ?? '') };
  if (inc.class === 'admin_key') return { ...EMPTY_CONTROL_STATE, authorityKind: 'squads_vault', admin: String(inc.admin_key ?? '') };
  return { ...EMPTY_CONTROL_STATE };
}

/** The facts the engine sees for one on-chain event. Only events Keyholder's ingest can decode carry facts. */
export function eventFacts(e: IncidentEvent, inc: Incident): Record<string, unknown> {
  if (e.kind === 'upgrade_proposal_created') return { kind: 'governance_proposal', touches: 'program_upgrade', proposal: inc.attack_proposal ?? inc.proposal };
  if (e.kind === 'treasury_proposal_created') return { kind: 'governance_proposal', touches: 'treasury_transfer', proposal: inc.proposal ?? inc.attack_proposal };
  return {};
}

export function scoreIncident(inc: Incident, ruleIds: string[]): Score {
  const loss = inc.events.find((e) => e.kind === 'first_loss');
  if (!loss) throw new Error(`${inc.id}: no first_loss event`);
  const state = initialState(inc);
  const posture = evaluateDelta(EMPTY_CONTROL_STATE, state, { protocolId: inc.id, slot: 0 }, {}, { ruleIds })
    .filter((d) => RULES_BY_ID.get(d.ruleId)?.standing).map((d) => d.ruleId);
  let firstAlert: Alert | null = null;
  for (const e of [...inc.events].sort((a, b) => a.slot - b.slot)) {
    if (e.slot >= loss.slot) break;
    const fired = evaluateDelta(state, state, { protocolId: inc.id, slot: e.slot }, eventFacts(e, inc), { ruleIds })
      .filter((d) => !RULES_BY_ID.get(d.ruleId)?.standing);
    if (fired.length && !firstAlert) firstAlert = { ruleId: fired[0]!.ruleId, severity: fired[0]!.severity, at: e.time, slot: e.slot, sig: e.sig };
  }
  return { firstAlert, leadTimeSeconds: firstAlert ? seconds(loss.time) - seconds(firstAlert.at) : null, posture };
}

function driftResult(): IncidentResult {
  const r = replayDriftIncident();
  const toScore = (): Score => ({
    firstAlert: r.firstTransitionAlert ? { ruleId: r.firstTransitionAlert.delta.ruleId, severity: r.firstTransitionAlert.delta.severity, at: r.firstTransitionAlert.frame.time, slot: r.firstTransitionAlert.frame.slot, sig: r.firstTransitionAlert.frame.signature } : null,
    leadTimeSeconds: r.leadTimeSeconds,
    posture: r.postureAtWindowStart.map((d) => d.ruleId),
  });
  return {
    id: 'drift-2026', name: 'Drift Protocol (Apr 2026)', class: 'multisig_admin',
    firstLoss: { time: r.firstDrainFrame.time, sig: r.firstDrainFrame.signature, slot: r.firstDrainFrame.slot },
    shipped: toScore(), current: toScore(),
    note: 'Replayed by src/replay/drift-replay.ts from data/drift-2026/timeline.json (15 on-chain steps).',
  };
}

const NOTES: Record<string, string> = {
  'raydium-2022': "The stolen key was the AMM admin key compiled into the program, used directly with no prior on-chain control change. Keyholder does not model compiled-in admin keys, so it gives no warning. The upgrade authority was already a multisig.",
  'synthetify-2023': 'The drain was a program upgrade passed through governance; the upgrade proposal sat on chain from creation to execution.',
  'rain-2026': 'A flaw in an outdated card contract let the attacker grant itself collateral-admin rights (AddCollateralAdmin), then withdraw. The grant came 4 min 59 s before the first withdrawal; no shipped rule reads that instruction, and the program was not tracked.',
  'bonkdao-2026': 'A treasury-transfer proposal (BIP #76) passed by purchased voting power; it sat on chain for days before executing.',
};

export function scoreAll(): IncidentResult[] {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'results.json');
  const out: IncidentResult[] = [driftResult()];
  for (const f of files) {
    const inc = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Incident;
    const loss = inc.events.find((e) => e.kind === 'first_loss')!;
    out.push({ id: inc.id, name: inc.name, class: inc.class, firstLoss: { time: loss.time, sig: loss.sig, slot: loss.slot }, shipped: scoreIncident(inc, SHIPPED), current: scoreIncident(inc, CURRENT), note: NOTES[inc.id] ?? '' });
  }
  return out.sort((a, b) => a.firstLoss.time.localeCompare(b.firstLoss.time));
}

if (require.main === module) {
  const results = scoreAll();
  const body = JSON.stringify({ generated: new Date().toISOString(), shippedRules: SHIPPED, addedAfterKeyBench: [...ADDED_AFTER_KEYBENCH], results }, null, 1);
  writeFileSync(join(DIR, 'results.json'), body);
  // The site renders the same file (apps/web/src/app/keybench).
  writeFileSync(join(__dirname, '..', '..', '..', 'web', 'src', 'data', 'keybench.json'), body);
  for (const r of results) {
    const fmt = (s: Score) => (s.leadTimeSeconds == null ? 'no warning' : `${(s.leadTimeSeconds / 86400).toFixed(2)} d (${s.firstAlert!.ruleId})`);
    console.log(`${r.name.padEnd(30)} shipped: ${fmt(r.shipped).padEnd(44)} current: ${fmt(r.current)}`);
  }
}
