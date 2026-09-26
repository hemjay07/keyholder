# concerns.md — Keyholder Project-Specific Risks

Severity tags: [C] Critical, [I] Important, [A] Advisory.  
Derived from WINNER-BRIEF.md Thesis §5 (Invariants) and risk register.

---

## Thesis Invariants (Identity Lock)

These five invariants flow through every document phase (PRD, Architecture, Plan):

[C] **Real events only; no fabricated state**
  - Keyholder is a *record* product. Judges will test: "Show me the data."
  - Any invented numbers, mock events, or seed data labeled as real breaks the product's core claim.
  - **PRD address:** §7.5 and §7.6 specify seed-demo.ts produces state from mainnet archive, not injected rows.
  - **Implementation:** Ingest only from Triton/RPC; risk engine only from real events; alerts only from real subscriptions.

[C] **Every figure carries its source slot or transaction**
  - No "approximately 150 protocols" or "roughly 47 events."
  - Every displayed number must cite its source: slot, block time, tx signature, query result.
  - **PRD address:** §2 Data Flow ("checksummed"), §3 Flow 1 (counter "47 upgrades since midnight UTC"), §6 Scene 2 (alert displays timestamp + tx signature), §7.5 ("measured, not guessed").
  - **Implementation:** Every event UID = `signature:ix_path`; every score delta links to rule version + event IDs.

[C] **Reconstructed history labelled**
  - Drift replay is reconstructed from on-chain transactions (not simulated, not mocked).
  - **Every frame in the replay must cite its source transaction.**
  - **PRD address:** §3 Flow 2 ("Every frame links to on-chain transaction"), §6 Scene 4–5 ("Every frame cites its transaction; rebuilt state is labelled 'reconstructed'").
  - **Implementation:** Replay engine outputs `{ slot, tx_sig, reconstructed_at_slot, hours_before_incident }`; UI shows "Reconstructed from on-chain transaction {sig}" on every frame.

[C] **Our own program under a timelocked multisig**
  - ControlGuard is deployed with upgrade authority = Squads 2-of-3, 48-hour timelock (founder hot, founder cold, TBD).
  - We eat our own cooking: if we ship a program other protocols depend on, we prove we trust this infrastructure by locking down our own upgrade path.
  - **PRD address:** §2 Architecture (Component P on Anchor mainnet, "upgrade authority = Squads vault"), §4 Component P (Squads 2-of-3, 48h lock), §8 Day 11 task ("Deploy ControlGuard with upgrade authority = the Squads vault").
  - **Implementation:** Deployment command outputs multisig address + timelock seconds; proof page links to explorer showing Squads vault ownership.

[C] **Drift demo: live devnet flip as the proof**
  - The 9-day early alert is reconstructed (honest, but indirect).
  - **The proof is live: founder lowers threshold on devnet, `check()` flips from PASS to FAIL in real time.**
  - **PRD address:** §3 Flow 2 (split-screen: devnet demo), §6 Scene 6 (founder on camera performs threshold drop, vault refuses).
  - **Implementation:** Demo script records devnet tx; check() call shown in real time (no editing, no simulation tricks).

---

## Risk-Derived Concerns

[C] **Triton stream must be live by day 4 EOD**
  - If PAYG onboarding fails (>24h delay), backup: Helius Developer $49/mo.
  - **PRD address:** §8 Day 1–3 (onboarding task, Day 2 fallback), §9 Dependencies (Triton + Helius), Risk Register #2.
  - **Mitigation:** Apply day 1 EOD; verify $125 deposit same day; measure latency day 3; public-RPC poller runs in parallel as cross-check.

[C] **Squads v4 layout (offset 94 trap) must parse correctly**
  - One byte-reading bug in rent_collector Option deserialization breaks threshold/timelock reads.
  - **PRD address:** §4 Component 3 (State Builder constraints), Risk Register #3.
  - **Mitigation:** Write byte-by-byte parser day 1; golden test on 3 real multisigs (Drift, Squads, Kamino) before day 2; Anchor's generated code not trusted.

[C] **Drift archive must be complete (March–April 2026)**
  - If Triton/Helius pruned history, replay cannot reconstruct all events; demo breaks.
  - **PRD address:** §8 Day 2 (validate archive completeness), Risk Register #1.
  - **Mitigation:** Check sig list gaps; if >10 missing, use second provider (Old Faithful, etc.) or backfill from alternative. Worst case: show replay as "partial reconstruction, gap on [date]" + live devnet flip (real proof).

[C] **First Anchor program: no UncheckedAccount owner bugs**
  - `check()` instruction must validate every account's owner before reading.
  - **PRD address:** §4 Component P (check logic, "/// CHECK: owner == ..."), Risk Register #8.
  - **Mitigation:** CI grep for `UncheckedAccount` + inline `/// CHECK:` comment; Superteam NG code review day 10; LiteSVM tests on real Drift + Kamino + marginfi bytes.

[I] **Risk scoring must be deterministic**
  - Any rule change must not re-score old events (preserve audit trail).
  - **PRD address:** §4 Component 4 (Rules) ("Scores versioned; old events keep old scores").
  - **Mitigation:** Every risk_delta stores `rule_version`; replay engine property-tests determinism (day 5–6).

[I] **Alert false positives must be ≤1% in first 7 days**
  - If alerts fire on every proposal or nonce, X followers see noise; product credibility drops.
  - **PRD address:** §8 Day 6 (alert severity floors: proposals info-only, nonces medium only if ≥2 signers in 14d), Risk Register #6.
  - **Mitigation:** Implement rule thresholds day 6; measure false-positive rate daily; adjust severity buckets.

[I] **ControlGuard must verify on OtterSec within 24h of deploy**
  - If verification stalls past day 12, proof page shows "Verification pending" (still acceptable, but delays credibility).
  - **PRD address:** §8 Day 12 (submit to OtterSec), §7.6 Proof Artifacts (verified build badge).
  - **Mitigation:** Pre-stage build on day 10; submit day 11 evening; follow up day 12 morning.

[I] **Solo bandwidth: critical path must complete by day 7 EOD**
  - Ingest → decode → state → risk → replay complete by day 7 or demo centerpiece fails.
  - **PRD address:** §8 Day 7 exit check (Drift replay golden test), Risk Register #10.
  - **Mitigation:** Depth-first (no UI polish until day 4); agents per service; defer positions, X, email, SPL Gov if time tight.

[A] **SAS mirror is optional (day 14 stretch goal)**
  - If SAS onboarding fails or program ID wrong, own ControlState PDAs are source of truth for `check`.
  - **PRD address:** §4 Component 7 (Attestation Writer) ("SAS is optional; own PDAs are source of truth"), Risk Register #9.
  - **Mitigation:** Verify SAS program ID day 1; if unavailable, skip SAS writes; proof page notes "on-chain state via ControlState PDAs, SAS mirror pending."

[A] **X bot is demo-only if time tight**
  - If x402 costs spike or rate limits hit, pre-generate sample posts; ship X bot with manual posting option.
  - **PRD address:** §8 Day 14 (X strategy) ("if time tight, pre-generate sample posts").
  - **Mitigation:** X bot deployed live day 12; if API fails day 14, use pre-generated tweets with founder's personal account.

[A] **Position resolver is depth-only (fallback to demo wallet list)**
  - If getProgramAccounts is too slow, use hardcoded test wallets in demo instead of auto-resolution.
  - **PRD address:** §8 (Day 13 fallback).
  - **Mitigation:** Profile on day 9; if >5s for 10 wallets, defer to post-launch.

---

## Proof Points

By end of Phase 1 (PRD), ensure every concern has a specific counter-measure in this document (done above).  
By end of Phase 2 (Architecture), every [C] concern must have a code-level solution visible in component specs.  
By end of Phase 3 (Plan), every [C] concern must have a verification step in a phase gate (§8 Day N exit checks).

---

**Last Updated:** 2026-09-26  
**Derived From:** WINNER-BRIEF.md Thesis §5 + PRD Risk Register + PLAN.md §6
