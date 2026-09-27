"use client";
// Alerts sign-up: wallet sign-in (SIWS against /api/v1/auth), then a signed
// webhook per wallet and one subscription per chosen protocol. Uses the
// wallet's injected provider (window.solana / window.phantom.solana) directly.
import { useState } from "react";

interface Provider {
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array } | Uint8Array>;
}

function getProvider(): Provider | null {
  const w = window as unknown as { phantom?: { solana?: Provider }; solana?: Provider };
  return w.phantom?.solana ?? w.solana ?? null;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

type Step = "start" | "signed" | "done";

export default function AlertsSignup({ protocols }: { protocols: Array<{ id: string; name: string }> }) {
  const [step, setStep] = useState<Step>("start");
  const [wallet, setWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set(protocols.map((p) => p.id)));
  const [severity, setSeverity] = useState("high");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    const provider = getProvider();
    if (!provider) {
      setError("No Solana wallet found in this browser. Install Phantom or another wallet that supports message signing.");
      return;
    }
    setBusy(true);
    try {
      const { publicKey } = await provider.connect();
      const address = publicKey.toString();
      const n = await fetch("/api/v1/auth/nonce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet: address }) }).then((r) => r.json());
      if (!n.data) throw new Error("could not start sign-in");
      const signed = await provider.signMessage(new TextEncoder().encode(n.data.message), "utf8");
      const sig = signed instanceof Uint8Array ? signed : signed.signature;
      const s = await fetch("/api/v1/auth/signin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, signature: toBase64(sig), nonceToken: n.data.nonceToken }),
      }).then((r) => r.json());
      if (!s.data) throw new Error("the signature was not accepted");
      setWallet(address);
      setStep("signed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function subscribe() {
    setError(null);
    if (!/^https:\/\//.test(url)) {
      setError("The webhook URL must start with https://");
      return;
    }
    if (chosen.size === 0) {
      setError("Choose at least one protocol.");
      return;
    }
    setBusy(true);
    try {
      const w = await fetch("/api/v1/webhooks", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }).then((r) => r.json());
      if (!w.data) throw new Error("the webhook could not be saved");
      for (const id of chosen) {
        const r = await fetch("/api/v1/subscriptions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "protocol", target: id, minSeverity: severity, channels: ["webhook"] }),
        }).then((x) => x.json());
        if (!r.data) throw new Error(`the subscription for ${id} could not be saved`);
      }
      setSecret(w.data.secret);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "subscription failed");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  }

  return (
    <div className="alerts-flow">
      <ol className="alerts-steps mono">
        <li className={step === "start" ? "on" : "done"}>1 · Sign in with your wallet</li>
        <li className={step === "signed" ? "on" : step === "done" ? "done" : ""}>2 · Choose protocols and a webhook</li>
        <li className={step === "done" ? "on" : ""}>3 · Save your signing secret</li>
      </ol>

      {step === "start" && (
        <div className="alerts-panel">
          <p>Signing proves the wallet is yours; nothing is sent on chain and no funds move.</p>
          <button type="button" className="alerts-btn" onClick={signIn} disabled={busy}>{busy ? "Waiting for the wallet…" : "Sign in with wallet"}</button>
        </div>
      )}

      {step === "signed" && (
        <div className="alerts-panel">
          <p className="mono alerts-wallet">Signed in as {wallet?.slice(0, 6)}…{wallet?.slice(-6)}</p>
          <fieldset className="alerts-protocols">
            <legend className="mono">Protocols</legend>
            {protocols.map((p) => (
              <label key={p.id}>
                <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} /> {p.name}
              </label>
            ))}
          </fieldset>
          <label className="alerts-field">
            <span className="mono">Tell me when severity is at least</span>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="critical">critical</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </label>
          <label className="alerts-field">
            <span className="mono">Webhook URL</span>
            <input type="url" placeholder="https://your-server.example/keyholder" value={url} onChange={(e) => setUrl(e.target.value)} className="mono" />
          </label>
          <button type="button" className="alerts-btn" onClick={subscribe} disabled={busy}>{busy ? "Saving…" : `Subscribe to ${chosen.size} protocols`}</button>
        </div>
      )}

      {step === "done" && secret && (
        <div className="alerts-panel">
          <p>Subscribed. Every alert is a POST to your URL, signed with this secret. It is shown once and cannot be recovered.</p>
          <pre className="mono alerts-secret">{secret}</pre>
          <p className="mono alerts-verify">Verify: header X-Keyholder-Signature = t=&lt;unix&gt;,v1=HMAC-SHA256(secret, &quot;&lt;t&gt;.&lt;body&gt;&quot;)</p>
        </div>
      )}

      {error && <p className="alerts-error">{error}</p>}
    </div>
  );
}
