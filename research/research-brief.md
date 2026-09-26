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
# Scope Sketch: Upgrade Watch

**Founder:** Solo, Next.js/TypeScript. No Rust program shipped.
**Reused:** none.
**Deadline:** 2026-10-12 23:59 PT (17 days from 2026-09-25).
**Lane:** Global developer/security. Every upgrade of an upgradeable Solana program is caught at the loader, checked against the verified build, diffed against the previous version, scored, and pushed to the wallets, protocols, indexers and funds that depend on it before their users sign again.
**Research method:** WebFetch, `curl`, `gh api`, and the public mainnet RPC only (WebSearch budget exhausted; no Chrome). Every fact below carries its URL and the fetch date. "not found" means the page did not say it; "blocked" means the page could not be read.

---

## Part A. Verified facts

### A1. Verified builds (fetched 2026-09-25)

| Fact | Source |
|---|---|
| Verification = "comparing the hash of the onchain program with the hash of the locally built program from the source code", built in Docker for determinism. | https://solana.com/developers/guides/advanced/verified-builds |
| Verification metadata lives in a PDA owned by the OtterSec verify program `verifycLy8mB96wd9wqq3WDXQwM4oU6r42Th37Db9fC`; the PDA holds "the program address, git url, commit hash and the arguments used to build the program." | same |
| PDA seeds (from source): `[b"otter_verify", authority, program_address]`. Account `BuildParams { address, signer, version, git_url, commit, args: Vec<String>, deploy_slot: u64 }`. An `OtterVerifyEvent { signer, program, params }` is emitted on init/update. | https://github.com/otter-sec/otter-verify (`programs/otter-verify/src/lib.rs`, read via `gh api`) |
| API endpoints: `GET /status/<PROGRAM_ID>`, `GET /job/<JOB_ID>`, `GET /verified-programs`. | https://verify.osec.io (root page) |
| `GET /status/<id>` returns `{is_verified, message, on_chain_hash, executable_hash, repo_url, commit, last_verified_at, is_frozen, is_closed}`. Verified example (marginfi v2 `MFv2hWf3…`): `repo_url` includes `/tree/<commit>`, `commit` = `33c67987…`, `last_verified_at` `2026-09-04T19:00:08`. Orca Whirlpools `whirLbMi…`: `is_verified:false`, `repo_url` set, `commit:"None"`, `on_chain_hash` populated. Jupiter v6 `JUP6Lkb…`: not verified, all fields empty. | `curl https://verify.osec.io/status/…` |
| `GET /verified-programs` is paginated: `meta.total = 540`, 27 pages of 20, returns program-ID strings only (no commit; you call `/status` per ID). | `curl https://verify.osec.io/verified-programs` |
| After an upgrade: "The API detects your upgrade and unverifies your program." Developer must update the PDA with the new commit and resubmit. "The API automatically re-verifies all programs every 24 hours." | https://solana.com/docs/programs/verified-builds |
| CLI: `solana-verify get-program-hash -u <url> <program-id>`, `solana-verify list-program-pdas --program-id`, `solana-verify export-pda-tx` (for multisig-held authority), `solana-verify remote submit-job --program-id … --uploader …`, `remote get-job`. The legacy `--remote` flag is deprecated: "Upload your PDA with programs upgrade authority, then run the `remote submit-job` command." | same + https://raw.githubusercontent.com/Ellipsis-Labs/solana-verifiable-build/master/README.md |
| Explorers showing status: Solana Explorer (verified-build tab), SolanaFM, Solscan (`#programVerification`), SolanaVerify.org, a Dune dashboard. | https://solana.com/developers/guides/advanced/verified-builds |
| README caveat: "Post-install verification of installed toolchain/platform-tools is still follow-up work." Repo: 490 stars, pushed 2026-09-24. | https://github.com/Ellipsis-Labs/solana-verifiable-build (`gh api`) |
| Whether verify.osec.io publishes the *previous* commit for a program: **not found** (status returns only the current one). |  |

### A2. Upgrade mechanics (fetched 2026-09-25)

| Fact | Source |
|---|---|
| Program account = metadata, address is the program ID; ProgramData account = executable code. Owner `BPFLoaderUpgradeab1e11111111111111111111111`. `solana program show` prints `ProgramData Address`, `Authority`, `Last Deployed In Slot`, `Data Length`. | https://solana.com/docs/programs/deploying |
| Upgrade = `solana program deploy` again; auto-extends if larger; `solana program extend <id> <bytes>`. `set-upgrade-authority --new-upgrade-authority`; `--final` makes it immutable ("Authority: none", irreversible); `close` reclaims SOL, "the Program ID can not be reused". | same |
| `UpgradeableLoaderInstruction` (crate `solana-loader-v3-interface` 9.0.0), discriminants: 0 InitializeBuffer, 1 Write, 2 DeployWithMaxDataLen, 3 Upgrade (7 accounts), 4 SetAuthority, 5 Close, 6 ExtendProgram ("minimum 10 KiB post-SIMD-0431"), 7 SetAuthorityChecked. `Migrate` / `ExtendProgramChecked` **not listed** on that page. | https://docs.rs/solana-loader-v3-interface/latest/solana_loader_v3_interface/instruction/enum.UpgradeableLoaderInstruction.html |
| `UpgradeableLoaderState::ProgramData { slot: u64, upgrade_authority_address: Option<Pubkey> }`; `Program { programdata_address }`; `Buffer { authority_address }`. | https://docs.rs/solana-loader-v3-interface/latest/solana_loader_v3_interface/state/enum.UpgradeableLoaderState.html |
| On Upgrade the runtime writes `ProgramData { slot: clock.slot, upgrade_authority_address: Some(authority) }` (so `slot` is the last-upgrade slot). SetAuthority must be "signed by the current upgrade authority". | https://www.sec3.dev/blog/solana-internals-part-2-how-is-a-solana-program-deployed-and-upgraded (2022-01-16) |
| **Loader v4 status:** the Agave feature gate `enable_loader_v4` is declared as `LoaderV4WasAbandoned11111111111111111111111` (label "SIMD-0167: Enable Loader-v4"); Agave `programs/` contains only `bpf_loader`; SIMD PRs #167 (Loader-v4) and #315 (v3→v4 migration) are closed; the feature-gate tracker lists no loader-v4 row. `solana-loader-v4-interface` 3.1.0 still exists on docs.rs (`LoaderV411111111111111111111111111111111111`). Read: v3 is the loader that matters; v4 is not coming. | https://raw.githubusercontent.com/anza-xyz/agave/master/feature-set/src/lib.rs; `gh api search/issues`; https://github.com/anza-xyz/agave/wiki/Feature-Gate-Tracker-Schedule; https://raw.githubusercontent.com/anza-xyz/solana-sdk/master/sdk-ids/src/lib.rs |
| Related pending change: SIMD-0500 (disable deployment of sBPF v0/v1/v2), implemented in Agave 4.1.0, expected release Agave 4.4 (~Nov 2026), "not scheduled" on mainnet as of 2026-09-24. Legacy programs "cannot receive the next upgrade" until recompiled. | https://victorgsoutoxp.github.io/UpgradeGuard/ (dashboard, 2026-09-25) |

### A3. Detection (fetched 2026-09-25)

| Fact | Source |
|---|---|
| Helius plans: Free $0 (1M credits, 10 RPS, webhooks included, LaserStream gRPC not included); Developer $49 (10M credits, 50 RPS, LaserStream devnet only); Business $499 (100M, 200 RPS, LaserStream mainnet); Professional $999 (200M, 500 RPS). | https://www.helius.dev/pricing |
| Webhooks: Free plan 5 webhooks, paid 50; 100,000 addresses per webhook; 1 credit per event; "Latency: 200-500ms from confirmation"; raw webhooks have lower latency than enhanced. The API reference's own example uses `accountAddresses: ['PROGRAM_ADDRESS']` (a program ID as a watched address), so registering the loader ID is the documented pattern. Free-plan webhooks are auto-disabled after a 24-hour failure window (7 days on paid). | https://www.helius.dev/docs/api-reference/webhooks/llms.txt; https://www.helius.dev/docs/webhooks |
| **Parsed Streams** (WebSocket, `wss://beta.helius-rpc.com/?api-key=`): "server-side filtering by program, account, and instruction name", filter fields `programs` and `instructionNames`; IDL catalog "3,600+ programs"; "generally available on all plans, including Free" at 1 credit per delivered event; metering starts 2026-09-24. Whether the BPF Upgradeable Loader is in the catalog: **not found** (check with `describeProgram` on `wss://fs-beta.helius-rpc.com`). | https://www.helius.dev/docs/llms.txt; https://www.helius.dev/docs/parsed-streams; https://www.helius.dev/docs/api-reference/parsed-streams/describeprogram |
| LaserStream WebSocket `transactionSubscribe` with account include/required/exclude needs Developer or above; latency "~400ms" processed, "~2-3 seconds" confirmed. LaserStream gRPC mainnet needs Business/Professional; 48-hour replay. | https://www.helius.dev/docs/enhanced-websockets; https://www.helius.dev/docs/laserstream |
| Yellowstone (Dragon's Mouth) transaction filters: `vote`, `failed`, `account_include`, `account_exclude`, `signature`; "fields work as logical AND, and values in arrays as logical OR"; commitment PROCESSED/CONFIRMED/FINALIZED. Triton hosted access needs an `x-token`; pricing not shown. | https://docs.triton.one/project-yellowstone/dragons-mouth-grpc-subscriptions |
| QuickNode: "Solana gRPC is included with the Scale plan and up." | https://www.quicknode.com/guides/solana-development/tooling/solana-microscope |
| **Measured firehose** (public RPC, `getSignaturesForAddress` on the loader, 2026-09-25 20:45–21:07 UTC): 6,000 loader transactions in 22.6 min (~16,000/h). Of 340 sampled and parsed, 334 were `write` (buffer chunks), 3 `initializeBuffer`, 1 `deployWithMaxDataLen`, 0 `upgrade`. Conclusion: a listener must filter on the `Upgrade` discriminant (3) or on instruction name, not on "any loader tx"; upgrades/day **not measured** (sample too small; see A6). | `curl https://api.mainnet-beta.solana.com` (scripts in scratchpad) |

### A4. Existing products (fetched 2026-09-25/26)

| Product | What it does (as stated) | Does the dependents-diff-and-alert job? | Source |
|---|---|---|---|
| Tokamai | **blocked**: `tokamai.com` and `app.tokamai.com` do not resolve (DNS ENOTFOUND; `tokamai.io` also 000). GitHub shows `tokamai-team/tokamai-skills` (pushed 2026-05-05). | Unknown; unreachable. | curl/`gh api` |
| Sec3 | Products: audits, formal verification, X-Ray (static analysis), IDL Guesser ("Recover instruction layouts from closed-source Solana programs compiled to sBPF bytecode"), free Nonce & Multisig Monitoring ("New durable nonce account creation", "Authority transfers on existing nonce accounts", "Configuration modifications to Squads v4 multisig"), SecLaunch. No pricing shown. WatchTower (announced 2022-09-06, "open to a few selected pilot users only") listed built-in monitors including "Contract updates", email alerts. | Only a piece: multisig-config and nonce staging, for the protocol's own team. No verified-build check, no diff, no dependents feed. | https://www.sec3.dev; https://www.sec3.dev/free-tools/nonce-multisig-monitoring; https://www.sec3.dev/blog/announcing-watchtower |
| Squads | `squads.so` → `squads.xyz`; products Altitude, Fuse, Grid, Squads Multisig. Programs doc: transfer upgrade authority to the vault (or Safe Authority Transfer), deploy to a buffer, create an upgrade proposal; members "can view the details about the upgrade in the Squads app"; members can "verify that the on-chain buffer matches the program source code using Ellipsis Labs's verifiable build"; GitHub Action initializes proposals from CI. Time locks: "1 hour, 1 day, 1 week, Custom (in seconds), None"; "apply globally to all Squad transactions once set". Public visibility of proposals: **not found** in docs (ASSUMPTION: proposals are on-chain accounts and therefore readable). | No: a control for the owner, not an alert for dependents. But its proposals are the pre-upgrade signal a timelock score can use. | https://squads.xyz; https://docs.squads.so/main/navigating-your-squad/developers-assets/programs.md; https://docs.squads.so/main/navigating-your-squad/settings/time-locks.md |
| Blowfish | `blowfish.xyz` redirects to a GoDaddy for-sale page; org repo `blowfish-frontend-monorepo` archived 2025-02-18; `blocklist` still pushed 2026-06-17. Wallet deal terms: **not found**. | No (appears defunct as a product). | curl; `gh api orgs/blowfishxyz/repos` |
| Phantom | Help: "This dApp could be malicious" appears when "Phantom can't accurately simulate a transaction before it's sent"; token-scam article says transaction previews "flag phishing attempts or malicious contracts". Nothing about recently-upgraded or unverified programs. | No. | https://help.phantom.com/hc/en-us/articles/43483612411411; https://help.phantom.com/hc/en-us/search?query=malicious+transaction |
| RugCheck | Site is a JS shell ("Solana & Fogo Token Risk Scanner"). Swagger paths are all `/v1/tokens/...`, `/v1/stats/...`, `/v1/domains/...`; no program or upgrade endpoint. | No (tokens only). | https://api.rugcheck.xyz/swagger/doc.json |
| Solscan / Solana Explorer / SolanaFM / Orb | Solscan program page: HTTP 403 to fetch; docs index says nothing about upgrade history. Solana Explorer: 429 (twice). SolanaFM, Orb: JS shells. The verified-builds guide says all show verified status. An explorer "upgrade history" list: **not found**. | No evidence any explorer lists upgrade history. | https://solscan.io/account/…; https://docs.solscan.io/; https://explorer.solana.com/address/… |
| **Solana Microscope** (Solana Foundation, MIT, Rust, created 2026-09-15, pushed 2026-09-24, 31 stars) | "Self-hosted monitoring and alerting for Solana programs." Consumes Yellowstone gRPC or RPC polling, decodes with Carbon from a compiled-in IDL, Prometheus/Loki/Grafana, Slack/Telegram/PagerDuty; normalizes Squads v3/v4/v5 activity. "One deployment monitors one program and, optionally, one Squads multisig." Decoder "knows only the instructions and events the build's IDL declared." QuickNode guide (2026-09-22): "If you depend on someone else's program, the same tool points outward and watches the governance of a protocol you've integrated with"; alert on `proposal_created` "before the upgrade can execute". No bytecode/verified-build check, no diff. | A piece, and the closest thing to a collision: it watches the *governance* (Squads proposals, authority-change instructions) of one program per deployment, self-hosted, for a team that sets it up. It does not detect the loader `Upgrade` itself across all programs, does not verify or diff, and has no shared feed. | https://github.com/solana-foundation/solana-microscope (README via `gh api`); https://www.quicknode.com/guides/solana-development/tooling/solana-microscope |
| svmscope (`alizeeshan1234/svmScope`, 6 stars, pushed 2026-09-25) | "Transaction autopsy for Solana — decode any transaction, replay it locally in an embedded SVM, mutate state, time-travel, and freeze it into offline test fixtures." A `dev-dependency` crate; a recorder watches hot accounts for replay. `svmscope.com/.xyz/.io` do not resolve. The "dependency-deploy monitoring" description from @boardyai is **not** what the README says. | No: a debugging/replay tool, not monitoring or alerting. | `gh api repos/alizeeshan1234/svmScope` |
| solana-upgrade-guard (`FannBe`, 0 stars, one commit 2026-06-25) | A Claude Code skill: "Pre-deploy safety for Solana program upgrades", zero-dep CLIs `layout-diff.mjs` (Anchor IDL account-layout diff, fails CI on breaking changes), `account-size.mjs`, `authority-check.mjs` (reads loader state, classifies wallet/Squads/immutable, decodes M-of-N, `--expect` to catch an authority hijack). | A piece: pre-deploy, for the program's own author, run by hand. No listener, no post-upgrade verification, no dependents. Its IDL-layout differ is worth copying. | `gh api repos/FannBe/solana-upgrade-guard` |
| UpgradeGuard (`VictorGSoutoXP`, 0 stars, created 2026-09-24, Colosseum/Superteam Brasil entry) | "Dependabot for Solana protocol changes": SIMD-0500 compatibility scan, migrate, LiteSVM test-diff, census, `verify-deploy` ("checks whether the deployed binary is the evidence candidate and whether the upgrade authority published the verified build"). | A piece: toolchain-compatibility, for the author, one program at a time; `verify-deploy` overlaps our verifier unit. Not a live feed to dependents. | `gh api repos/VictorGSoutoXP/UpgradeGuard/readme` |

A product that listens to every loader `Upgrade` on mainnet, verifies, diffs and pushes to third-party dependents: **none found 2026-09-26** by following links from the above.

### A5. Incidents (fetched 2026-09-25)

| Case | What the page says | Upgrade vector? | Source |
|---|---|---|---|
| Raydium, 2022-12-16, $4.4M | "a trojan attack and compromised private key for the pool owner account"; `withdraw_pnl` drained fees; response: "authority has been halted on AMM & farm programs". Upgrade authority not mentioned. | Admin key, not a program upgrade. | https://rekt.news/raydium-rekt |
| Drift, 2026-04-01, $285.26M | Attacker gained Drift's State account via "a 2-of-5 multisig with zero timelock"; four durable nonces created 2026-03-23; a Security Council migration lowered threshold 3-of-5 → 2-of-5; malicious collateral market, withdrawal caps raised, 18 vaults drained in 128 seconds. | Admin/multisig takeover with zero timelock, not bytecode. The nonce-staging and threshold-lowering are exactly the pre-signals Sec3's free monitor now watches. | https://rekt.news/drift-protocol-rekt |
| Loopscale, 2025-04-26, $5.8M | Stale/malicious price feed on RateX collateral; attacker "reverse-engineered it from the binary". | No. | https://rekt.news/loopscale-rekt |
| Mango 2022-10 ($115M), Wormhole 2022-02 ($326M), Cashio, Crema, Nirvana, Audius (governance) | Oracle manipulation / signature-verification bug / mint bug / flash loan / governance. | No. | https://rekt.news/leaderboard; https://rekt.news/mango-markets-rekt |
| Cypher | Not on rekt (`/cypher-rekt` 404). | — | |
| Security advisories | `solana-labs/security-advisories` 404; `solana-labs/solana` and `anza-xyz/agave` advisory pages: "There aren't any published security advisories". | — | GitHub |

Honest reading: no rekt-leaderboard Solana entry names a malicious *program upgrade* as the vector. The named vectors are compromised admin keys and zero-timelock multisigs. The pitch must be "authority/upgrade change is the last observable step before the drain, and nobody tells the dependents", not "upgrades caused these losses".

### A6. Scale (fetched 2026-09-25)

| Fact | Source |
|---|---|
| Verified programs in the OtterSec registry: 540. | https://verify.osec.io/verified-programs |
| Upgradeable loader-v3 programs on mainnet with sBPF ≤ v2: "20,606 … from 13 thousand upgrade authorities" (UpgradeGuard census 2026-09-24); "SIMD-0500 cited about 17 thousand." Total upgradeable programs (all sBPF versions) and immutable count: **not found**. | https://github.com/VictorGSoutoXP/UpgradeGuard (README, secondary source) |
| Loader transaction rate ~16,000/h, >98% `write`. Upgrades per day: **not measured**. | A3 |
| Solana Compass: has `/analytics/programs/[id]` (fees, volume); no upgrade statistics; `/programs` is 404. Dune: JS, not fetched. | https://solanacompass.com/ |

---

## Part B. The sketch

### B1. Architecture: units and boundaries

| Unit | Boundary | Must-have | Notes |
|---|---|---|---|
| **Listener** | Subscribes to loader-v3 instructions with discriminant 3 `Upgrade`, 4/7 `SetAuthority[Checked]`, 5 `Close`, 6 `ExtendProgram`; ignores 1 `Write`. Emits `{program, programdata, slot, authority, signature}`. | Yes | Free path: Helius webhook (raw) on `accountAddresses:[loader]`, filter client-side; that means ~16k events/h ≈ 384k credits/day, above the Free 1M/month. Paid path: Parsed Streams `instructionNames:["upgrade",...]` if the loader is in the catalog (unverified) or Developer-plan `transactionSubscribe` with `accountRequired`. Last resort: poll `getSignaturesForAddress` on the loader every 10 s from a public RPC and parse only txs with 7 accounts. |
| **Fetcher** | On event: `getAccountInfo(programdata)` → new ELF bytes, `slot`, `upgrade_authority`; keeps previous ELF from its own store (first sighting: fetch and record, no diff). | Yes | Store: Postgres + object storage for ELFs. |
| **Verifier** | SHA-256 of ELF (solana-verify's format); reads the otter-verify PDA `[b"otter_verify", authority, program]` for `git_url`, `commit`, `deploy_slot`; calls `verify.osec.io/status/<id>`. State: `verified` / `unverified after upgrade` / `never verified`. Re-checks at +1h and +24h because OtterSec re-verifies daily. | Yes | We never build in Docker in this window; we trust OtterSec's hash. |
| **Differ** | (a) both old and new commits known → `git diff` of the two commits, rendered; (b) Anchor IDL account (`create_with_seed(pda, "anchor:idl", program)`) old vs new → instruction-set and account-layout diff (copy `layout-diff.mjs` logic); (c) always: size delta, bytecode hash, sBPF version from ELF `e_flags`, section sizes. | (b),(c) yes; (a) if time | For unverified programs (c) is all there is; the score says so. |
| **Scorer** | Flags: authority changed; became immutable; verified→unverified; new instructions; layout-breaking IDL change; size delta > x%; upgrade executed with no preceding Squads proposal older than the vault's timelock (needs the multisig's `time_lock` read from its config account). Output 0–100 plus reasons. | Yes | Squads decoding is scoped to v4; v3/v5 later. |
| **Publisher** | Public feed page (`/feed`, `/program/<id>`); per-program webhook + Telegram; SAS attestation per upgrade (`schema: program, slot, sha256, verified, score`) so any wallet reads "upgrade #N of P verified=yes/no" with no API key; x402 (`@x402/svm`) for the paid firehose. | Feed, Telegram yes; SAS yes (TypeScript client exists); x402 if time | SAS program ID and mainnet status were **not confirmed** from fetched pages (docs are JS); ASSUMPTION it is live. |

### B2. Demo path (mainnet, 5–7 screens)

1. **Feed**: live list of upgrades caught in the last 24 h, each with verified badge, score, authority, size delta. The counter at the top says "N upgrades since midnight" — a number no explorer shows.
2. **One upgrade, verified**: pick a verified program that upgraded (marginfi-class); show source diff between the two commits and the PDA fields that prove it.
3. **One upgrade, unverified**: bytecode hash, size delta, IDL diff or "no IDL"; the score explains why it is red.
4. **Authority change**: a `SetAuthority` event; before/after, on-curve wallet vs Squads vault.
5. **Subscribe**: paste a program ID, get a Telegram message within a minute of the next event.
6. **Attestation**: open the SAS attestation for the upgrade in an explorer; read it with a curl and no key.
7. **Firehose**: an x402 402→200 call to `/v1/upgrades` (cut if late).

Guaranteeing a live catch: the loader firehose is ~16k tx/h but true `Upgrade`s are rarer and unmeasured. Plan: (i) run the listener from day 1 and show the 24-hour backlog, so the feed is never empty; (ii) during the demo window, watch for any mainnet upgrade; (iii) as the last resort, upgrade my own mainnet program (a trivial Anchor program deployed once, ~1.5 SOL rent at 100 KB, ASSUMPTION), with a verified-build PDA on the first version and no re-verification on the second, so screens 2 and 3 both come from a real chain event I control. Devnet is the fallback below that.

### B3. Riskiest unknown

**Coverage.** 540 verified programs against 20k+ upgradeable ones means the verified-source diff (the impressive screen) applies to under 3% of programs; for the rest the differ is IDL-or-bytes and the honest output is "changed, unverified, here's what we can see". Second: stream cost. Free-plan webhooks on the loader address burn credits on `write` chunks; the safe course is the Developer plan ($49) for `transactionSubscribe` or a polling listener. Third: whether the SAS program is live on mainnet, not confirmed from fetched pages.

### B4. Estimate (solo, Next.js/TS, 17 days to 2026-10-12)

| Work | Days | Must / cut |
|---|---|---|
| Listener (poll + Helius), fetcher, ELF store | 2 | Must |
| Verifier (PDA read, osec status, hash) | 1 | Must |
| Differ: size/hash/sBPF + Anchor IDL diff | 2 | Must |
| Differ: git source diff view | 1.5 | Cut first |
| Scorer incl. Squads v4 timelock read | 2 | Must (timelock cut if late) |
| Feed + program pages (surface) | 3 | Must |
| Telegram + webhook subscriptions | 1 | Must |
| SAS attestation writer | 1 | Must |
| x402 firehose | 1 | Cut |
| Own mainnet program + verified PDA (demo insurance) | 0.5 | Must |
| Demo, video, submission | 2 | Must |
| **Total** | **17** (14.5 without cuts) | |

Tight but inside the window if the git-diff view and x402 are the first cuts.

### B5. Reused machinery

None. Solana Microscope, `layout-diff.mjs` (FannBe) and UpgradeGuard's `verify-deploy` are reference reading, not code we import.

### B6. Company case

Who pays: wallets and transaction-simulation vendors (Blowfish is gone; Phantom's help pages describe only simulation and blocklists), so a "this program changed 40 minutes ago and is no longer verified" signal is a gap in their warning set; protocols with CPI dependencies and risk desks/insurers who need a written record of what changed under them. Price anchors from fetched pages: Helius sells data at $49/$499/$999 a month; QuickNode gates gRPC behind its Scale plan; Sec3 shows no prices; Blowfish's wallet deal terms were not found. ASSUMPTION: $199–$999/month per integrator for the firehose and per-program webhooks, free public feed, x402 per-call for agents. Retention comes from the archive (every ELF, every diff, every attestation, from the day we start) which nobody else keeps. It becomes the change log of Solana programs: the place an integrator, an auditor or an insurer goes to answer "what did this program look like on the day of the incident".

### B7. Why Solana, and the demand line

**Why Solana (honest):** because on Solana the upgrade is a single on-chain instruction on one loader with a public `slot` and authority in ProgramData, the verified-build registry is public and keyed by program ID with a PDA on-chain, and the loader firehose is available from a free RPC, so the whole pipeline can be built by one person without validator access. The same product on EVM needs proxy-pattern heuristics per contract.

**Demand line:** D0, "no named ask found 2026-09-26". What exists is adjacent: Solana Foundation shipped Microscope on 2026-09-15 (governance monitoring, self-hosted, one program per deploy), QuickNode wrote it up on 2026-09-22 with the line "If you depend on someone else's program, the same tool points outward", Sec3 launched free multisig/nonce monitoring after Drift, and three hackathon-scale repos (UpgradeGuard, solana-upgrade-guard, the TommoHCIO skill) attack pre-deploy safety. Nobody fetched asked for a cross-program, verified-and-diffed upgrade feed for dependents; the Foundation's own tooling stops one step short of it.

## Addendum 2026-09-26: verified-build status of 15 major programs (verify.osec.io/status/<id>, queried 2026-09-26)
verified=True (3): Kamino Lend, marginfi v2, Phoenix.
verified=False WITH a repo on file (7): Raydium AMM v4, Raydium CLMM, Orca Whirlpool, Drift v2, Marinade, Squads v4 (+ commit pinned for CLMM, Drift, Squads). The registry says "The API detects your upgrade and unverifies your program" and re-checks every 24 h, so these were submitted for verification and the deployed code no longer matches (cause per program NOT verified: upgrade after verification vs. failed re-check).
No record (5): Jupiter v6, Meteora DLMM, Jito stake pool, Pump.fun, Openbook v2, Sanctum router (6 listed; Sanctum included).
Reading: the <3 % figure is the long tail; among the programs users actually sign against, 3 of 15 are verified now and 7 more were verified at some point and have since drifted. Detection of upgrades covers all 15 regardless.
