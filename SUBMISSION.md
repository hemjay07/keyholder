# Colosseum submission: Keyholder (Solana track)

**Name:** Keyholder

**One line:** Know who can move the money: Keyholder reads who controls every Solana program, warns when that control weakens, and lets a vault refuse deposits where it just did.

**Links**
- Live: https://keyholder-ashy.vercel.app
- KeyBench: https://keyholder-ashy.vercel.app/keybench
- Repo: https://github.com/hemjay07/keyholder
- Demo video: <add after recording>

## Description

$769M on Solana can be moved today by multisigs that need no waiting period. We traced $2.66B to the vaults of the largest programs, vault by vault, and matched each one to whoever can upgrade the program that holds it: $1.89B sits behind multisigs with a timelock, $769M behind multisigs with none, and Raydium's main AMM alone holds $573M behind three of four keys.

Drift lost $285M in April 2026 without a code bug. The attacker took over the keys. Keyholder watches control instead of code:

- **Control graph.** 557 OtterSec-verified programs resolved from upgrade authority to multisig to each signer key, plus the admin keys stored inside program config.
- **Alerts.** A worker decodes every control-relevant transaction (upgrades, authority changes, Squads v3/v4 and coral multisig changes, durable nonces, governance proposals) and runs it through a versioned rule engine.
- **The check.** An Anchor program a vault calls before moving money; it refuses when the target's control is below the vault's policy or changed recently (live on devnet).
- **A log no one can rewrite.** Every day the control state of every covered program is hashed and the hash posted on chain; anyone can recompute it.

**KeyBench** replays real Solana losses that came through a control key from the transactions themselves and scores Keyholder against them. On Drift, the rules we shipped warn 5.6 days before the first drain. On Synthetify and BonkDAO, a proposal rule warns 8 and 6 days ahead; it was written after studying them and is labelled that way. Raydium 2022 and Rain 2026 are misses, and they stay on the page.

Replaying from chain also corrected the record: Synthetify's 2023 drain was a program upgrade passed through governance, followed 25 seconds later by transfers out of the program's vault, not a treasury withdrawal.

## How it is built
Next.js site; TypeScript worker (ingest, byte-level decoders verified on real mainnet accounts, state, risk, alerts, daily log) on a single box with Postgres; Anchor 1.2 program on devnet; chain-read Python scripts for KeyBench and dollar coverage. Every figure on the site comes from a dated data file in the repo, with transaction signatures.

## Limits we state
KeyBench has 5 incidents, and the rules shipped before it warned on 1. Compiled-in admin keys are not modelled yet. Dollar figures are floors (liquid tokens, the 33 largest programs). The log starts 2026-10-02; anchors are on devnet.
