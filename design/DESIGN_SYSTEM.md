# DESIGN_SYSTEM.md -- extracted from design/proto/A.html by spec.mjs, 2026-10-08

## Identity
thesis: Keyholder is the control standard for Solana: for any money on Solana it shows who can move it, how fast, whether that changed, and whether it matches what the team promised; any program can refuse money where control is weak.
signal colours: #FF5A1F = control is weak or just got weaker (Stage 0, a cut timelock, a pending control action, a broken claim); nothing else is orange; #1F6B4A = holds: a delay of 24 h or more on every path, a kept claim, verified code
depth level: 3 (founder: 'we are building a 1m dollars quality product' and 'claude is now powered with great motion design and design skills, that must effect our UI' (2026-10-08))
device: the Stage map: every covered program (583) as one instanced mark on a four-rung ladder (Stage 0 one key, 1 no delay, 2 delayed, 3 exit window), sized by dollars traced; marks fall onto their rung as the day's record loads, a pending control action pulses its mark orange, and a stage change moves a mark one rung with the transaction that caused it (source state)
bans: an opinion score or grade as a headline (a stage is shown with the facts and rule that set it); any orange that does not mean weak or weakening control; a figure without its transaction, anchored day or 'reconstructed' label; naming a protocol as owner of a program beyond what the chain proves (a repo is 'built from')

## Tokens (design/TOKENS.css is the source; this is the reading)
ground rgb(230, 226, 217) (L 0.913) · ink rgb(90, 86, 78) (L 0.454) · signal rgb(163, 47, 6) C 0.158 · hairline rgba(27, 26, 23, 0.14) (alpha 0.14)
hue buckets: 30, 150 · radius 0px · shadows 0
fonts: Geist Mono x39, Geist x25 · body weight 400
display 152px "$769M" at 1280; 88px "$769M" at 390
above the fold: 31 elements at 1280, 23 at 390

## Craft
- radius: one value (0px)
- depth: hairlines and surface steps only, no shadows
- hairline: rgba(27, 26, 23, 0.14)
- hover / focus-visible: (write the recipe: what changes, which duration token)

## Primitives (from the prototype inventory; name the ones that recur)
- .brand: a 16px/500 "Keyholder"
- .day: span 12px/400 "Record of 2026-10-08 · anchored"
- .fig: span 152px/500 "$769M"
- .rest: span 30px/500 "on Solana sits behind programs that can be upgraded with no waiting pe"
- .lede: p 14px/400 "Keyholder reads 583 Solana programs to their signer keys, every day, a"
- .device: section 14px/400 "stage-map"
- .reveal: h2 28px/500 "Who can move it, how fast, and did that change?"
- .sub.reveal: p 14px/400 "Today's record, read from chain. Every figure links to the record it c"
- .h: b 21px/500 "$1.89B"
- .src: a 11px/400 "dollars by class"
- .w: b 21px/500 "$769M"
- .w: b 21px/500 "360"
- .src: a 11px/400 "/api/v1/stages"
- .src: a 11px/400 "KLend2g3…YavgmjD"
- .w: b 21px/500 "4-of-10"
- .w: b 21px/500 "50"
- .src: a 11px/400 "/api/v1/pending · 30 min"
- .w: b 21px/500 "630 days"
- .src: a 11px/400 "oldest approved vote"
- .src: a 11px/400 "KeyBench · Drift"
- .reveal: h2 28px/500 "Count the keys."
- .sub.reveal: p 14px/400 "Three ways to use the record."
- .go: a 13px/500 "Build with it →"
- .go: a 13px/500 "Read the API →"
- .go: a 13px/500 "See the claims →"

## Motion (design/MOTION.md holds the causes)
easings: cubic-bezier(0.2, 0.7, 0.2, 1) (1 of max 3)
durations seen: 320, 480 ms · longest 480 ms · cap 1600 ms


## Acceptance checklist (each is a finding at Stop when it fails)
- [ ] the shipped :root matches TOKENS.css (drift.mjs reports no drift)
- [ ] every surface's headline is its largest text at 390 and 1280 (measure.mjs)
- [ ] hue buckets on any surface <= 2; signal colour only where it means "control is weak or just got weaker (Stage 0, a cut timelock, a pending control action, a broken claim); nothing else is orange"
- [ ] radius 0px only; shadows 0
- [ ] easings <= 2, longest transition <= 1600 ms, nothing starts at opacity 0
- [ ] bytes at 390 <= 300 KB
- [ ] the device renders on every surface the charter lists it on
- [ ] TRANSFER.md fully ticked before the route is called done
