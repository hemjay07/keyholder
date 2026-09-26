// The Drift incident, step by step, for /replay/drift. Times, slots and
// signatures come from data/drift-2026/timeline.json (block times re-read
// from chain 2026-09-27) and the captured nonce transaction; the one-line
// descriptions are ours, written from each step's decoded instruction.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface DriftStep {
  slot: number;
  time: string; // ISO, from chain
  signature: string;
  says: string;
  phase: "before" | "warning" | "drain" | "after";
}

// One line per step, keyed by slot. Never a figure the chain did not show.
const SAYS: Record<number, { says: string; phase: DriftStep["phase"] }> = {
  403762585: { says: "Routine: the admin council (2 of 5 keys, no timelock) changes a market setting.", phase: "before" },
  408806252: { says: "A second Squads multisig is created: 2 of 5 keys, no timelock, set up by the council's signers.", phase: "warning" },
  408886958: { says: "The admin key moves: the council hands Drift's admin role to a new address.", phase: "warning" },
  408888841: { says: "An admin action through the old council fails: its signers are now locked out.", phase: "warning" },
  408900854: { says: "The new admin switches on perp market 85.", phase: "warning" },
  409018978: { says: "Market 85's risk tier is lowered from B to C.", phase: "warning" },
  409019380: { says: "Market 85's maximum open interest is raised.", phase: "warning" },
  409999217: { says: "A durable nonce is created by a controller: a transaction that can be signed now and sent later.", phase: "warning" },
  410042220: { says: "First drain: the new admin withdraws from the insurance fund vault.", phase: "drain" },
  410042354: { says: "Clean-up: five vault transaction accounts on the new multisig are closed.", phase: "drain" },
  410114133: { says: "The executor wallet sets up token accounts.", phase: "drain" },
  410343846: { says: "A second, larger withdrawal from the insurance fund vault.", phase: "drain" },
  410344009: { says: "Recovery: the admin role is rotated away from the attacker's address.", phase: "after" },
  410344135: { says: "Six withdrawals and transfers in ten seconds.", phase: "drain" },
  410355647: { says: "The funds are swapped through Jupiter.", phase: "after" },
  410380361: { says: "Four config changes on the multisigs are attempted; all fail.", phase: "after" },
};

interface TimelineRow { slot: number; signature: string; blockTimeIso: string }
interface NonceTx { slot: number; blockTime: number; transaction: { signatures: string[] } }

export function loadDriftSteps(): DriftStep[] {
  const root = join(process.cwd(), "..", "..", "data");
  const timeline = JSON.parse(readFileSync(join(root, "drift-2026", "timeline.json"), "utf8")) as TimelineRow[];
  const nonce = JSON.parse(readFileSync(join(root, "fixtures-for-decoder", "initialize-nonce-account.json"), "utf8")) as NonceTx;
  const nonceSig = nonce.transaction.signatures[0];
  const rows: TimelineRow[] = nonceSig
    ? [...timeline, { slot: nonce.slot, signature: nonceSig, blockTimeIso: new Date(nonce.blockTime * 1000).toISOString() }]
    : timeline;
  const steps: DriftStep[] = [];
  for (const r of rows) {
    const line = SAYS[r.slot];
    if (line) steps.push({ slot: r.slot, time: r.blockTimeIso, signature: r.signature, says: line.says, phase: line.phase });
  }
  return steps.sort((a, b) => a.slot - b.slot);
}
