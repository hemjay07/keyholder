"use client";
// ⌘K / "/" search (P36): protocols by name, id or program id; a pasted wallet
// opens its key count; a pasted signature opens the transaction. Data comes from
// the public API on first open, never from a list baked into the bundle.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Item { label: string; hint: string; href: string; external?: boolean }
interface Proto { id: string; name: string }
interface Prog { programId: string; protocolId: string | null; label: string | null }

const PAGES: Item[] = [
  { label: "Changes", hint: "every control change", href: "/feed" },
  { label: "Your wallet", hint: "who can move your money", href: "/wallet" },
  { label: "Drift replay", hint: "5.6 days of warning", href: "/replay/drift" },
  { label: "Alerts", hint: "get told when control weakens", href: "/alerts" },
  { label: "For vaults", hint: "refuse deposits on-chain", href: "/policy" },
];
const B58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [protos, setProtos] = useState<Proto[]>([]);
  const [progs, setProgs] = useState<Prog[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const onOpen = () => setOpen(true);
    window.addEventListener("kh-search", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("kh-search", onOpen); };
  }, []);

  // While open the page underneath must not move (smooth scroll skips data-lenis-prevent).
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQ(""); setSel(0);
    setTimeout(() => input.current?.focus(), 0);
    if (protos.length) return;
    fetch("/api/v1/protocols").then((r) => r.json()).then((b) => setProtos((b.data ?? []).filter((p: Proto) => !p.id.includes("test")))).catch(() => {});
    fetch("/api/v1/programs").then((r) => r.json()).then((b) => setProgs(b.data ?? [])).catch(() => {});
  }, [open, protos.length]);

  const items = useMemo<Item[]>(() => {
    const t = q.trim();
    const lo = t.toLowerCase();
    const out: Item[] = [];
    if (t.length >= 80 && B58.test(t)) out.push({ label: "Open transaction", hint: `${t.slice(0, 8)}… on Solscan`, href: `https://solscan.io/tx/${t}`, external: true });
    if (t.length >= 32 && t.length <= 44 && B58.test(t)) {
      const prog = progs.find((p) => p.programId === t);
      if (prog?.protocolId) out.push({ label: protos.find((p) => p.id === prog.protocolId)?.name ?? prog.protocolId, hint: "program", href: `/protocols/${prog.protocolId}` });
      out.push({ label: "Count the keys for this wallet", hint: `${t.slice(0, 6)}…${t.slice(-4)}`, href: `/wallet?w=${t}` });
    }
    const nameHits = protos.filter((p) => !lo || p.name.toLowerCase().includes(lo) || p.id.includes(lo)).map((p) => ({ label: p.name, hint: "protocol", href: `/protocols/${p.id}` }));
    const pageHits = PAGES.filter((p) => !lo || p.label.toLowerCase().includes(lo) || p.hint.includes(lo));
    return [...out, ...nameHits, ...pageHits].slice(0, 10);
  }, [q, protos, progs]);

  const go = useCallback((it: Item | undefined) => {
    if (!it) return;
    setOpen(false);
    if (it.external) window.open(it.href, "_blank", "noopener");
    else router.push(it.href);
  }, [router]);

  if (!open) return null;
  return (
    <div className="kp-back" data-lenis-prevent onMouseDown={() => setOpen(false)}>
      <div className="kp" role="dialog" aria-label="Search Keyholder" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={input}
          className="mono"
          value={q}
          placeholder="Protocol, program id, wallet or signature"
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter") go(items[sel]);
          }}
        />
        <ul>
          {items.map((it, i) => (
            <li key={it.href + it.label} className={i === sel ? "on" : undefined} onMouseEnter={() => setSel(i)} onClick={() => go(it)}>
              <span>{it.label}</span><span className="mono">{it.hint}</span>
            </li>
          ))}
          {items.length === 0 && <li className="kp-none mono">Nothing matches.</li>}
        </ul>
      </div>
    </div>
  );
}
