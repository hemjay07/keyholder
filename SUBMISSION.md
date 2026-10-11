# Colosseum submission: Keyholder

**Name:** Keyholder

**One line:** The control record for Solana: who can change every program, how fast, and whether that just changed, with an on-chain check that refuses money where control is weak.

**Links**
- Live: https://keyholder-ashy.vercel.app
- Repo: https://github.com/hemjay07/keyholder
- Demo film (2:42, narrated): <add the upload link>
- Pitch video: <add after recording>

## Description

Every Solana program can be changed by someone. Depositors rarely know who, or how much warning they would get. Today $769M sits behind programs that can be upgraded with no waiting period.

Keyholder reads 577 live programs down to their signer keys and puts each on one of four public Control Stages: one key; several keys but no delay; keys plus a 24 h+ delay; or cannot change. The weakest control path sets the stage. Kamino Lend waits 24 hours to upgrade, but its admin key is a 4-of-10 multisig that can act at once, so it is Stage 1.

- **Signer keys.** Keys are reused: one key sits on six multisigs behind $1.5B and can act alone on two of them.
- **Open votes.** 53 open multisig votes would change who controls a program or move its funds. One was approved 713 days ago and can still be sent.
- **Ask Keyholder.** Ask in plain words; the answer comes from the record, with the path that sets the stage.
- **Drift, replayed.** Drift lost $285M in April 2026 through its keys, not its code. Replayed from chain, Keyholder's rules flag the first control change 5.6 days before the money moved.
- **require_stage.** One CPI call lets any program refuse a deposit when the target's control is below its policy. On devnet it refused a real deposit 23 seconds after the target's multisig was weakened.
- **Our own rule.** Keyholder's program changes only through a 2-of-3 Squads multisig with a 48 h timelock. Its first upgrade was approved 2026-10-08, waited 48 h in public, and executed 2026-10-11 (devnet tx 4MRJQhAV…Cbri).
- **Proof of Control.** Teams sign claims about their controls; Keyholder checks them against the chain.

## How it is built
Next.js site; TypeScript worker (ingest, byte-level decoders verified on real mainnet accounts, state, rule engine, daily log) on one box with Postgres; Anchor program for require_stage on devnet; a daily hash of the record posted on chain. Every figure on the site comes from a dated record with transaction signatures.

## Limits we state
KeyBench has 5 incidents and the rules shipped before it warned on 1. Compiled-in admin keys are not modelled. Dollar figures are floors. require_stage and the anchors run on devnet. The full list, each with a real case: https://keyholder-ashy.vercel.app/limits
