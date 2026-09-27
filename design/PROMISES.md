# PROMISES.md — every device, screen and asset the plans promised, and its state
# Sources: plan/CREATIVE.md (§2–§8), design/CHARTER.md, design/REVAMP.md, design/REVAMP-2.md.
# States: open | built | tested | dropped (dropped needs a reason). The fence hook refuses a
# commit whose message claims a surface or the build is done while any row for it is open.
# Surface keys: identity, device, home, replay, feed, protocol, event, wallet, alerts, vaults, proof, global, pipeline.

| id | surface | promise | source | state | evidence / reason |
|---|---|---|---|---|---|
| P01 | identity | mark (two key bows crossed, orange notch), SVG | REVAMP-2 §0 | open | |
| P02 | identity | favicon + apple icon, readable at 16 px | REVAMP-2 §0 | open | |
| P03 | identity | 1200×630 share card per page; protocol cards show live console state | REVAMP-2 §0 | open | |
| P04 | identity | X avatar | REVAMP-2 §0 | open | |
| P05 | device | console from a real modelled object (GLB), not primitives | CREATIVE §7, FOUNDER 2026-09-19 | open | |
| P06 | device | brushed-metal PBR bezel, baked AO | CREATIVE §7 | open | |
| P07 | device | Departure Mono on readouts; labels as decals | CREATIVE §4 | open | |
| P08 | device | keys turn 240 ms, lamp 90 ms no blink, needle 320 ms spring, nothing loops | CREATIVE §4 | built | 5ae08a6 (on primitive model) |
| P09 | device | waiting / unresolved / immutable / governance states | REVAMP 1 | built | 5e4740c, 98b7242 |
| P10 | home | headline + "Count the keys." + scroll story | CREATIVE §5, REVAMP 1 | built | 293ef45, 50ec8f2 |
| P11 | home | loader that is a number (protocols read) | CREATIVE ref 18 | open | |
| P12 | home | status strip as slot ribbon, orange where a change landed | CREATIVE ref 11 | open | |
| P13 | home | table rows open an inline mini-console | REVAMP-2 §2 | open | |
| P14 | replay | time brush 1 Mar – 3 Apr under the console | CREATIVE §5 | open | |
| P15 | replay | second multisig appears on the console; admin key moves; lamp lights 25 Mar | CREATIVE §5 (facts corrected) | open | |
| P16 | replay | the alert shown as a phone notification with its timestamp | CREATIVE §5 | open | |
| P17 | replay | drain: ground turns to dark trace texture while withdrawals run | CREATIVE §5, ref 8 | open | |
| P18 | replay | the vault's check refusing at the first alert | CREATIVE §5 | open | |
| P19 | replay | choreography editable (Theatre.js) | CREATIVE §7 | open | |
| P20 | replay | every frame cites its transaction; rebuilt state labelled reconstructed | CREATIVE §5 | built | b37e40a |
| P21 | feed | type glyphs + filters: upgrade, key change, threshold, timelock, nonce, admin action, verification drift, proposal created | CREATIVE §5, BRIEF 2 | open | |
| P22 | feed | severity number leads each row | CREATIVE ref 2 | open | |
| P23 | feed | time brush filters the list; j/k keys; r opens the replay at the current event | CREATIVE §5–6 | open | |
| P24 | protocol | control map drawn as a plan: program → authority → multisig → keyholders | CREATIVE ref 6 | open | |
| P25 | protocol | changelog as a dated rail | CREATIVE ref 16 | built | 8b00b5b |
| P26 | protocol | badge "checked N min ago" | CREATIVE §5 | open | |
| P27 | event | before → after console side by side | CREATIVE §5 | open | |
| P28 | event | what we know / what we don't / correction history | CREATIVE §5 | open | |
| P29 | wallet | each protocol a small live console, weakest first | CREATIVE §5 | open | |
| P30 | wallet | one switch: alert me on all of these | CREATIVE §5 | open | |
| P31 | alerts | rules in plain language | CREATIVE §5 | open | |
| P32 | alerts | Telegram / email / X channels | CREATIVE §5 | open | needs Telegram bot token from founder |
| P33 | vaults | the one Rust call, copyable; live simulator | CREATIVE §5 | built | b583498 |
| P34 | vaults | gate row as 15 mini-consoles | REVAMP-2 §8 | open | |
| P35 | proof | devnet pass → weaken → refuse, all from chain | pipeline | built | eefaf39, 2652424 |
| P36 | global | ⌘K / "/" palette (protocol, program id, wallet, signature) | CREATIVE §6 | open | |
| P37 | global | every state a URL (protocol, event, replay frame, policy) | CREATIVE §6 | open | |
| P38 | global | dark theme, full second theme | CREATIVE §4 | open | |
| P39 | global | page transitions | REVAMP 1 | open | |
| P40 | global | LCP < 1.5 s on 4G, 3D after text, static fallback | CREATIVE §6 | open | measured only on localhost |
| P41 | pipeline | public deploy | conductor | open | |
| P42 | pipeline | live test in founder's Chrome on the public URL | conductor | open | |
| P43 | pipeline | interrogate | conductor | open | |
| P44 | pipeline | README (one fold) | conductor, FOUNDER | open | |
| P45 | pipeline | demo rehearsal + demo video | conductor | open | |
| P46 | pipeline | package + preflight | conductor | open | |
| P47 | pipeline | presentation video 2–3 min, founder to camera | brief §4, §9 | open | founder records; script prepared |
| P48 | pipeline | submission form drafted: GTM, demand, business model, team, disclosure, tools | brief §4, PRD §8–9 | open | |
| P49 | pipeline | founder registered on colosseum.com; submission uploaded before 23:59 PT 12 Oct | brief checklist | open | founder-only |
| P50 | distribution | X account posts each real control change with a link; public counts on the site | BRIEF demand | open | needs founder's X login at setup |
| P51 | api | /api docs page; x402 paid call proven once with real USDC; firehose endpoint | BRIEF 9, DEV-050 | open | |
| P52 | protocol | embeddable badge with copyable snippet | PRD §6.3, CREATIVE §5 | built | badge route + embed block (e389520, 774cb85); "checked N min ago" is P26 |
| P53 | program | attester publishes control state on-chain | BRIEF 8, B-worker 7 | open | |
| P54 | feed | any Anchor admin instruction decoded from its on-chain IDL; undecoded shown raw with "We do not guess." | BRIEF 3, CREATIVE §3 | open | |
| P55 | home, feed | "weakened in 24 h" rail (live, not reconstructed) | CREATIVE §5, ref 4 | open | removed from home 50ec8f2 because it was empty; returns as live data |
| P56 | protocol, home | verified / drifted / never-registered chip per program with its osec source | BRIEF 4, TEN 6 | built | 801d81e, 774cb85 |
| P57 | replay | durable-nonce frame: date and count as read on chain, cited | CREATIVE §5, DEV-025/026 | open | chain shows one nonce, 31 Mar 02:35; CREATIVE's "four on 23 Mar" unverified |
| P58 | copy | no "3→2" / "3-of-5" for Drift and no "9 days" / "1.55 days" anywhere shipped (grep gate on apps/, README, scripts, video script) | TEN 5, corrections | open | |
| P59 | package | every number in the form measured, never copied from PRD (no invented traction, no "Upgrade Watch") | PRD §9 | open | |
| P60 | feed | only tracked-protocol events are public (test) | BUILD-REPORT known | built | fetchControlChanges requires protocol_id (648fd79); test still to add |
| P61 | global | one route name for vaults (/policy), /program redirects | CHARTER, OVERHAUL §9 | open | |
| P62 | data | "15 protocols" stated everywhere; no "30" | CREATIVE §3 | open | |
| P63 | proof | own program 2-of-3 / 48 h on chain; real 24 h flip staged the day before recording | TEN 8, DEV-067 | built | multisig K3u623… 47a521b; the recording flip is P45's prep |
| P64 | pipeline | public GitHub repo with LICENSE; contest-window work visible | brief §3–4 | open | |
| P65 | global | 404 page, loading skeletons, stale state on every route | OVERHAUL §11 | open | |
| P66 | pipeline | weekly one-minute update videos | brief | open | founder-optional |
