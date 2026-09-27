// /proof: the on-chain check doing its job on devnet. A deposit passes, the
// protocol's multisig is weakened, the same deposit is refused. Every figure
// is read from devnet (lib/proof.ts says how).
import Link from "next/link";
import ConsoleDevice from "@/components/console/ConsoleDevice";
import type { ConsoleData } from "@/components/console/Console";
import { PROGRAMS, STEPS, explorerAddr, explorerTx } from "@/lib/proof";

const AT_REFUSAL: ConsoleData = {
  protocol: "WATCHED PROTOCOL · DEVNET",
  threshold: 2,
  members: 5,
  timelockSeconds: 0,
  verified: false,
  codeDrifted: false,
  weakened: true,
  slot: 504518286,
  label: "deposit refused · ThresholdBelowPolicy · slot 504,518,286",
};

function fmt(iso: string): string {
  return `${iso.slice(11, 19)} UTC`;
}

const VAULT_SNIPPET = `pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    // Ask Keyholder first. If the protocol's control fell below
    // this vault's policy, the call fails and the deposit reverts.
    cpi_check(CpiContext::new(ctx.accounts.guard_program.key(), CpiCheck {
        policy:  ctx.accounts.guard_policy.to_account_info(),
        config:  ctx.accounts.guard_config.to_account_info(),
        control: ctx.accounts.guard_control.to_account_info(),
        target_program: ctx.accounts.target_program.to_account_info(),
        programdata:    ctx.accounts.target_programdata.to_account_info(),
        multisig: ctx.accounts.target_multisig.as_ref().map(|a| a.to_account_info()),
    }))?;
    // ... then take the deposit
}`;

export default function ProofPage() {
  const before = STEPS[0]!;
  const after = STEPS[2]!;
  const gap = (new Date(after.time).getTime() - new Date(before.time).getTime()) / 1000;
  return (
    <main className="proof-page">

      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">Proof · devnet</p>
          <h1>Refused on-chain.</h1>
          <p className="lede">
            A vault asks Keyholder before it takes a deposit. At {fmt(before.time)} the protocol behind it needed 3 of 5 keys and passed.
            Its multisig was cut to 2 of 5 with no timelock. {gap} seconds after the first deposit, the same deposit was refused by the chain itself.
          </p>
          <div className="proof-compare mono">
            <div>
              <span className="pc-label">before</span>
              <b>{before.facts!.threshold} of {before.facts!.members}</b><span>{before.facts!.timelockS} s timelock</span><span className="pc-pass">passed</span>
            </div>
            <div>
              <span className="pc-label">after</span>
              <b>{after.facts!.threshold} of {after.facts!.members}</b><span>no timelock</span><span className="pc-refused">refused, 6001</span>
            </div>
          </div>
        </div>
        <div className="device-frame">
          <ConsoleDevice data={AT_REFUSAL} />
        </div>
      </section>

      <section className="steps-section">
        <h2>Three transactions, 23 seconds</h2>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.signature} className={`step proof-${s.outcome}`}>
              <span className="step-time mono">{fmt(s.time)}<br />slot {s.slot.toLocaleString("en-US")}</span>
              <div className="step-body">
                <p className="step-says"><b>{s.title}.</b> {s.detail}</p>
                {s.facts && (
                  <p className="step-facts mono">
                    {s.facts.threshold} of {s.facts.members} · timelock {s.facts.timelockS} s · score {s.facts.score}
                    {s.facts.reasons && <> · {s.facts.reasons.join(", ")}</>}
                  </p>
                )}
              </div>
              <a className="step-sig mono" href={explorerTx(s.signature)} target="_blank" rel="noreferrer" title={s.signature}>
                {s.signature.slice(0, 6)}…{s.signature.slice(-6)}
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="proof-code">
        <h2>What the vault adds</h2>
        <pre className="mono">{VAULT_SNIPPET}</pre>
        <p className="lede">One call. The vault sets its own policy (minimum threshold, minimum timelock, how recently control may have weakened); Keyholder reads the protocol&apos;s control and answers on-chain.</p>
      </section>

      <section className="citations-section">
        <h2>Programs on devnet</h2>
        <ul>
          {Object.values(PROGRAMS).map((p) => (
            <li key={p.id}>
              <a href={explorerAddr(p.id)} target="_blank" rel="noreferrer" className="mono">{p.id.slice(0, 6)}…{p.id.slice(-6)}</a> · {p.role}
            </li>
          ))}
          <li>Check results are decoded from the program&apos;s return data in each transaction (ok, reasons, score, threshold, timelock, last weakened slot).</li>
          <li>Mainnet: not deployed yet. It will run under a 2-of-3 multisig with a 48-hour timelock.</li>
        </ul>
      </section>
    </main>
  );
}
