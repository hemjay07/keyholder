# TRANSFER.md -- every prototype element, ticked when the route is built. kept | dropped, with a reason.
# From design/proto/A.html. Nothing is lost between mockup and build (FOUNDER 2026-09-16).

| # | element | text / device | size | status | reason |
|---|---|---|---|---|---|
| 1 | span | SLOT | 11px | kept | status bar |
| 2 | span | READ | 11px | kept | status bar |
| 3 | span | PROGRAMS TRACKED | 11px | kept | reads PROTOCOLS TRACKED: the product counts protocols, not programs |
| 4 | span | WEAKENED (RECONSTRUCTED) | 11px | changed | now live: 'N OF M WITH NO TIMELOCK'; a hardcoded 1 was a fixed figure (build rule 19) |
| 5 | b | 450,660,594 | 11px | kept | live slot from RPC |
| 6 | b | 2026-09-26 | 11px | kept | read date |
| 7 | b | 15 | 11px | kept | live count |
| 8 | b | 1 | 11px | changed | live count, see #4 |
| 9 | iframe | console | 16px | kept | iframe replaced by the R3F console component (ConsoleDevice), same device, data-device=console |
| 10 | p.kicker | Keyholder | 12px | kept |  |
| 11 | h1 | Drift needed two keys to lose $285M. | 46.08px | kept | headline, measured largest text |
| 12 | p.lede.mono | Count the keys. | 14px | kept |  |
| 13 | p.lede | Keyholder shows who can move the money in every Solana protocol (keys, | 16px | kept |  |
| 14 | a.primary | Find your wallet | 13px | kept | CTA; target route /wallet built in UI round 2 |
| 15 | a | Watch the Drift replay | 13px | kept | CTA; target /replay/drift built in UI round 2 |
| 16 | h2 | Weakened in 24h | 11px | kept |  |
| 17 | h2 | Latest changes | 11px | kept |  |
| 18 | span.who | Drift admin council · 2 of 5 · no timelock | 13.5px | kept | reconstructed row, labelled |
| 19 | span.meta.mono | timelock 0 · 1 Apr 2026 · reconstructed | 12px | kept |  |
| 20 | span.who | Drift upgrade key · 4 of 7 | 13.5px | moved | Drift upgrade key lives in the table and on /protocols/drift; the rail shows only recorded changes |
| 21 | span.meta.mono | timelock 3,600s · read 2026-09-26 · slot 450,660,594 | 12px | moved | see #20; timelock now written '1 h' |
| 22 | span.who | Drift admin council · nonces staged | 13.5px | dropped | nonce staging is not in the events table yet; it returns on /replay/drift (reconstructed) in round 2 |
| 23 | span.meta.mono | 23 Mar 2026 · reconstructed | 12px | dropped | see #22 |
| 24 | span.who | 15 major Solana programs · 3 verified, 6 drifted, 6 unregistered | 13.5px | moved | live in the status bar: CODE 3 VERIFIED · 6 DRIFTED · 6 NEVER REGISTERED |
| 25 | span.meta.mono | verify.osec.io · 26 Sep 2026 | 12px | moved | source named in each protocol page's citations |
| 26 | h2 | What ships | 11px | kept |  |
| 27 | li | Drift needed two keys to lose $285M. | 14.5px | kept | TEN.md verbatim |
| 28 | li | Count the keys. | 14.5px | kept | TEN.md verbatim |
| 29 | li | Drift's upgrade key today: 4 of 7 keys, 3,600-second timelock, read at | 14.5px | kept | TEN.md verbatim |
| 30 | li | Solscan says "MULTISIG" and stops; Keyholder follows the key to the mu | 14.5px | kept | TEN.md verbatim |
| 31 | li | On 23 March 2026 durable nonces were staged; then the council went fro | 14.5px | kept | TEN.md verbatim |
| 32 | li | Of 15 major Solana programs, 3 are verified today, 6 drifted from thei | 14.5px | kept | TEN.md verbatim |
| 33 | li | Any program can ask Keyholder before it moves money, and be refused on | 14.5px | kept | TEN.md verbatim |
| 34 | li | Our own program is controlled by 2 of 3 keys with a 48-hour public tim | 14.5px | kept | TEN.md verbatim |
| 35 | li | Find your wallet: see who holds the keys to every protocol your money  | 14.5px | kept | TEN.md verbatim |
| 36 | li | Every number here carries the slot or transaction it was read from; re | 14.5px | kept | TEN.md verbatim |
| 37 | p.catch | "Count the keys." · "Who can move your money, and did that just change | 13px | kept |  |
| 38 | footer.mono | KEYHOLDER · every figure carries its slot, transaction or reconstructe | 11px | kept |  |
