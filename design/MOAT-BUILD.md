# Moat build plan (2026-10-03 → 2026-10-12)

The bar: value nobody can deny. Three assets, one rule: **every fact comes from a chain read or the owner's own
publication, with the signature or URL next to it.** Agents and search find leads only.

## A. KeyBench: would Keyholder have warned, and how early
Goal: every Solana loss whose path was a control key (upgrade authority, admin key, multisig, governance,
privileged insider key), replayed from chain and scored against Keyholder's rules.

| step | output | done when |
|---|---|---|
| A1 leads | `design/keybench/LEADS.md`: every candidate incident with 2+ public source URLs (rekt, post-mortems, security firms) | each lead has URLs or is marked dropped |
| A2 verify | per incident: program id, control account, attacker key, first control-relevant tx, first loss tx, last loss tx, each read from chain (sig, slot, blockTime) | `data/keybench/<id>.json` with every field from RPC; `scripts`/`src/keybench/verify.ts` re-reads them and exits 0 |
| A3 classify | control path class per incident: `upgrade` / `admin_key` / `multisig` / `governance` / `insider_key` / `offchain_key` (Keyholder cannot see) | class in the json, reason cited |
| A4 score | for each incident, run Keyholder's existing rules (state-builder + risk engine) over the control events: did a rule fire? which? lead time = first alert → first loss; also "static exposure": was the control state already flagged (single key / 0 timelock) before the attack | `src/keybench/score.ts`, unit tests on fixtures; `data/keybench/results.json` |
| A5 publish | `design/keybench/KEYBENCH.md` results table + `/keybench` page; unflattering rows kept (no warning possible) | page renders from results.json |

## B. Dollar coverage: how much money one key can move
Goal: `$X` of Solana value sits behind programs upgradeable by one key / by a multisig with no timelock.

| step | output | done when |
|---|---|---|
| B1 vault map | for each money-layer program: the token accounts it controls (PDA-owned vaults), found by layout decoders (klend reserves done) or by owner = program PDA via getTokenLargestAccounts/Llama adapter addresses | `data/coverage/vaults-<day>.json`, each vault's owner chain re-derivable |
| B2 price | token amounts × price (Jupiter price API / CoinGecko by mint), priced at a stated time | every $ has mint, amount, price, source |
| B3 join | $ per control class: single key, multisig no timelock, multisig with timelock, governance, immutable | `data/coverage/dollars-<day>.json` + headline |
| B4 fallback | where vaults can't be mapped: protocol TVL from DefiLlama, labelled "protocol-level, not program-traced" and never added into the traced total | separate column |

## C. Provable observation log
| step | output | done when |
|---|---|---|
| C1 digest | daily job writes sha256 over the day's sorted program_daily rows (canonical JSON) | unit test: same rows → same hash; any change → different |
| C2 anchor | memo tx with `keyholder:program_daily:<day>:<hash>` sent by the attester key (devnet now, mainnet when SOL) | sig stored in `daily_anchor` table; verify script recomputes and matches the memo |
| C3 deploy | box picks it up on next pull + timer | founder runs the deploy (prod) |

## Order
A1→A2 (longest; start now) ‖ C1–C2 (small) ‖ B1→B3. A4 after A2 has ≥3 incidents. Pages last.

## Costs and limits
- Public mainnet RPC serves historical getTransaction (checked on Raydium 2022 via archive earlier); Helius free quota spent.
- Prod box: reads/deploys need the founder's go (the classifier blocks prod reads from this session).
- No claim leaves this repo without its signature/URL.
