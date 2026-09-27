// /events/[uid]: one control change. A risk-delta uid shows the alert with the
// control state before and after; a chain-event uid (signature:ix_path, the
// feed's rows) shows the decoded change with the protocol's control today.
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchEventDetail, fetchChainEvent, fetchProtocol } from "@/lib/api-client";
import { consoleDataFromFacts, controlLabel, timelockLabel } from "@/lib/console-data";
import ConsoleDevice from "@/components/console/ConsoleDevice";

export const dynamic = "force-dynamic";

const KIND_WORDS: Record<string, string> = {
  upgrade: "Program upgraded",
  set_authority: "Upgrade authority changed",
  config_transaction_execute: "Multisig settings changed",
};

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-6)}`;
}

function keyPhrase(f: Parameters<typeof controlLabel>[0]): string {
  const label = controlLabel(f);
  if (label === "immutable") return "gone: the program is immutable";
  if (label === "Realms governance") return "held by Realms governance";
  if (label === "unresolved") return "not resolved";
  const [t, m] = label.split(" / ");
  return `a ${t}-of-${m} multisig`;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function EventPage({ params }: { params: Promise<{ uid: string }> }) {
  const uid = decodeURIComponent((await params).uid);

  const alert = await fetchEventDetail(uid).catch(() => null);
  if (alert) {
    const protocol = await fetchProtocol(alert.protocolId).catch(() => null);
    return (
      <main>
        <Link className="back-link" href="/feed">&larr; Feed</Link>
        <section className="feed-head">
          <p className="kicker">Alert · {alert.severity}</p>
          <h1>{protocol?.name ?? alert.protocolId}: {alert.explanation}</h1>
          <p className="lede mono">{alert.createdAt?.slice(0, 16).replace("T", " ")} UTC · rule {alert.ruleId.replace(/_/g, " ")} · {alert.status}</p>
        </section>
        <section className="event-compare">
          <div><h2>Before</h2><p className="mono">{controlLabel(alert.stateBefore)} · timelock {timelockLabel(alert.stateBefore)}</p></div>
          <div><h2>After</h2><p className="mono">{controlLabel(alert.stateAfter)} · timelock {timelockLabel(alert.stateAfter)}</p></div>
        </section>
        <section className="citations-section">
          <h2>Transactions</h2>
          <ul>
            {alert.events.map((e) => (
              <li key={e.id}><a className="mono" href={`https://solscan.io/tx/${e.signature}`} target="_blank" rel="noreferrer">{short(e.signature)}</a> · {e.kind} · slot {e.slot.toLocaleString("en-US")}</li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  const ev = await fetchChainEvent(uid).catch(() => null);
  if (!ev) notFound();
  const protocol = ev.protocolId ? await fetchProtocol(ev.protocolId).catch(() => null) : null;
  const facts = protocol?.controlFacts ?? null;
  const what = KIND_WORDS[ev.kind] ?? ev.kind.replace(/_/g, " ");
  const name = protocol?.name ?? ev.protocolId ?? "Untracked program";
  const weak = facts?.timelock?.kind === "none" || facts?.timelock?.kind === "no_timelock_feature";
  const device = facts
    ? consoleDataFromFacts({ name, rowLabel: `${what.toLowerCase()} · ${ev.blockTime.slice(0, 10)}`, facts, weakened: weak, readDate: new Date().toISOString().slice(0, 10) })
    : null;
  const p = ev.payload ?? {};
  const authority = typeof p.upgradeAuthority === "string" ? p.upgradeAuthority : typeof p.currentAuthority === "string" ? p.currentAuthority : null;
  const newAuthority = "newAuthority" in p ? (p.newAuthority as string | null) : undefined;

  return (
    <main>
      <Link className="back-link" href="/feed">&larr; Feed</Link>
      <section className="protocol-hero">
        <div className="hero-copy">
          <p className="kicker">Control change</p>
          <h1>{name}: {what.toLowerCase()} on {day(ev.blockTime)}.</h1>
          <p className="lede">
            {authority ? <>Authorised by <span className="mono">{short(authority)}</span>. </> : null}
            {newAuthority === null ? "The upgrade key was removed: the program is now immutable. " : newAuthority ? <>The upgrade key moved to <span className="mono">{short(newAuthority)}</span>. </> : null}
            {facts && (weak
              ? <>Today {name}&apos;s upgrade key is {keyPhrase(facts)} with {timelockLabel(facts) === "none" ? "no timelock" : "no timelock feature"}: the next change can land the moment enough keys sign.</>
              : <>Today {name}&apos;s upgrade key is {keyPhrase(facts)} with a {timelockLabel(facts)} timelock.</>)}
          </p>
          <div className="protocol-meta mono">
            <span>{ev.blockTime.slice(11, 19)} UTC</span>
            <span>slot {ev.slot.toLocaleString("en-US")}</span>
          </div>
          <p className="lede">
            <span className="ev-line">Transaction: <a className="mono" href={`https://solscan.io/tx/${ev.signature}`} target="_blank" rel="noreferrer" title={ev.signature}>{short(ev.signature)}</a></span>
            {protocol && <span className="ev-line"><Link href={`/protocols/${protocol.id}`}>Every change to {protocol.name} &rarr;</Link></span>}
          </p>
        </div>
        {device && (
          <div className="device-frame">
            <ConsoleDevice data={device} />
          </div>
        )}
      </section>
      <section className="citations-section">
        <h2>Decoded from chain</h2>
        <ul className="mono event-payload">
          <li>kind: {ev.kind} (instruction {ev.ixPath})</li>
          {Object.entries(p).map(([k, v]) => <li key={k}>{k}: {v === null ? "none" : String(v)}</li>)}
        </ul>
      </section>
    </main>
  );
}
