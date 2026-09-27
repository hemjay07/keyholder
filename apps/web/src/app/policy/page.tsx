// /policy: the vault developer's view. Set the policy your vault would give
// the check program; see which tracked protocols pass today, from their real
// control as read on chain.
import Link from "next/link";
import { fetchProtocols } from "@/lib/api-client";
import PolicySim, { type SimProtocol } from "@/components/PolicySim";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  let protocols: SimProtocol[] = [];
  let readError = false;
  try {
    const list = await fetchProtocols();
    protocols = list.map((p) => {
      const f = p.controlFacts;
      if (f?.authorityKind === "immutable") return { id: p.id, name: p.name, kind: "immutable", threshold: null, members: null, timelockS: null };
      const v4 = (f?.authorityKind === "squads_vault" || f?.authorityKind === "squads_v4_direct") && f.timelock?.kind !== "no_timelock_feature";
      if (v4 && f.threshold != null) {
        return { id: p.id, name: p.name, kind: "squads_v4", threshold: f.threshold, members: f.members, timelockS: f.timelock?.kind === "seconds" ? f.timelock.seconds : 0 };
      }
      const otherLabel =
        f?.authorityKind === "spl_gov" ? "Realms governance"
        : f?.authorityKind === "coral_multisig" ? "coral multisig"
        : f?.timelock?.kind === "no_timelock_feature" ? "Squads v3"
        : "this authority";
      return { id: p.id, name: p.name, kind: "other", otherLabel, threshold: f?.threshold ?? null, members: f?.members ?? null, timelockS: null };
    });
  } catch {
    readError = true;
  }

  return (
    <main className="policy-page">
      <section className="feed-head">
        <p className="kicker">Keyholder · For vaults</p>
        <h1>Refuse deposits where control just weakened.</h1>
        <p className="lede">
          Your program calls Keyholder&apos;s check before it moves money. You set the policy; the chain answers. Try a policy against the
          protocols Keyholder tracks, as their control reads today. <Link href="/proof">See it refuse a real deposit on devnet &rarr;</Link>
        </p>
      </section>
      <section className="sim-section">
        {readError ? <p className="feed-error">Protocol control could not be read right now. Nothing is shown in its place.</p> : <PolicySim protocols={protocols} />}
        <p className="sim-note mono">
          The deployed check reads Squads v4 multisigs; other control types are refused as unknown authority until the program reads them.
          It also enforces cool-downs after a weakening or an upgrade, which this page does not simulate.
        </p>
      </section>
    </main>
  );
}
