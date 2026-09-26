# DESIGN_SYSTEM.md -- extracted from design/proto/A.html by spec.mjs, 2026-09-26

## Identity
thesis: Keyholder shows who can move the money in every Solana protocol (keys, threshold, timelock, verified code), rings when that control weakens, and lets any program refuse to deposit where it just did.
signal colours: #FF5A1F = control weakened (keys required dropped, timelock cut, code drifted); nothing else is orange; #1F6B4A = verified: on-chain code matches its registered source
depth level: 3 (founder: 'a legendary product with perfect execution and UI' (2026-09-26); the console is a lit parametric object)
device: the launch console for one protocol: one key slot per signer (filled = required), the turn requirement (e.g. 4 of 7), a TIMELOCK dial whose needle rests at the live value, a VERIFIED lamp, and the last-change clock with its slot; a key slot empties and the orange lamp lights when control weakens (source state)
bans: a risk score or grade as the headline of any surface (facts first: keys, threshold, timelock, verified); any orange that does not mean 'control got weaker'; a figure without its slot, transaction or 'reconstructed' label

## Tokens (design/TOKENS.css is the source; this is the reading)
ground rgb(230, 226, 217) (L 0.913) · ink rgb(27, 26, 23) (L 0.218) · signal rgb(255, 90, 31) C 0.211 · hairline rgba(27, 26, 23, 0.14) (alpha 0.14)
hue buckets: 30 · radius 50px · shadows 1 (rgba(27, 26, 23, 0.35) 0px 30px 60px -30px)
fonts: Geist Mono x24, Geist x13 · body weight 400
display 46.08px "Drift needed two keys to lose $285M." at 1280; 30px "Drift needed two keys to lose $285M." at 390
above the fold: 40 elements at 1280, 24 at 390

## Craft
- radius: one value (50px); the prototype also used 50px: pick one or write the exception here
- depth: 1 shadow value(s); at depth level 3 justify each or cut
- hairline: rgba(27, 26, 23, 0.14)
- hover / focus-visible: (write the recipe: what changes, which duration token)

## Primitives (from the prototype inventory; name the ones that recur)
- .kicker: p 12px/400 "Keyholder"
- .lede.mono: p 14px/400 "Count the keys."
- .lede: p 16px/400 "Keyholder shows who can move the money in every Solana protocol (keys,"
- .primary: a 13px/400 "Find your wallet"
- .who: span 13.5px/400 "Drift admin council · 2 of 5 · no timelock"
- .meta.mono: span 12px/400 "timelock 0 · 1 Apr 2026 · reconstructed"
- .who: span 13.5px/400 "Drift upgrade key · 4 of 7"
- .meta.mono: span 12px/400 "timelock 3,600s · read 2026-09-26 · slot 450,660,594"
- .who: span 13.5px/400 "Drift admin council · nonces staged"
- .meta.mono: span 12px/400 "23 Mar 2026 · reconstructed"
- .who: span 13.5px/400 "15 major Solana programs · 3 verified, 6 drifted, 6 unregistered"
- .meta.mono: span 12px/400 "verify.osec.io · 26 Sep 2026"
- .catch: p 13px/400 ""Count the keys." · "Who can move your money, and did that just change"
- .mono: footer 11px/400 "KEYHOLDER · every figure carries its slot, transaction or reconstructe"

## Motion (design/MOTION.md holds the causes)
easings: cubic-bezier(0.2, 0.7, 0.2, 1) (1 of max 3)
durations seen: 240 ms · longest 240 ms · cap 1600 ms


## Acceptance checklist (each is a finding at Stop when it fails)
- [ ] the shipped :root matches TOKENS.css (drift.mjs reports no drift)
- [ ] every surface's headline is its largest text at 390 and 1280 (measure.mjs)
- [ ] hue buckets on any surface <= 1; signal colour only where it means "control weakened (keys required dropped, timelock cut, code drifted); nothing else is orange"
- [ ] radius 50px only; shadows 1
- [ ] easings <= 2, longest transition <= 1600 ms, nothing starts at opacity 0
- [ ] bytes at 390 <= 300 KB
- [ ] the device renders on every surface the charter lists it on
- [ ] TRANSFER.md fully ticked before the route is called done
