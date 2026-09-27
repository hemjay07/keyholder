// Maps the API's control facts to the console device's props. Never invents a number:
// unresolved protocols (null threshold/members) return null and the caller must show the
// "unresolved" copy instead of a console (design/CHARTER.md, CONTEXT.md bans).
import type { ConsoleData } from "@/components/console/Console";
import type { ControlFacts } from "@/lib/control";

export function timelockSecondsFor(facts: ControlFacts): { seconds: number; noTimelockFeature: boolean } {
  if (!facts.timelock) return { seconds: 0, noTimelockFeature: false };
  if (facts.timelock.kind === "no_timelock_feature") return { seconds: 0, noTimelockFeature: true };
  if (facts.timelock.kind === "none") return { seconds: 0, noTimelockFeature: false };
  return { seconds: facts.timelock.seconds, noTimelockFeature: false };
}

export function consoleDataFromFacts(opts: {
  name: string;
  rowLabel: string;
  facts: ControlFacts;
  weakened: boolean;
  readDate: string;
}): ConsoleData | null {
  const { name, rowLabel, facts, weakened } = opts;
  if (facts.threshold == null || facts.members == null) return null;
  const { seconds, noTimelockFeature } = timelockSecondsFor(facts);
  const slot = facts.asOfSlot;
  return {
    protocol: name.toUpperCase(),
    threshold: facts.threshold,
    members: facts.members,
    timelockSeconds: seconds,
    noTimelockFeature,
    verified: facts.verifiedStatus === "verified",
    codeDrifted: facts.verifiedStatus === "drifted",
    weakened,
    slot,
    label: `${rowLabel}${slot != null ? ` · recorded at slot ${slot.toLocaleString("en-US")}` : ""}`,
  };
}

export function timelockLabel(facts: ControlFacts | null): string {
  if (!facts || !facts.timelock) return "—";
  if (facts.timelock.kind === "no_timelock_feature") return "no timelock feature";
  if (facts.timelock.kind === "none") return "none";
  const s = facts.timelock.seconds;
  if (s % 86400 === 0) return `${s / 86400} d`;
  if (s % 3600 === 0) return `${s / 3600} h`;
  return `${s.toLocaleString("en-US")} s`;
}

/**
 * What controls a program, in the table's words. Immutable and DAO-governed
 * programs have no multisig threshold but are not "unresolved": the chain
 * says exactly who can change them (nobody, or a governance vote).
 */
export function controlLabel(facts: ControlFacts | null): string {
  if (!facts) return "unresolved";
  if (facts.authorityKind === "immutable") return "immutable";
  if (facts.authorityKind === "spl_gov") return "Realms governance";
  if (facts.threshold != null && facts.members != null) return `${facts.threshold} / ${facts.members}`;
  return "unresolved";
}
