// File: packages/stages/src/stages.ts
// Control Stages (design/REVAMP-3.md, Part 1 §1): a program's stage is the LOWEST stage any of its
// control paths reaches. Paths are the upgrade authority and every program-wide admin field in config.
// Pure and deterministic: the same facts always give the same stage. Rules are versioned; a change to
// any rule is a new version, never an edit of an old one.

export const RULES_VERSION = 'stages/v1';
export const DAY_S = 86_400;
export const STAGE_2_MIN_DELAY_S = DAY_S;      // 24 h
export const STAGE_3_MIN_DELAY_S = 7 * DAY_S;  // 7 days: users can exit before a change lands

export type Stage = 0 | 1 | 2 | 3;

/** One way to change the program or move what it holds. */
export type ControlPath =
  | { path: string; kind: 'immutable' }
  | { path: string; kind: 'single_key'; key: string }
  | { path: string; kind: 'multisig'; address: string; threshold: number; members: number; timelockS: number | null; version: 'v3' | 'v4' | 'coral' }
  | { path: string; kind: 'governance'; address: string; holdUpS: number | null }
  | { path: string; kind: 'unresolved'; key: string | null; note?: string };

export interface ProgramFacts {
  programId: string;
  /** The upgrade-authority path. Always present. */
  upgrade: ControlPath;
  /** Program-wide admin fields read from config. */
  admin: ControlPath[];
  /** 'read': admin config was read (admin may be empty: no admin fields). 'unknown': not readable (no IDL). */
  adminStatus: 'read' | 'unknown';
  closed?: boolean;
}

export interface PathVerdict { path: string; stage: Stage; reason: string }
export type Modifier = 'admin_unknown' | 'admin_unresolved' | 'upgrade_unresolved' | 'closed';

export interface StageResult {
  programId: string;
  rulesVersion: typeof RULES_VERSION;
  stage: Stage;
  /** The path that set the stage (the weakest), or the cap that did. */
  bindingPath: string;
  paths: PathVerdict[];
  modifiers: Modifier[];
  /** Set when a cap (unknown or unresolved admin) held the stage below what the paths alone give. */
  cap: { stage: Stage; reason: string } | null;
}

const fmt = (s: number) => (s % DAY_S === 0 ? `${s / DAY_S} d` : s % 3600 === 0 ? `${s / 3600} h` : `${s} s`);

/** Stage of one path on its own. */
export function pathStage(p: ControlPath): PathVerdict {
  switch (p.kind) {
    case 'immutable':
      return { path: p.path, stage: 3, reason: 'no one can change it' };
    case 'single_key':
      return { path: p.path, stage: 0, reason: 'one key can act alone' };
    case 'unresolved':
      return { path: p.path, stage: 0, reason: 'controller not resolved; treated as one key' };
    case 'multisig': {
      if (p.threshold < 2) return { path: p.path, stage: 0, reason: `${p.threshold} of ${p.members}: any one member can act alone` };
      const t = p.timelockS ?? 0;
      if (t >= STAGE_3_MIN_DELAY_S) return { path: p.path, stage: 3, reason: `${p.threshold} of ${p.members}, ${fmt(t)} timelock` };
      if (t >= STAGE_2_MIN_DELAY_S) return { path: p.path, stage: 2, reason: `${p.threshold} of ${p.members}, ${fmt(t)} timelock` };
      return { path: p.path, stage: 1, reason: t > 0 ? `${p.threshold} of ${p.members}, ${fmt(t)} timelock (under 24 h)` : `${p.threshold} of ${p.members}, no timelock` };
    }
    case 'governance': {
      const h = p.holdUpS ?? 0;
      if (h >= STAGE_3_MIN_DELAY_S) return { path: p.path, stage: 3, reason: `governance, ${fmt(h)} hold-up` };
      if (h >= STAGE_2_MIN_DELAY_S) return { path: p.path, stage: 2, reason: `governance, ${fmt(h)} hold-up` };
      return { path: p.path, stage: 1, reason: h > 0 ? `governance, ${fmt(h)} hold-up (under 24 h)` : 'governance, no hold-up' };
    }
  }
}

export function computeStage(f: ProgramFacts): StageResult {
  const upgrade = pathStage(f.upgrade);
  // An admin key we could not tie to a controller does not prove one key can act; it caps at Stage 1.
  const admin = f.admin.map((a) => (a.kind === 'unresolved' ? { path: a.path, stage: 1 as Stage, reason: 'admin controller not resolved; capped at Stage 1' } : pathStage(a)));
  const verdicts = [upgrade, ...admin];
  const fromPaths = Math.min(...verdicts.map((v) => v.stage)) as Stage;
  let stage = fromPaths;
  let bindingPath = verdicts.find((v) => v.stage === fromPaths)!.path;
  const modifiers: Modifier[] = [];
  let cap: StageResult['cap'] = null;

  if (f.upgrade.kind === 'unresolved') modifiers.push('upgrade_unresolved');
  if (f.admin.some((a) => a.kind === 'unresolved')) modifiers.push('admin_unresolved');
  if (f.adminStatus === 'unknown') {
    modifiers.push('admin_unknown');
    // Admin config can move funds even when the code is immutable; unread config caps every program.
    if (stage > 1) {
      cap = { stage: 1, reason: 'admin fields not read: cannot reach Stage 2 until they are' };
      stage = 1;
      bindingPath = 'cap:admin_unknown';
    }
  }
  if (f.closed) modifiers.push('closed');

  return { programId: f.programId, rulesVersion: RULES_VERSION, stage, bindingPath, paths: verdicts, modifiers, cap };
}

/** The rules as published on /stages and served by /api/v1/stages. Same version as the engine above. */
export const STAGE_RULES: { stage: Stage; name: string; rule: string; moveUp: string | null }[] = [
  { stage: 0, name: 'One key', rule: 'Any control path is a single key, a 1-of-n multisig, or a controller we could not resolve.', moveUp: 'Move every path behind a multisig with at least 2 required signers.' },
  { stage: 1, name: 'No delay', rule: 'Every path needs at least 2 signers, but at least one path can act with no timelock of 24 h, or admin fields are not read.', moveUp: 'Add a timelock of at least 24 h on every path, and publish an IDL so admin fields can be read.' },
  { stage: 2, name: 'Delayed', rule: 'Every path needs at least 2 signers and waits at least 24 h, or is governance with a hold-up of at least 24 h.', moveUp: 'Lengthen every delay to 7 days or more, or make the program immutable.' },
  { stage: 3, name: 'Exit window', rule: 'The program is immutable, or every path waits 7 days or more: users can leave before any change lands.', moveUp: null },
];
