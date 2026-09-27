// The on-chain proof for /proof. Every value here was read from Solana devnet
// on 2026-09-27 (getTransaction / getSignaturesForAddress / getAccountInfo on
// api.devnet.solana.com); the check results are decoded from the program's
// own return data (CheckResult: ok, reasons, derived_score, threshold,
// time_lock, last_weakened_slot).

export const CLUSTER = "devnet";

export const PROGRAMS = {
  keyholder: { id: "3FX57MQmZH8dkpFV5nbA1XWyV6WDeinu7ennZhvx8R8F", role: "Keyholder: control records and the check any program can call" },
  vault: { id: "4dj7Nu6j5sb9dzL1NRk4RRFJFXxSdt6bQzfboqZsXMNY", role: "Example vault: calls check before it takes a deposit" },
  target: { id: "9JT9XMCuuVZZpmR7LY9Hf1fg5j4DY5xvBpnbPmKNuLBJ", role: "The protocol being watched: upgradeable, controlled by a Squads multisig" },
  multisig: { id: "EHRo8jAcxmm9XSNtrhqztkFsv3GP71WkNyhuMS6YaHwN", role: "Its Squads v4 multisig" },
} as const;

export interface ProofStep {
  time: string;
  slot: number;
  signature: string;
  title: string;
  detail: string;
  outcome: "pass" | "change" | "refused";
  facts?: { threshold: number; members: number; timelockS: number; score: number; reasons?: string[] };
}

export const STEPS: ProofStep[] = [
  {
    time: "2026-09-26T19:34:30Z",
    slot: 504518184,
    signature: "3ec5LSrxs74epRWmb1xyT6ptXbY3CCbnmzwEtcFEXxhqr6TKuhxyvH8n7zYgDtSGNtkix9ZkX4fzFzt2mmUJ1FhQ",
    title: "A deposit, checked and accepted",
    detail: "The vault calls Keyholder's check before taking the deposit. The protocol's multisig passes the vault's policy.",
    outcome: "pass",
    facts: { threshold: 3, members: 5, timelockS: 10, score: 70 },
  },
  {
    time: "2026-09-26T19:34:51Z",
    slot: 504518274,
    signature: "5EXeHqjmeMEm6HBhH3VEFFruoHZbG6ymdVTkdVyZLhgYRBWyth4cUX9pwqXKHcGF7uAfKcWJCFbAvy9wbBnhJ1FE",
    title: "The protocol's multisig is weakened",
    detail: "A Squads ConfigTransactionExecute lowers the multisig to 2 of 5 keys and removes the timelock. Keyholder records the change at slot 504,518,280.",
    outcome: "change",
    facts: { threshold: 2, members: 5, timelockS: 0, score: 40 },
  },
  {
    time: "2026-09-26T19:34:53Z",
    slot: 504518286,
    signature: "2pc4PrKssRYXXBtcxDzAeeoS9BNH7wZfy4fcJiBoHfPgSnc9632sX84jbwhfTCBMZvdp1PuxUdZ3DA9LB2DJioBF",
    title: "The same deposit, refused",
    detail: "Same vault, same ten accounts, 23 seconds later. The check fails with ThresholdBelowPolicy (6001), so the vault's transaction reverts and no money moves.",
    outcome: "refused",
    facts: { threshold: 2, members: 5, timelockS: 0, score: 40, reasons: ["threshold below policy", "timelock below policy"] },
  },
];

export function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
}

export function explorerAddr(addr: string): string {
  return `https://explorer.solana.com/address/${addr}?cluster=${CLUSTER}`;
}

/** Keyholder's own control on devnet (data/own-multisig.json, read back from chain 2026-09-27). */
export const OWN_CONTROL = {
  multisig: "K3u623LwUfpiQNuTXgmWW6Q9mgqh94pFm7nEn7W99Xb",
  vault: "C57XKxbywVVTSvJhskMRKWW8X978yeWhq4ZSJkEsVCGn",
  threshold: 2,
  members: 3,
  timeLockHours: 48,
  createSignature: "4PourKBRwcCefUVuxArW82eGJBGFLwPoU62DFX59fFh354MW6BUk9754aHxKFcxLJB2Gvt9V1gwhk6Fk7eDqFxnr",
  setAuthoritySignature: "2UH5Qxs5kEDWArs1qH3tzemsrw45YvTyqkjDGA2YStxUkdRRNyxisUipYwfiBF7528W3tp7umg4osYiUUvd2Syuo",
} as const;
