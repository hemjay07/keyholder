# WINNER-BRIEF: Keyholder (Colosseum Crypto World's Fair, Solana track)

Source: founder selection 2026-09-26 after research rounds 1–2 (/Users/mujeeb/worldsfair/research/13-ranking-round2.md, 11-sketch-upgrade-watch.md) and the approved plan (plan/PLAN.md). No warroom deliberation was run; this brief is written from the approved plan.

## Chosen Idea
Keyholder: a public, live record of who controls every Solana protocol that holds user money (keys, threshold, timelock, verified code, admin actions), an alarm the moment control weakens, and an on-chain program other programs call to refuse moving money into anything whose control just got weaker.

## Problem Statement
Drift lost $285.26M on 2026-04-01 through its control plane, not its code: a 2-of-5 multisig with zero timelock; four durable nonces created 23 March; a council migration lowered the threshold from 3-of-5 to 2-of-5; a malicious market; 18 vaults drained in 128 seconds. Every step before the drain was on-chain and nobody published it. Of 15 major programs, 3 are verified today, 6 drifted from their registered source, 6 were never registered (verify.osec.io, 2026-09-26).

## Non-Negotiables
Real mainnet events only; no mock data, mock payments or injected events in any demo path. All nine plan features in scope. The on-chain program is controlled by a Squads multisig with a public 48 h timelock. Never state a guess as a figure; reconstructed state is labelled "reconstructed".

## Explicit Out-of-Scope
Rating or scoring protocols' code quality; custody; trading; token.

## Top Risks
Archived March 2026 history unavailable for the Drift replay (day-2 kill check; fallback: replay from rekt timeline + surviving transactions, labelled); first Anchor program for the founder; Squads Borsh Option layout trap after offset 94; alert noise; X API limits.

## Minority Dissent
Demand for the product by name is D0; company case weak (founder accepted 2026-09-26: "go ahead").

## Thesis
1 WINNING ARGUMENT: Solana money is lost through the control plane (keys, thresholds, timelocks, admin actions), every step is on-chain, and nobody shows it; Keyholder counts the keys for every protocol, rings when they drop, and lets any program refuse.
2 EVIDENCE: Drift 2026-04-01 $285.26M sequence (rekt.news/drift-protocol-rekt); verification status of 15 major programs (verify.osec.io, 2026-09-26); Solscan shows "MULTISIG" and "verified FALSE" with no threshold, timelock or history (plan/research/refs/18).
3 DEMO OBLIGATION: the judge witnesses (a) a real mainnet control state and a real live change arriving in the feed, (b) the Drift sequence replayed from real transactions with the alert timestamped days before the drain, and (c) a program calling `check` on-chain and being refused after a real threshold change (devnet flip on camera; mainnet program deployed).
4 HERO FLOW: open Keyholder → a protocol console shows keys, threshold, timelock, verified → a control change arrives → the alert fires → the policy program refuses a deposit into that protocol.
5 INVARIANTS: real events only; no fabricated state; every figure carries its source slot or transaction; reconstructed history labelled; our own program under a timelocked multisig.
6 DRIFT TRIPWIRES: becoming a generic security dashboard or token scanner; leading with a risk score instead of the control facts; "upgrade monitor" framing; charts for their own sake; dark-crypto-template look.
