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
| P21 | feed | type glyphs + filters (upgrade, authority, multisig settings) | CREATIVE §5 | open | |
| P22 | feed | severity number leads each row | CREATIVE ref 2 | open | |
| P23 | feed | time brush filters the list; j/k keys | CREATIVE §5–6 | open | |
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
