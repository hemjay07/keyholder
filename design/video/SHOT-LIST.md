# Keyholder: shot list for the two judged videos (2026-09-27)
One take per row. Open every tab in order before recording. `BASE` = https://keyholder-ashy.vercel.app (live 2026-09-27).

## Technical demo (2:00–3:00)
| # | time | open | show | say (substance) |
|---|---|---|---|---|
| 1 | 0:00–0:15 | architecture visual (to be built) | chain → worker (decode, state, risk, alerts) → Postgres → web/API; Anchor program on devnet | one sentence per box |
| 2 | 0:15–0:35 | BASE/protocols/marinade | headline "6 of 13 keys, no timelock feature", "checked N min ago · recorded at slot …", the history lanes | read from chain: upgrade authority → multisig; checked every 10 min |
| 3 | 0:35–0:50 | apps/worker/src/pipeline/state.ts (editor) | the comment "A state is only written from a successful live read" | a failed read writes nothing: a 429 once caused a false change |
| 4 | 0:50–1:05 | packages/risk/src/rules.ts (editor) | the RULES list | alerts are rules on control facts, not price |
| 5 | 1:05–1:25 | BASE/alerts | the real first Drift alert body + X-Keyholder-Signature | signed webhook; on Drift this came 5.6 days before the money |
| 6 | 1:25–1:40 | BASE/policy | the proof strip: before 3 of 5 passed, after 2 of 5 refused 6001 | a vault calls Keyholder before it takes a deposit |
| 7 | 1:40–1:50 | explorer.solana.com/tx/3ec5LSrxs74epRWmb1xyT6ptXbY3CCbnmzwEtcFEXxhqr6TKuhxyvH8n7zYgDtSGNtkix9ZkX4fzFzt2mmUJ1FhQ?cluster=devnet | success, slot 504,518,184 | deposit checked and accepted |
| 8 | 1:50–2:00 | explorer.solana.com/tx/5EXeHqjmeMEm6HBhH3VEFFruoHZbG6ymdVTkdVyZLhgYRBWyth4cUX9pwqXKHcGF7uAfKcWJCFbAvy9wbBnhJ1FE?cluster=devnet | ConfigTransactionExecute, slot 504,518,274 | the multisig cut to 2 of 5, no timelock |
| 9 | 2:00–2:15 | explorer.solana.com/tx/2pc4PrKssRYXXBtcxDzAeeoS9BNH7wZfy4fcJiBoHfPgSnc9632sX84jbwhfTCBMZvdp1PuxUdZ3DA9LB2DJioBF?cluster=devnet | error `Custom: 6001`, slot 504,518,286 | same deposit, refused by the chain, 23 s later |
| 10 | 2:15–2:25 | BASE/policy (scroll to "What the vault adds") | the `cpi_check` Rust call | one call; the vault sets its own policy |
| 11 | 2:25–2:45 | BASE/policy (scroll to "Who controls Keyholder") | Squads v4, 2 of 3, 48 h, no config authority | same rule for ourselves; devnet, mainnet not yet |
| 12 | 2:45–3:00 | on camera or text | next: mainnet, Realms | — |

## Pitch (≤ 3:00)
| # | time | open | show |
|---|---|---|---|
| 1 | 0:00–0:15 | keyholder-launch.mp4, first 10 s, then camera | hook |
| 2 | 0:15–0:40 | camera; github.com/hemjay07/clinicalguard | who you are |
| 3 | 0:40–1:10 | BASE/ | the live table, "10 of 13 … no timelock" |
| 4 | 1:10–1:50 | BASE/protocols/marinade → BASE/alerts → BASE/policy | record, alert, refuse (one shot each) |
| 5 | 1:50–2:20 | BASE/replay/drift | scroll to "5.6 days of warning" |
| 6 | 2:20–2:45 | camera | validation and business (your words) |
| 7 | 2:45–3:00 | BASE/ | "Count the keys." |

Verified 2026-09-27: the three devnet transactions exist (getTransaction on api.devnet.solana.com); the third returns InstructionError Custom 6001.
