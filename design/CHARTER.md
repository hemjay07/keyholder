---
thesis: "Keyholder is the control standard for Solana: for any money on Solana it shows who can move it, how fast, whether that changed, and whether it matches what the team promised; any program can refuse money where control is weak."
skim_seconds: 5
stack: next-dev
signal_colours:
  - hex: "#FF5A1F"
    means: "control is weak or just got weaker (Stage 0, a cut timelock, a pending control action, a broken claim); nothing else is orange"
  - hex: "#1F6B4A"
    means: "holds: a delay of 24 h or more on every path, a kept claim, verified code"
depth_level: 3
depth_reason: "founder: 'we are building a 1m dollars quality product' and 'claude is now powered with great motion design and design skills, that must effect our UI' (2026-10-08)"
motion:
  cap_ms: 1600
  easings: 1
  durations: { tick: 90, element: 240, data: 320, count: 1400 }
device:
  renders: "the Stage map: every covered program (583) as one instanced mark on a four-rung ladder (Stage 0 one key, 1 no delay, 2 delayed, 3 exit window), sized by dollars traced; marks fall onto their rung as the day's record loads, a pending control action pulses its mark orange, and a stage change moves a mark one rung with the transaction that caused it"
  source: state
  swap_test: "swap in any other product and the map has nothing to place: each mark's rung comes from that program's upgrade authority, multisig threshold and timelock and its admin fields, read on chain on a dated, anchored day; for a DEX, a wallet or a dashboard the rungs and sizes would be invented"
genre: "instrument console (warm-paper operator instrument; cordon / linear-changelog restraint shelf)"
wonder: "583 Solana programs fall onto a four-rung ladder of who can move their money; $769M settles on the rung that needs no waiting, and one orange mark pulses: a multisig with a pending vote to change who controls it."
hero_technique: "instanced-grid"
faces:
  display: "Geist"
  text: "Geist"
  mono: "Geist Mono"
references:
  - name: "cordon"
    take: "warm-paper console ground, groundL 0.943, 1 easing, 400 ms longest (refs/INDEX.tsv)"
  - name: "linear-changelog"
    take: "0 accent hues and 1 easing across a dense dated list: the control feed and the pending queue"
  - name: "owid-grapher"
    take: "the chart with its sources on it: every mark, figure and stage carries its transaction or anchored day"
  - name: "megaeth"
    take: "one claim above the fold, zero decoration, 79 KB above the fold"
parts: ["instanced-grid", "scroll-controls-3d", "number-odometer", "mono-address", "live-ticker", "view-transition", "dual-theme-tokens", "hairline-grid"]
bans:
  - "an opinion score or grade as a headline (a stage is shown with the facts and rule that set it)"
  - "any orange that does not mean weak or weakening control"
  - "a figure without its transaction, anchored day or 'reconstructed' label"
  - "naming a protocol as owner of a program beyond what the chain proves (a repo is 'built from')"
byte_budget_kb: 300
surfaces:
  - route: "/"
    headline: "$769M on Solana sits behind programs that can be upgraded with no waiting period."
    moment: "583 marks fall onto four rungs as the record loads; the odometer counts the no-delay rung, its largest mark (Raydium AMM v4, $573M) labelled first; one orange mark pulses"
    primary_action: "Ask Keyholder (one box: a program id, a key, or a question)"
  - route: "/programs"
    headline: "Every program, by who can move its money"
    moment: "rows re-sort as a filter is chosen; each row's stage glyph fills to its rung"
    primary_action: "Filter: no delay"
  - route: "/programs/[id]"
    headline: "<program>: Stage 1, bound by its admin key"
    moment: "the control chain draws node by node as each fact resolves; the console's keys turn to the live threshold"
    primary_action: "Alert me when this changes"
  - route: "/signers/[key]"
    headline: "One key, <n> multisigs, $<x> behind it"
    moment: "the contagion web opens from the key to its multisigs and programs"
    primary_action: "Watch this key"
  - route: "/changes"
    headline: "Control changes across Solana, newest first"
    moment: "a new row lands; a stage change moves its mark one rung"
    primary_action: "Filter by change type"
  - route: "/pending"
    headline: "Votes in progress that would change who controls the money"
    moment: "each queued action resolves into a plain sentence beside its decoded instructions"
    primary_action: "Watch this multisig"
  - route: "/stages"
    headline: "Four rungs, public rules"
    moment: "the ladder builds rung by rung on scroll with the count and dollars on each"
    primary_action: "Read the rules"
  - route: "/keybench"
    headline: "Would Keyholder have warned before the money moved?"
    moment: "each incident's bar grows to its lead time; misses stay empty"
    primary_action: "Open the Drift replay"
  - route: "/claims"
    headline: "A team states its control; the chain checks it every day"
    moment: "the Drift reconstructed claim cracks at the transaction that broke it"
    primary_action: "File a claim"
  - route: "/build"
    headline: "One line refuses money where control is weak"
    moment: "the devnet refusal replays: require_stage fails with the stage it read"
    primary_action: "Copy require_stage"
  - route: "/proof"
    headline: "Every day's record, hashed and anchored"
    moment: "the browser recomputes today's hash and the match lamp lights"
    primary_action: "Verify a day"
---
Keyholder is the control standard for Solana. On 2026-10-08 it read 583 programs to their signer keys: 360 sit at Stage 0 (one key can act), 185 at Stage 1 (no 24 h delay somewhere), 2 at Stage 2, 36 at Stage 3. Of $2.66B traced vault by vault, $769M sits behind multisigs that can act with no delay. The program built from Kamino's klend repo waits 24 h to upgrade; its global admin, a 4-of-10 Squads v3 multisig, waits for nothing. 50 open votes right now would change control or move funds; two upgrades were approved 630 days ago and can still run.

The world: cordon's warm-paper console (ground L 0.943, one easing) and linear-changelog's restraint (0 accent hues across a dense dated list). Stolen: from cordon the paper operator console; from owid-grapher the rule that every number carries its source.

The convention it breaks: every Solana tool is black and scores protocols with an opinion; this one is light by default, places each program by rules anyone can check, and its only loud colour means one thing.

Who uses it: vaults and lenders gate deposits with require_stage; wallets, exchanges and funds read the API and alerts; security teams watch pending votes and signer keys; protocols file a claim to earn the badge. Demo priority: home (map and Ask), program page, pending votes and KeyBench carry the full motion; the other surfaces share the system at rest.

What it refuses to be: a security dashboard with a risk score, a token scanner, an upgrade monitor.
