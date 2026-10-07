# Revamp 3 brainstorm: what Keyholder should give out (2026-10-07)

Inputs: five brainstormers (pragmatist, radical, analogist, user advocate, contrarian), one web market scan (URLs in section 6).
Live X (Grok) read NOT done: the Chrome extension hit its usage limit; rerun after it resets.

## 1. What the research changed
- **The Solana Foundation set the bar after Drift.** STRIDE (April 2026) reviews "Upgradeability & Governance" (admin keys, timelocks) for $10M+ protocols, but as audits; it does not publish a continuous dataset. Keyholder can be **the public, continuous version of that pillar** for every program, not a competitor to it.
- **Nobody publishes program-level control across hundreds of Solana programs with history.** Range monitors transactions for customers; Squads manages keys; CertiK, Rugcheck and SolSniffer score tokens; Credora, Exponential and Gauntlet rate risk without upgrade-authority data. The gap is real.
- **Key compromise was 44% of value stolen in Q2 2026** (DeFiLlama newsletter). The problem is the biggest category of loss, not a niche.
- **The contrarian's attacks are right and shape the design:**
  1. An opinion grade invites liability and gaming. Publish *facts and a stage defined by public rules*, not a judgment.
  2. A grade written on chain hours later is stale when it matters. On-chain enforcement must read **live** control (the check program already reads the multisig directly), with the stage only as a label.
  3. Protocols will game a metric. The history (daily anchored log) and change alerts make gaming visible: a signer rotation before a review is itself an event.

## 2. Top 3 directions

### A. Solana Control Stages (L2BEAT for Solana): the public standard
- **What:** every program gets a **Stage 0–3** from published, mechanical rules over chain facts: Stage 0 = one key can upgrade or drain; Stage 1 = multisig, no timelock; Stage 2 = multisig with a timelock of 24 h or more and no single-key admin field; Stage 3 = immutable, or upgrades only through an on-chain delay users can exit within. Each stage shows the facts and the transaction that proves each fact, plus the program's history since 2026-10-02 (anchored).
- **Why it works:** L2BEAT's Stages became the adoption gate for Ethereum rollups because teams compete to graduate and users read one label. Rules-not-opinion answers the liability attack. It maps exactly onto the Foundation's STRIDE pillar.
- **Who uses it:** users and wallets (a label), protocols (a goal to reach and a badge to link), funds and exchanges (a filter), judges (instantly legible).
- **Built on:** coverage (557 programs), admin keys, dollars, daily log. New: the stage rules, per-program pages, the history view.
- **Cons:** needs the admin-key read for more programs to award Stage 2 honestly; stage 3 is rare on Solana today (that is the point).

### B. Live enforcement: `require_stage` for any program
- **What:** the on-chain check becomes a one-line guard: `require_stage(target_program, min_stage, min_timelock)`. It reads the target's **live** upgrade authority and multisig on chain (no stale oracle), and refuses within the same transaction. Vaults, lending markets and routers gate money on control.
- **Why it works:** turns the standard into infrastructure others depend on (Certificate Transparency became law when browsers enforced it). Already half-built (devnet check reads Squads v3/v4 and coral).
- **Who uses it:** vault curators, lending markets listing collateral, aggregators routing through programs.
- **Cons:** devnet only; reading admin-config keys on chain needs per-program layouts.

### C. Signer intelligence: the dark matter
- **What:** a page and feed per **signer key**: every multisig it sits in, every program those control, $ behind it, how often it signs. Contagion alerts: "these programs share 2 of 3 signers with one that just changed." Kamino's 10 signers controlling the 5-of-10 main program and two 1-of-10 side programs is the example.
- **Why it works:** nobody maps signers across protocols; it is where compromises actually happen (Drift, Step, Raydium were key compromises). Facts only, no opinion.
- **Who uses it:** security teams (SEAL, SIRN), exchanges, funds, insurers.
- **Cons:** signers are pseudonymous; naming them is out of scope (and should stay so).

## 3. Combinations
- **A + B:** the stage is the language, the guard enforces it; protocols reach a stage so vaults will route money to them.
- **A + anchored log:** a stage with a provable past ("Stage 2 every day since Oct 2, here are the anchors") is what makes gaming visible and is the moat that grows daily.
- **C + feed:** signer events (a key added to or removed from any multisig) across 557 programs is the alert nobody else can send.
- **KeyBench as the stage's back-test:** what stage was each incident's program in the day before the loss (Drift: Stage 1 after its timelock went to zero; Raydium: Stage 1 upgrade but a Stage 0 compiled admin key).

## 4. Hidden gem
**Proof of Control, claimed by the protocol and checked by the chain.** A protocol publishes a signed statement of its intended control ("3 of 5, 48 h timelock, these programs"). Keyholder checks it against the chain every day and alerts the moment reality and claim diverge. The protocol becomes the customer (it wants the badge), the claim is theirs (no liability for Keyholder's opinion), and divergence is the strongest possible signal: Drift's March 2026 timelock removal would have been a broken promise on day one.

## 5. Wild cards
- **Control-change insurance / prediction markets**, priced and settled by the anchored log (blocked by liquidity and regulation; a later business, not a hackathon).
- **Timelock-as-a-service**: programs route admin actions through a Keyholder delay with a public veto window (blocked by adoption friction and Keyholder becoming a single point of failure).
- **Control bonds**: protocols stake against unannounced control changes; slashed by the log (blocked by game theory and capital).

## 6. Full idea bank
Pragmatist: daily control digest (Discord/RSS); embeddable grade badge; signer overlap report; incident replay API; control-change webhooks; on-chain attestation of passing control; validator/signer health cross-check; compromise predictor score; self-hostable Keyholder; governance early warning.
Radical: custody futures on control changes; signer reputation credit score; parametric custody insurance; staking bonds slashed on unannounced changes; timelock-as-a-service; custody index derivatives; bounties for compromised keys; custody-weighted standards council.
Analogist: L2BEAT stages; Carfax lineage; Lloyd's pricing; certificate transparency enforcement; Have I Been Pwned for signers; Bloomberg-style API; building codes as gates; D&B trust score; nutrition-label control card; Safe Browsing threat feed.
User advocate: custodians (compliance exports), insurers (real-time change feed), launchpads (pre-listing vetting), retail (one label + alerts), protocol founders (badge), exchanges (listing filter), DAO treasuries (exposure), bridges, security researchers (API), compliance teams.
Contrarian: rate signers not programs; facts-only incident database; market-priced control risk; timelock escrow program; private attack simulator for protocols; contagion alerts; control-incident insurance.

Sources (market scan): Solana Foundation security overhaul and STRIDE https://www.coindesk.com/tech/2026/04/07/solana-foundation-unveils-security-overhaul-days-after-usd270-million-drift-exploit · https://solana.com/news/solana-ecosystem-security · Range https://range.org/blog/solana-chooses-range-to-provide-ecosystem-wide-real-time-security-and-forensics · DeFiLlama Q2 2026 https://newsletter.defillama.com/p/99-exploits-the-most-hacked-quarter-in-defi-history · Credora/RedStone https://www.redstone.finance/blog/redstone-brings-credora-to-market-following-acquisition-introducing-defi-risk-ratings-to-morpho-and-spark/ · Drift analyses https://research.4pillars.io/en/research/reflections-on-the-drift-protocol-exploit
(These were opened by the research agent; I have not re-read each page. Verify any figure before it goes in public copy.)
