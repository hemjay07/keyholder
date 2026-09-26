# BRIEF: the control plane of Solana (working title) — shared input for every planner

Date: 2026-09-26. Hackathon: Colosseum Crypto World's Fair, Solana track. Deadline 2026-10-12 23:59 PT (2026-10-13T06:59:59Z). Brief with rules, judging, submission requirements: ~/.claude/skills/hackathon-briefs/colosseum-worldsfair-2026.md. This is a PLANNING run: nothing is built until the founder approves the plan.

## The founder's bar (his words, 2026-09-26)
"we should build the main thing fully... a legendary product with perfect execution and UI." Ambition is maximum; deadlines never cut scope, only the founder does. No "no Rust" limit: an on-chain program is in scope. Do not lean on the founder's previous projects (LEDGE, THE MARK) for the product case; it must stand on its own evidence.

## The product in one sentence
A public, live record of who controls every Solana protocol that holds user money, an alarm the moment control changes, and an on-chain program other protocols call to refuse to move money into anything whose control just got weaker.

## Why (evidence, all verified 2026-09-25/26; sources in /Users/mujeeb/worldsfair/research/11-sketch-upgrade-watch.md)
- Where Solana money is actually lost is the control plane, not code upgrades. Drift, 2026-04-01, $285.26M (rekt.news/drift-protocol-rekt): attacker took Drift's admin via "a 2-of-5 multisig with zero timelock"; four durable nonces created 2026-03-23; a Security Council migration lowered the threshold 3-of-5 → 2-of-5; a malicious collateral market was created, withdrawal caps raised, 18 vaults drained in 128 seconds. Every step before the drain was on-chain. Raydium 2022 ($4.4M): stolen admin key. No rekt Solana entry names a malicious program upgrade as the vector.
- Nobody publishes the control state. Verified-build status of 15 major programs (verify.osec.io/status, 2026-09-26): verified now: Kamino Lend, marginfi v2, Phoenix; registered but no longer matching ("the API detects your upgrade and unverifies your program"): Raydium AMM v4, Raydium CLMM, Orca Whirlpool, Drift v2, Marinade, Squads v4; never registered: Jupiter v6, Meteora DLMM, Jito stake pool, Pump.fun, Openbook v2, Sanctum router. 540 verified programs of ~20,606 upgradeable.
- Closest tools and why they are not this: Solana Foundation "Microscope" (2026-09-15, self-hosted, one program + one Squads multisig per deployment, governance alerts, no verification/diff/shared feed); Sec3 free nonce & multisig monitor (for your own team); FannBe/solana-upgrade-guard and UpgradeGuard (pre-deploy CLIs for the author); Blowfish defunct; Phantom warns on simulation only; RugCheck tokens only; no explorer lists upgrade/control history.
- Demand: no one has asked for this by name (D0 for the product). Grok (2026-09-26) found 18 posts in ten days on upgrade-authority/timelock risk after Drift (e.g. @mubaraqabba "That single key can replace the program bytecode with anything"; @rami_poker on Raydium's 3/4 multisig with no timelock; @Selas2311 asking a project for a timelock timeline) and stated: "there is still no widely cited 'subscribe to these program IDs and email me a verified-build diff when last_deploy_slot moves' product". The founder has no access to protocol teams; traction must be produced by the product itself (public record, counts, an X account posting control changes that tags the protocol).

## The full product (founder approved "build the main thing fully")
1. Control map per protocol: every program; upgrade authority; key type (single key / Squads M-of-N / immutable); signers; timelock; admin/state accounts and who controls them; verified-build status; one plain sentence "who can move your money".
2. Live control-plane feed: upgrades; authority transfers; multisig threshold/member/timelock changes; proposals created (pre-signal); durable-nonce creation by signers (Drift's pre-signal); privileged admin instructions (new markets, oracle swaps, cap raises, pause/unpause, fee changes) decoded.
3. Generic decoding: Anchor programs publish IDLs on-chain; decode admin instructions for any Anchor program automatically, not a hand-picked list; classify "privileged" by account constraints (signer = admin/authority).
4. Risk deltas with reasons (e.g. threshold 3→2 and timelock 0 = high); verification drift (verified → unverified).
5. Position-aware alerts: connect a wallet, detect which protocols hold its funds, alert only for those (Telegram, webhook, email, X).
6. Incident replay: the Drift timeline replayed through the feed showing the alerts it would have fired from 2026-03-23.
7. Public, permanent, citable record of every control change.
8. On-chain control-policy program (Rust/Anchor): publishes each protocol's control state on-chain (attested by the indexer, later by a quorum) and exposes a CPI check any vault/curator/integrator calls, e.g. "refuse if this market's admin threshold dropped in the last N days or timelock < T". Turns the product into a building block.
9. Paid tier/APIs: firehose, per-program webhooks, x402 per call for agents.

## Constraints known
Solana mainnet. Detection sources: Helius (free: 5 webhooks, Parsed Streams 1 credit/event; LaserStream gRPC needs Business $499), Yellowstone gRPC, or RPC polling (loader firehose ~16,000 tx/h, >98 % `write`). Loader v3 discriminants: Upgrade=3, SetAuthority=4, etc.; Loader v4 abandoned. Verified builds: OtterSec program verifycLy8mB96wd9wqq3WDXQwM4oU6r42Th37Db9fC, verify.osec.io/status/<id>. Squads v4 SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf. Solana Attestation Service via sas-lib 1.0.10. Solo founder in Nigeria; Next.js/TypeScript fluent; first Rust/Anchor program. UI must go through the SURFACE kit (~/.claude/skills/surface/SKILL.md; charter depth 3).

## Judges and bar
Solana track panel includes people from Anza, Phantom, Ellipsis, Drift, Arcium. Colosseum's stated top-25 criteria: "execution speed, insight, founder-market fit, prioritization, and overall talent". Winners arrived with counts, 1–4 minute founder-to-camera videos, and a one-sentence reframe (research/08a-winners-read-1..4.md, research/13-ranking-round2.md "What the winners' reads changed").
