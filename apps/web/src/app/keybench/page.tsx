// /keybench: past Solana losses that came through a control key, replayed from chain,
// with the warning Keyholder's rules would have given before the first loss.
// Data: src/data/keybench.json, written by apps/worker/src/keybench/score.ts from data/keybench/*.json.
import type { Metadata } from "next";
import data from "@/data/keybench.json";
import dollars from "@/data/dollars.json";

export const metadata: Metadata = {
  title: "KeyBench",
  description: "Solana losses through control keys, replayed from chain: how early Keyholder would have warned.",
};

interface Alert { ruleId: string; severity: string; at: string; slot: number; sig: string }
interface Score { firstAlert: Alert | null; leadTimeSeconds: number | null; posture: string[] }
interface Result { id: string; name: string; class: string; firstLoss: { time: string; sig: string; slot: number }; shipped: Score; current: Score; note: string }

const RESULTS = data.results as Result[];
const ADDED = new Set(data.addedAfterKeyBench);
const MAX_DAYS = 9;

const CLASS_LABEL: Record<string, string> = {
  admin_key: "Admin key in the program",
  governance_upgrade: "Governance → program upgrade",
  governance_treasury: "Governance → treasury transfer",
  multisig_admin: "Multisig → admin takeover",
  admin_grant_flaw: "Program flaw → self-granted admin",
};

function days(s: number | null): string {
  if (s == null) return "No warning";
  const d = s / 86400;
  return d >= 1 ? `${d.toFixed(1)} days` : `${Math.round(s / 3600)} hours`;
}

/** Incident files use "YYYY-MM-DD HH:MM:SS"; the Drift replay uses ISO. Show both the same way. */
const utc = (t: string) => t.replace("T", " ").replace(/Z$/, "").slice(0, 19);
const usd = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${Math.round(n / 1e6)}M` : `$${Math.round(n / 1e3)}k`);
const short = (sig: string) => `${sig.slice(0, 8)}…${sig.slice(-6)}`;
const tx = (sig: string) => `https://solscan.io/tx/${sig}`;

function Lead({ score, label }: { score: Score; label: string }) {
  const d = score.leadTimeSeconds == null ? 0 : Math.min(score.leadTimeSeconds / 86400, MAX_DAYS);
  return (
    <div className={`kb-lead${score.leadTimeSeconds == null ? " none" : ""}`}>
      <span className="kb-lead-label mono">{label}</span>
      <span className="kb-bar" aria-hidden="true"><span style={{ width: `${(d / MAX_DAYS) * 100}%` }} /></span>
      <span className="kb-lead-value">{days(score.leadTimeSeconds)}</span>
      {score.firstAlert && (
        <span className="kb-lead-rule mono">
          {score.firstAlert.ruleId}
          {ADDED.has(score.firstAlert.ruleId) ? " · added after this study" : ""} · from{" "}
          <a href={tx(score.firstAlert.sig)}>{short(score.firstAlert.sig)}</a>
        </span>
      )}
    </div>
  );
}

export default function KeyBenchPage() {
  const shippedHits = RESULTS.filter((r) => r.shipped.leadTimeSeconds != null).length;
  const currentHits = RESULTS.filter((r) => r.current.leadTimeSeconds != null).length;
  return (
    <main className="kb-page">
      <section className="feed-head">
        <p className="kicker">KeyBench</p>
        <h1>Would Keyholder have warned before the money moved?</h1>
        <p className="lede">
          Every row is a real Solana loss that came through a control key, replayed from the chain itself. The bar is the time from Keyholder&apos;s
          first alert to the first loss. Misses stay on the page.
        </p>
        <p className="kb-tally mono">
          {RESULTS.length} incidents · rules shipped before this study warned on {shippedHits} · with the rule added after it, {currentHits}
        </p>
      </section>
      <section className="kb-dollars" aria-labelledby="kb-dollars-h">
        <h2 id="kb-dollars-h">Today: {usd(dollars.by_class.multisig_no_timelock)} can move with no delay</h2>
        <p className="kb-note">
          Of {usd(dollars.total)} traced to the vaults of Solana&apos;s largest programs, {usd(dollars.by_class.multisig_no_timelock)} sits behind
          multisigs that can upgrade the program with no timelock, {usd(dollars.by_class.multisig_timelock)} behind multisigs with one, and{" "}
          {usd(dollars.by_class.one_signer)} behind a single key. Counted vault by vault from chain, liquid tokens only, so these are floors.
        </p>
        <ul className="kb-dollar-list mono">
          {dollars.no_timelock_top.map((p) => (
            <li key={p.programId}>
              <a href={`https://solscan.io/account/${p.programId}`}>{p.programId.slice(0, 8)}…</a> · {p.threshold} of {p.members}, no timelock · {usd(p.usd_floor)}
            </li>
          ))}
        </ul>
        <p className="kb-loss mono">Priced {dollars.priced_at} UTC · source: data/coverage/dollars-by-class-2026-10-04.json</p>
      </section>
      <ol className="kb-list">
        {RESULTS.map((r) => (
          <li key={r.id} className="kb-row">
            <div className="kb-head">
              <h2>{r.name}</h2>
              <p className="kb-class mono">{CLASS_LABEL[r.class] ?? r.class}</p>
            </div>
            <Lead score={r.shipped} label="Shipped rules" />
            {r.current.leadTimeSeconds !== r.shipped.leadTimeSeconds && <Lead score={r.current} label="With the new rule" />}
            <p className="kb-note">{r.note}</p>
            <p className="kb-loss mono">
              First loss {utc(r.firstLoss.time)} UTC · slot {r.firstLoss.slot.toLocaleString("en-US")} · <a href={tx(r.firstLoss.sig)}>{short(r.firstLoss.sig)}</a>
            </p>
          </li>
        ))}
      </ol>
      <section className="kb-method">
        <h2>How this is scored</h2>
        <p>
          Each incident&apos;s accounts and transactions are read from mainnet. The events Keyholder can decode go through the same risk engine the
          live service runs. &ldquo;Shipped rules&rdquo; are the rules that existed before this study. A rule written after looking at these incidents is
          scored separately and labelled, because it was fitted to them. It only counts once it warns on an incident it has not seen.
        </p>
        <p className="mono kb-gen">Generated {data.generated.slice(0, 10)} · source: data/keybench in the Keyholder repo</p>
      </section>
    </main>
  );
}
