# KeyBench: confirmed incidents (from chain)

An incident enters this file only when its transactions have been read on chain (records in `data/keybench/*.json`, built by
`scripts/keybench/*.py`). Leads: `LEADS.md` (agent-found, unverified). Scored by `apps/worker/src/keybench/score.ts`; shown at `/keybench`.

## Results (2026-10-03)
"Shipped" = rules that existed before KeyBench. "Current" adds rules written after studying these incidents
(control_proposal_pending); those scores are in-sample and labelled so.

| incident | path | first loss (UTC) | shipped | current |
|---|---|---|---|---|
| Raydium AMM v4 (Dec 2022) | admin_key | 2022-12-16 10:11:58 · `5gjJdnFHzZzv8ar2…` | no warning | no warning |
| Synthetify (Oct 2023) | governance_upgrade | 2023-10-17 09:19:31 · `2PqUTsByr5xgHq96…` | no warning | 8.03 d (control_proposal_pending) |
| Drift Protocol (Apr 2026) | multisig_admin | 2026-03-31 07:16:19 · `2Ca74VizKGBkmvfJ…` | 5.60 d (new_multisig_created_by_controller) | 5.60 d (new_multisig_created_by_controller) |
| BonkDAO BIP #76 (Jul 2026) | governance_treasury | 2026-07-06 08:26:28 · `5tPU1srcRcnmibB7…` | no warning | 6.00 d (control_proposal_pending) |

## What the chain showed (corrections to the press)
- **Synthetify (2023)**: the drain was a *program upgrade* passed through governance (ExecuteTransaction → `Upgraded program 5TeGDBaMN…`
  at 2023-10-17 09:19:06), followed 25 s later by transfers out of the program vault to `BvvMMoT8…`: 162,938 USDC, 4,909 mSOL, 323 SOL, plus two smaller mints.
  Press reports said "treasury"; on chain it was the program's own vault after an upgrade.
- **Raydium (2022)**: the earlier entry here said the first sign was 2022-12-16 12:37:51. That was the oldest result on one page of 1,000.
  The admin key was in routine use from September; the attack starts 2022-12-16 10:11:58 (slot 167,192,704), the first admin tx paying
  `AgJddDJL…`, an owner never seen in routine use. The upgrade authority had been a Squads v3 multisig since 2022-11-14.
- **BonkDAO (2026)**: BIP #76 "Sowellian BonkDAO" created 2026-06-30 08:25:24, executed 2026-07-06 08:26:28, moving 4,426,104,450,306 BONK
  from the treasury owner `AGkGWK1R…` to `9bxWkNf3…`.

## Gaps this exposes (product work)
1. **Admin keys inside program config** (Raydium's compiled admin, Pump.fun's withdraw authority): Keyholder models upgrade authorities and
   multisigs, not per-program admin fields. Two incidents in this set came through such keys with no prior on-chain change.
2. **Governance proposals**: until `control_proposal_pending`, a pending upgrade/treasury proposal raised nothing. The rule needs ingest of
   spl-governance CreateProposal/InsertInstruction to run live.

## Leads not yet replayed
Pump.fun (May 2024; post-mortem names the withdraw authority; 2024 key address not yet found on chain), Rain/Avici (Aug 2026; attacker
FVNFzqAn… per Blockaid, chain walk running), Dominion (Sep 2026), Cypher (2023), Saga DAO (2024, multisig never online: treasury key),
OptiFi (2022, no program id in coverage). Dropped as not a control path: Aquifer (2026, forged account), Wormhole (2022, signature verification bug).
