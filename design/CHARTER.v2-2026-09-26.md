---
thesis: "Keyholder shows who can move the money in every Solana protocol (keys, threshold, timelock, verified code), rings when that control weakens, and lets any program refuse to deposit where it just did."
skim_seconds: 5
stack: next-dev
signal_colours:
  - hex: "#FF5A1F"
    means: "control weakened (keys required dropped, timelock cut, code drifted); nothing else is orange"
  - hex: "#1F6B4A"
    means: "verified: on-chain code matches its registered source"
depth_level: 3
depth_reason: "founder: 'a legendary product with perfect execution and UI' (2026-09-26); the console is a lit parametric object"
motion:
  cap_ms: 1600
  easings: 3
  durations: { tick: 90, element: 240, data: 320, count: 1400 }
device:
  renders: "the launch console for one protocol: one key slot per signer (filled = required), the turn requirement (e.g. 4 of 7), a TIMELOCK dial whose needle rests at the live value, a VERIFIED lamp, and the last-change clock with its slot; a key slot empties and the orange lamp lights when control weakens"
  source: state
  swap_test: "swap in any other product and the console has no keys to count: the slots, the 4-of-7 and the 3,600 s dial are read from this protocol's Squads multisig and ProgramData at a named slot; for a DEX, a wallet or a dashboard they would be invented numbers, i.e. a lie"
genre: "instrument console (warm-paper operator instrument; cordon / linear-changelog restraint shelf)"
wonder: "Drift's console with two of five keys turned and the timelock needle pinned at 0 h, under the line 'Drift needed two keys to lose $285M.'"
hero_technique: "scroll-controls-3d"
faces:
  display: "Geist"
  text: "Geist"
  mono: "Geist Mono"
references:
  - name: "cordon"
    take: "warm-paper console ground, groundL 0.943, 1 easing, 400 ms longest (refs/INDEX.tsv)"
  - name: "linear-changelog"
    take: "0 accent hues and 1 easing across a dense dated list: the control changelog per protocol"
  - name: "owid-grapher"
    take: "the chart with its sources on it: every figure carries its slot or transaction"
  - name: "megaeth"
    take: "one claim above the fold, zero decoration, 79 KB above the fold"
parts: ["scroll-controls-3d", "hdri-environment", "contact-shadows-float", "number-odometer", "mono-address", "live-ticker", "dual-theme-tokens", "hairline-grid"]
bans:
  - "a risk score or grade as the headline of any surface (facts first: keys, threshold, timelock, verified)"
  - "any orange that does not mean 'control got weaker'"
  - "a figure without its slot, transaction or 'reconstructed' label"
byte_budget_kb: 300
surfaces:
  - route: "/"
    headline: "Drift needed two keys to lose $285M."
    moment: "the console turns to face you; key slots fill from the live read; the timelock needle settles at its value"
    primary_action: "Find your wallet"
  - route: "/protocols/[slug]"
    headline: "<Protocol>: 4 of 7 keys, 1 h timelock"
    moment: "the four console rows resolve with their slots; the verified lamp lights or stays dark"
    primary_action: "Alert me when this changes"
  - route: "/feed"
    headline: "Control changes across Solana, newest first"
    moment: "a new row slides in with its severity number as the SSE event lands"
    primary_action: "Filter by change type"
  - route: "/events/[id]"
    headline: "<Protocol>: threshold 3 → 2, timelock 0"
    moment: "before and after consoles side by side; the emptied key slot marked in orange"
    primary_action: "Open the transaction"
  - route: "/replay/drift"
    headline: "What Drift's keys said before the drain"
    moment: "scrubbing the time brush turns the console frame by frame; the lamp lights at the council migration"
    primary_action: "Scrub to 23 March"
  - route: "/wallet"
    headline: "Who holds the keys to your money"
    moment: "each position resolves to a small console with its key count"
    primary_action: "Alert on all"
  - route: "/alerts"
    headline: "Tell me when the keys get fewer"
    moment: "the rule reads back in one plain sentence as you choose it"
    primary_action: "Connect Telegram"
  - route: "/program"
    headline: "Refuse to move money where control just weakened"
    moment: "the simulator flips PASS to FAIL with the reason bits when you pick a weakened protocol"
    primary_action: "Copy the check call"
  - route: "/proof"
    headline: "Our own keys: 2 of 3, 48 h timelock"
    moment: "the program's own console, read live, verified lamp lit"
    primary_action: "Verify on the explorer"
---

Keyholder counts the keys. Drift lost $285.26M on 1 April 2026 through its control plane: a 2-of-5 council with zero timelock, durable nonces staged on 23 March, threshold lowered from 3 to 2, 18 vaults drained in 128 s. Every step was on-chain; Solscan shows the upgrade key as "MULTISIG" and stops. Keyholder follows the key to its multisig and prints the numbers: today Drift's upgrade key is 4 of 7 with a 3,600 s timelock (read 2026-09-26).

The world: cordon's warm-paper console (ground L 0.943, one easing) and linear-changelog's restraint (0 accent hues across a dense dated list). Stolen: from cordon the paper operator console; from owid-grapher the rule that every number carries its source.

The convention it breaks: every Solana tool is black; this one is light by default, and its only loud colour means one thing.

What it refuses to be: a security dashboard with a risk score, a token scanner, an upgrade monitor.
