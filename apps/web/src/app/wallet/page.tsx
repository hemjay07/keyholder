// /wallet: paste a wallet, see who holds the keys to every protocol its money
// is in. Positions come from the live resolver (/api/v1/positions/[wallet]);
// control facts from the same record as the home page.
import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { PublicKey } from "@solana/web3.js";
import { fetchProtocols } from "@/lib/api-client";
import { consoleDataFromFacts, timelockLabel } from "@/lib/console-data";
import ConsoleDevice from "@/components/console/ConsoleDevice";
import type { ConsoleData } from "@/components/console/Console";

export const dynamic = "force-dynamic";

// The position resolver names protocols its own way; map to the record's ids.
const POSITION_TO_PROTOCOL: Record<string, string> = {
  "kamino-lend": "kamino-lend",
  marginfi: "marginfi-v2",
  "drift-v2": "drift",
  "raydium-clmm": "raydium-clmm",
  "orca-whirlpool": "orca-whirlpool",
};

// A public mainnet wallet with open positions in Kamino, marginfi and Drift
// (from the resolver's own fixtures, read on chain 2026-09-26).
const EXAMPLE_WALLET = "HHVQnKkXSq3xKYviLpig8Rg4pLQ2J9QFsHNfggHNohuF";

// Before an address is pasted: the real console with every reading blank.
const WAITING_CONSOLE: ConsoleData = {
  protocol: "YOUR WALLET",
  threshold: 0,
  members: 5,
  timelockSeconds: 0,
  verified: false,
  codeDrifted: false,
  weakened: false,
  slot: null,
  label: "paste an address to count the keys",
  waiting: true,
};

interface Position { protocolId: string; kind: string }
type PositionsResult = { ok: true; positions: Position[] } | { ok: false; reason: "invalid" | "rate_limited" | "error" };

async function readPositions(wallet: string): Promise<PositionsResult> {
  try {
    new PublicKey(wallet);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const res = await fetch(`${origin}/api/v1/positions/${wallet}`, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as { data: Position[] | null; error: { code: string } | null } | null;
  if (!res.ok || !body?.data) {
    const code = body?.error?.code;
    return { ok: false, reason: code === "INVALID_WALLET" ? "invalid" : code === "RPC_RATE_LIMITED" || code === "RATE_LIMITED" ? "rate_limited" : "error" };
  }
  return { ok: true, positions: body.data };
}

function isWeak(kind: string | undefined): boolean {
  return kind === "none" || kind === "no_timelock_feature";
}

// The page paints its headline and form at once; the chain read streams in
// behind it (a cold read under the free RPC's rate limit took 14 s).
export default async function WalletPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const wallet = w?.trim() ?? "";
  return (
    <main className="wallet-page">
      <Link className="back-link" href="/">&larr; Keyholder</Link>
      <section className={wallet ? "wallet-head" : "hero wallet-idle"}>
        <div className={wallet ? undefined : "hero-copy"}>
        <p className="kicker">Keyholder · Your wallet</p>
        <h1>Who can move your money?</h1>
        <form className="wallet-form" action="/wallet" method="get">
          <label htmlFor="w" className="mono">Solana wallet address</label>
          <div className="wallet-input-row">
            <input id="w" name="w" defaultValue={wallet} placeholder="Paste a wallet address" autoComplete="off" spellCheck={false} className="mono" />
            <button type="submit">Count the keys</button>
          </div>
        </form>
        {!wallet && (
          <p className="lede">
            Or try <Link href={`/wallet?w=${EXAMPLE_WALLET}`}>a wallet with money in Kamino, marginfi and Drift</Link>.
          </p>
        )}
        </div>
        {!wallet && (
          <div className="device-frame">
            <ConsoleDevice data={WAITING_CONSOLE} />
          </div>
        )}
      </section>
      {wallet && (
        <Suspense key={wallet} fallback={<p className="wallet-reading mono">Reading this wallet&apos;s positions on chain…</p>}>
          <WalletResults wallet={wallet} />
        </Suspense>
      )}
    </main>
  );
}

async function WalletResults({ wallet }: { wallet: string }) {
  const result = await readPositions(wallet);
  if (!result.ok) {
    return (
      <p className="wallet-error">
        {result.reason === "invalid"
          ? "That is not a Solana wallet address."
          : result.reason === "rate_limited"
            ? "The chain read was rate-limited. Nothing is shown in its place; try again in a minute."
            : "Positions could not be read right now. Nothing is shown in their place."}
      </p>
    );
  }

  const protocols = await fetchProtocols();
  const byId = new Map(protocols.map((p) => [p.id, p]));
  const counts = new Map<string, number>();
  let tokenAccounts = 0;
  for (const p of result.positions) {
    if (p.protocolId === "spl-token") { tokenAccounts++; continue; }
    const id = POSITION_TO_PROTOCOL[p.protocolId] ?? p.protocolId;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const rows = [...counts.entries()].map(([id, count]) => ({ id, name: byId.get(id)?.name ?? id, facts: byId.get(id)?.controlFacts ?? null, count }));
  rows.sort((a, b) => Number(isWeak(b.facts?.timelock?.kind)) - Number(isWeak(a.facts?.timelock?.kind)) || (a.facts?.threshold ?? 99) - (b.facts?.threshold ?? 99));

  const weakCount = rows.filter((r) => isWeak(r.facts?.timelock?.kind)).length;
  const first = rows[0];
  const device = first?.facts
    ? consoleDataFromFacts({ name: first.name, rowLabel: `${first.name} · your position`, facts: first.facts, weakened: isWeak(first.facts.timelock?.kind), readDate: new Date().toISOString().slice(0, 10) })
    : null;

  return (
    <>
      <section className="hero wallet-result">
        <div className="hero-copy">
          <p className="wallet-finding">
            {rows.length === 0
              ? "No positions in the protocols Keyholder tracks."
              : weakCount > 0
                ? <><b>{weakCount} of {rows.length}</b> protocols holding this wallet&apos;s money have no timelock: enough keys can move it at once.</>
                : <>All {rows.length} protocols holding this wallet&apos;s money have a timelock.</>}
          </p>
        </div>
        {device && (
          <div className="device-frame">
            <ConsoleDevice data={device} />
          </div>
        )}
      </section>
      {rows.length > 0 && (
        <section className="protocols-section">
          <table className="ptable">
            <caption>Where this wallet&apos;s money is, weakest control first</caption>
            <thead>
              <tr><th>Protocol</th><th>Keys</th><th>Timelock</th><th>Code</th><th>Positions</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const weak = isWeak(r.facts?.timelock?.kind);
                const unresolved = !r.facts || r.facts.threshold == null;
                const v = r.facts?.verifiedStatus;
                return (
                  <tr key={r.id} className={weak ? "pt-weak" : undefined}>
                    <td><Link className="pt-name" href={`/protocols/${r.id}`}>{r.name}</Link></td>
                    <td>{unresolved ? "unresolved" : `${r.facts!.threshold} / ${r.facts!.members}`}</td>
                    <td className={weak ? "pt-timelock none" : "pt-timelock"}>{unresolved ? "—" : timelockLabel(r.facts)}</td>
                    <td>
                      <span className={`lamp ${v === "verified" ? "on" : v === "drifted" ? "drift" : "off"}`} />
                      {v === "verified" ? "verified" : v === "drifted" ? "drifted" : v === "unverified" ? "never registered" : "—"}
                    </td>
                    <td className="mono">{r.count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {tokenAccounts > 0 && (
            <p className="wallet-note">Plus {tokenAccounts} token accounts held directly in the wallet, not deposited in a protocol.</p>
          )}
        </section>
      )}
    </>
  );
}
