// Stage map: four terraced steps, Stage 0 lowest and nearest. Every covered program is one instanced column on its
// step; height is the dollars it holds (log scale), and programs whose controlling multisig has an open
// control-relevant proposal glow and pulse orange. Columns rise from the step on load; reduced motion shows them still.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Brand (design/CHARTER.md): orange only for weak control (Stage 0, open proposals), green only for a delay of
// 24 h or more on every path (Stage 2-3), ink for everything else, on warm paper.
const INK = "#1B1A17", SIGNAL = "#FF5A1F", HOLDS = "#1F6B4A";
const RUNG = [SIGNAL, INK, HOLDS, HOLDS];
const PENDING = new THREE.Color("#A32F06");
const STEP_H = 0.55, STEP_D = 1.6;
const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const usd = (v) => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${Math.round(v / 1e6)}M` : `$${Math.round(v / 1e3)}K`;
let NAMES = {}, CONTROL = {};
// Scroll progress through the pinned map section, 0..1, written by App and read by the camera each frame.
const SCROLL = { p: 0 };
let CONTROL_READY = null;
let WAKE = () => {};
const keysOf = (id) => { const c = CONTROL[id]; return c?.ms?.memberKeys ?? (c?.auth && c.kind === "single_key" ? [c.auth] : []); };
const short = (k) => k.slice(0, 4) + "…" + k.slice(-4);
const PAPER = new THREE.Color("#D6D1C6");
const name = (p) => NAMES[p.id] ?? p.id.slice(0, 4) + "…" + p.id.slice(-4);

function layout(programs, width) {
  const rows = [[], [], [], []];
  programs.filter((p) => !p.closed).sort((a, b) => b.usd - a.usd).forEach((p) => rows[p.stage].push(p));
  const out = [];
  rows.forEach((row, s) => {
    const lines = Math.max(1, Math.ceil(row.length / 40));
    const perLine = Math.ceil(row.length / lines) || 1;
    const pitchX = width / Math.max(perLine, 20), pitchZ = (STEP_D * 0.8) / Math.max(lines, 3);
    row.forEach((p, i) => {
      const line = Math.floor(i / perLine), col = i % perLine;
      const h = 0.04 + (p.usd > 0 ? Math.log10(1 + p.usd) / 9.3 : 0) * 1.4;
      out.push({ ...p, x: -((perLine - 1) * pitchX) / 2 + col * pitchX, z: -s * STEP_D + STEP_D * 0.35 - line * pitchZ, base: s * STEP_H, h, w: Math.min(pitchX, pitchZ) * 0.62 });
    });
  });
  return out;
}

function Steps({ width }) {
  return [0, 1, 2, 3].map((s) => (
    <mesh key={s} position={[0, s * STEP_H - STEP_H / 2, -s * STEP_D]} receiveShadow>
      <boxGeometry args={[width + 0.6, STEP_H, STEP_D]} />
      <meshStandardMaterial color="#F4F1EA" roughness={0.95} metalness={0} />
    </mesh>
  )).concat([0, 1, 2, 3].map((s) => (
    <mesh key={"e" + s} position={[0, s * STEP_H + 0.003, -s * STEP_D + STEP_D / 2 - 0.02]}>
      <boxGeometry args={[width + 0.6, 0.006, 0.012]} />
      <meshBasicMaterial color={INK} transparent opacity={0.35} />
    </mesh>
  )));
}

function Columns({ marks, pending, onHover, onPick, related }) {
  const ref = useRef();
  const { invalidate } = useThree();
  const t0 = useRef(performance.now());
  const m = useMemo(() => new THREE.Object3D(), []);
  const c = useMemo(() => new THREE.Color(), []);
  useEffect(() => { t0.current = performance.now(); invalidate(); }, [marks, invalidate]);
  useEffect(() => { invalidate(); }, [related, invalidate]);
  useFrame(() => {
    if (!ref.current) return;
    const t = (performance.now() - t0.current) / 1000;
    let moving = false;
    marks.forEach((p, i) => {
      const delay = reduced ? 0 : p.stage * 0.18 + (i % 40) * 0.012;
      const k = reduced ? 1 : Math.min(1, Math.max(0, (t - delay) / 0.8));
      const e = 1 - Math.pow(1 - k, 3);
      if (k < 1) moving = true;
      const isP = pending.has(p.id);
      const glow = isP && !reduced ? 0.75 + 0.25 * Math.sin(t * 3 + i) : 1;
      if (isP && !reduced) moving = true;
      const h = Math.max(0.001, p.h * e);
      m.position.set(p.x, p.base + h / 2, p.z);
      m.scale.set(p.w, h, p.w);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
      ref.current.setColorAt(i, isP ? c.copy(PENDING).multiplyScalar(glow) : c.set(RUNG[p.stage]));
      if (related && !related.has(p.id)) ref.current.setColorAt(i, c.lerp(PAPER, 0.82));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    if (moving) invalidate();
  });
  return (
    <instancedMesh ref={ref} args={[null, null, marks.length]} castShadow
      onPointerMove={(e) => { e.stopPropagation(); onHover(marks[e.instanceId] ?? null); document.body.style.cursor = "pointer"; }} onPointerOut={() => { onHover(null); document.body.style.cursor = ""; }} onClick={(e) => { e.stopPropagation(); onPick(marks[e.instanceId] ?? null); }}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.6} metalness={0} />
    </instancedMesh>
  );
}

// A beacon floats above every program whose controlling multisig has an open proposal, so a pending vote reads
// on any rung (Stage 0 columns are already orange).
function Beacons({ marks, pending }) {
  const ref = useRef();
  const { invalidate } = useThree();
  const list = useMemo(() => marks.filter((p) => pending.has(p.id)), [marks, pending]);
  const m = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    list.forEach((p, i) => {
      const bob = reduced ? 0 : 0.04 * Math.sin(t * 2.2 + i);
      m.position.set(p.x, p.base + p.h + 0.12 + bob, p.z);
      m.scale.setScalar(reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 3 + i));
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (!reduced) invalidate();
  });
  return (
    <instancedMesh ref={ref} args={[null, null, list.length]}>
      <octahedronGeometry args={[0.045, 0]} />
      <meshBasicMaterial color={SIGNAL} />
    </instancedMesh>
  );
}

// Signer keys of the picked program fan out above it; each key draws a line to the picked column and to every other
// column whose controlling multisig it also signs for.
function SignerFan({ picked, marks, width, onKey }) {
  const geo = useMemo(() => {
    if (!picked) return null;
    const keys = keysOf(picked.id);
    const byId = new Map(marks.map((p) => [p.id, p]));
    const pts = [], nodes = [];
    keys.forEach((k, i) => {
      const a = keys.length === 1 ? 0 : (i / (keys.length - 1) - 0.5) * Math.min(width < 6 ? 1.9 : 3, keys.length * 0.3);
      const cx = THREE.MathUtils.clamp(picked.x, -width / 2 + 1, width / 2 - 1);
      const node = new THREE.Vector3(cx + a, picked.base + picked.h + 1.1, picked.z - 0.3);
      nodes.push(node);
      pts.push(node, new THREE.Vector3(picked.x, picked.base + picked.h, picked.z));
      for (const [id, c] of Object.entries(CONTROL)) {
        if (id === picked.id || !byId.has(id)) continue;
        if ((c.ms?.memberKeys ?? (c.kind === "single_key" ? [c.auth] : [])).includes(k)) { const q = byId.get(id); pts.push(node, new THREE.Vector3(q.x, q.base + q.h, q.z)); }
      }
    });
    return { lines: new THREE.BufferGeometry().setFromPoints(pts), nodes, keys };
  }, [picked, marks]);
  if (!geo) return null;
  return (
    <group>
      <lineSegments geometry={geo.lines}><lineBasicMaterial color={INK} transparent opacity={0.45} /></lineSegments>
      {geo.nodes.map((v, i) => <mesh key={i} position={v} onPointerOver={(e) => { e.stopPropagation(); onKey(geo.keys[i]); document.body.style.cursor = "pointer"; }} onPointerOut={() => { onKey(null); document.body.style.cursor = ""; }} onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(geo.keys[i]); }}><sphereGeometry args={[0.06, 16, 16]} /><meshStandardMaterial color={INK} /></mesh>)}
    </group>
  );
}

function Scene({ data, onHover, picked, onPick, onKey }) {
  const { viewport, camera, size, invalidate } = useThree();
  useEffect(() => { WAKE = invalidate; }, [invalidate]);
  const narrow = size.width < 600;
  const width = narrow ? 5 : 11;
  const marks = useMemo(() => layout(data.programs, width), [data, width]);
  const pending = useMemo(() => new Set(data.pending ?? []), [data]);
  const related = useMemo(() => {
    if (!picked) return null;
    const keys = new Set(keysOf(picked.id));
    return new Set(Object.entries(CONTROL).filter(([, c]) => (c.ms?.memberKeys ?? (c.kind === "single_key" ? [c.auth] : [])).some((k) => keys.has(k))).map(([id]) => id).concat(picked.id));
  }, [picked]);
  // Camera shots along the scroll: the whole map, then each step close (Stage 0 up to 3), then the whole map again.
  const pickedMark = picked && marks.find((p) => p.id === picked.id);
  useEffect(() => { invalidate(); }, [pickedMark, invalidate]);
  const shots = useMemo(() => {
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (size.width / size.height));
    const d = (width / 2 + (narrow ? 0.3 : 0.8)) / Math.tan(half);
    const whole = { pos: new THREE.Vector3(0, narrow ? d * 0.95 : 0.6 + d * 0.5, narrow ? d * 0.55 - 1.6 : d * 0.88 - 2.4), look: new THREE.Vector3(0, 0.6, -2.4) };
    const close = (s) => {
      // Aim at the stage's biggest program, kept inside the frame's width.
      const top = marks.filter((p) => p.stage === s).sort((a, b) => b.usd - a.usd)[0];
      const x = THREE.MathUtils.clamp(top ? top.x + width * 0.12 : 0, -width * 0.3, width * 0.3);
      const look = new THREE.Vector3(narrow ? 0 : x, s * STEP_H + 0.4, -s * STEP_D);
      return { pos: look.clone().add(new THREE.Vector3(narrow ? 0 : 1.4, narrow ? 4.4 : 2.6, narrow ? 6.8 : 6.0)), look };
    };
    return [whole, close(0), close(1), close(2), close(3), whole];
  }, [camera.fov, size.width, size.height, width, narrow, marks]);
  const look = useMemo(() => new THREE.Vector3(0, 0.6, -2.4), []);
  const goal = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() }), []);
  const first = useRef(true);
  // Every frame the camera eases toward one goal: the picked program (its column and the keys above it) when one is
  // picked, otherwise the shot for the current scroll position. Closing a pick glides back to the scroll shot.
  useFrame(({ invalidate }) => {
    if (pickedMark) {
      goal.look.set(THREE.MathUtils.clamp(pickedMark.x, -width / 2 + 1, width / 2 - 1), pickedMark.base + pickedMark.h + (narrow ? -0.6 : 0.6), pickedMark.z);
      goal.pos.copy(goal.look).add(new THREE.Vector3(narrow ? 0 : 0.8, narrow ? 4.5 : 2.6, narrow ? 15 : 9));
    } else {
      const p = reduced ? 0 : SCROLL.p;
      const f = p * (shots.length - 1), i = Math.min(shots.length - 2, Math.floor(f)), k = f - i, e = k * k * (3 - 2 * k);
      goal.pos.lerpVectors(shots[i].pos, shots[i + 1].pos, e);
      goal.look.lerpVectors(shots[i].look, shots[i + 1].look, e);
    }
    const t = first.current || reduced ? 1 : 0.14;
    first.current = false;
    camera.position.lerp(goal.pos, t);
    look.lerp(goal.look, t);
    camera.lookAt(look);
    if (camera.position.distanceToSquared(goal.pos) > 1e-6 || look.distanceToSquared(goal.look) > 1e-6) invalidate();
  });
  useEffect(() => { first.current = true; }, [shots]);
  return (
    <>
      <hemisphereLight args={["#ffffff", "#d9d3c6", 1.4]} />
      <directionalLight position={[-5, 9, 6]} intensity={1.6} color="#fffaf0" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
      
      <Steps width={width} />
      <Columns marks={marks} pending={pending} onHover={onHover} onPick={onPick} related={related} />
      <SignerFan picked={pickedMark} marks={marks} width={width} onKey={onKey} />
      <Beacons marks={marks} pending={pending} />
    </>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [hover, setHover] = useState(null);
  const [picked, setPicked] = useState(null);
  const [progress, setProgress] = useState(0);
  const [keyHover, setKeyHover] = useState(null);
  useEffect(() => { const k = (e) => e.key === "Escape" && setPicked(null); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, []);
  // Signer facts (171 KB) load on the first pick, not with the page.
  const pick = (p) => { if (!p) return setPicked(null); (CONTROL_READY ??= fetch("/control.json").then((r) => r.json()).then((c) => { CONTROL = c; })).then(() => setPicked(p)); };
  const scrolly = useRef(null);
  useEffect(() => {
    const on = () => {
      const el = scrolly.current; if (!el) return;
      const r = el.getBoundingClientRect(), span = el.offsetHeight - innerHeight;
      SCROLL.p = Math.min(1, Math.max(0, -r.top / span)); setProgress(SCROLL.p); WAKE();
    };
    addEventListener("scroll", on, { passive: true }); on();
    return () => removeEventListener("scroll", on);
  }, [data]);
  useEffect(() => {
    Promise.all(["/map.json", "/names.json"].map((u) => fetch(u).then((r) => r.json()))).then(([m, n]) => { NAMES = n; setData(m);
      const h = location.hash.match(/pick=(\w+)/); const p = h && m.programs.find((x) => x.id === h[1]); if (p) pick(p);
      addEventListener("hashchange", () => { const h2 = location.hash.match(/pick=(\w+)/); const q = h2 && m.programs.find((x) => x.id === h2[1]); if (q) pick(q); }); });
  }, []);
  if (!data) return null;
  const live = data.programs.filter((p) => !p.closed);
  const n = [0, 1, 2, 3].map((s) => live.filter((p) => p.stage === s).length);
  const top = (s) => live.filter((p) => p.stage === s && p.usd > 0).sort((x, y) => y.usd - x.usd).slice(0, 3).map((p) => `${name(p)} ${usd(p.usd)}`).join("  ·  ");
  const weak = live.filter((p) => p.stage <= 1).reduce((t, p) => t + p.usd, 0);
  return (
    <div className="stage" data-device="stage-map">
      <header>
        <h1><Odometer value={weak} /> on Solana sits in programs that can be changed with less than a day&rsquo;s notice.</h1>
        <p className="sub">{live.length} programs on four stages of who can move their money. Record of {data.day}, anchored on chain.</p>
      </header>
      <section className="scrolly" ref={scrolly}>
      <div className="map">
        <Canvas onPointerMissed={() => setPicked(null)} frameloop="demand" shadows dpr={[1, 2]} camera={{ fov: 20, near: 0.1, far: 200 }} gl={{ antialias: true }}>
          <Scene data={data} onHover={setHover} picked={picked} onPick={pick} onKey={setKeyHover} />
        </Canvas>
        {!reduced && !picked && <Captions live={live} p={progress} />}
        {keyHover && <div className="keytip">{keyHover}<span>click to copy</span></div>}
      </div>
      </section>
      <dl className="legend">
        {[3, 2, 1, 0].map((s) => (
          <div key={s}><dt><i style={{ background: RUNG[s] }} />Stage {s}<b>{n[s]}</b></dt><dd>{top(s) || "\u00a0"}</dd></div>
        ))}
        <div><dt><i className="pulse" />Open proposal<b>{(data.pending ?? []).length}</b></dt><dd>a pending vote on a multisig that controls the program</dd></div>
      </dl>
      {picked && <Picked p={picked} live={live} onPick={pick} onClose={() => setPicked(null)} />}
      {!picked && hover && <div className="card"><div className="nm">{name(hover)}</div><div>Stage {hover.stage} · {hover.usd ? usd(hover.usd) + " traced" : "no dollars traced"}</div><div className="id">{hover.id}</div>{(data.pending ?? []).includes(hover.id) && <div className="warn">open proposal on its controlling multisig</div>}</div>}
    </div>
  );
}

// Plain words for the rule that sets a program's stage (record stage.bindingPath).
function bindingText(b) {
  if (!b || b === "upgrade") return "Set by its upgrade path";
  if (b === "cap:admin_unknown") return "Capped at Stage 1 because its admin settings could not be read";
  if (b.startsWith("admin:")) return `Set by its admin key (${b.slice(6).replace(".", " · ")})`;
  if (b.startsWith("cap:")) return "Capped";
  return b;
}

const keysOfRec = (x) => x.ms?.memberKeys ?? (x.kind === "single_key" ? [x.auth] : []);

function Picked({ p, live, onPick, onClose }) {
  const c = CONTROL[p.id] ?? {};
  const keys = keysOf(p.id);
  const [copied, setCopied] = useState(null);
  const shared = live.filter((x) => x.id !== p.id && CONTROL[x.id] && keysOfRec(CONTROL[x.id]).some((k) => keys.includes(k))).sort((a, b) => b.usd - a.usd);
  const hrs = c.ms?.timelockS != null ? (c.ms.timelockS ? (c.ms.timelockS / 3600).toFixed(c.ms.timelockS % 3600 ? 1 : 0) + " h" : "none") : "none";
  const copy = (k) => { navigator.clipboard?.writeText(k); setCopied(k); setTimeout(() => setCopied(null), 1200); };
  return (
    <aside className="card picked">
      <button className="x" onClick={onClose} aria-label="Close (Esc)">×</button>
      <div className="nm">{name(p)}</div>
      <div>Stage {p.stage} · {p.usd ? usd(p.usd) + " traced" : "no dollars traced"}</div>
      <p className="why">{p.binding === "cap:admin_unknown" ? "Capped at Stage 1: its admin settings could not be read, so it cannot reach Stage 2 until they are." : <><span>{bindingText(p.binding)}:</span> {c.reason ?? c.cap ?? ""}</>}</p>
      <dl>
        <dt className="h">Upgrade path</dt>
        <dt>Authority</dt><dd>{c.kind === "squads_vault" ? `Squads ${c.ms?.version} multisig` : c.kind?.replace(/_/g, " ") ?? "unknown"}</dd>
        {c.ms && <><dt>Threshold</dt><dd>{c.ms.threshold} of {c.ms.members}</dd><dt>Delay</dt><dd>{hrs}</dd></>}
      </dl>
      <div className="h">Keys · {keys.length}</div>
      <div className="chips">{keys.map((k) => <button key={k} className="chip" title={k} onClick={() => copy(k)}>{copied === k ? "copied" : short(k)}</button>)}{!keys.length && <span>none read</span>}</div>
      <div className="h">Shares a key with · {shared.length}</div>
      <ul className="shared">{shared.slice(0, 8).map((x) => <li key={x.id}><button onClick={() => onPick(x)}>{name(x)}</button><span>Stage {x.stage}{x.usd ? " · " + usd(x.usd) : ""}</span></li>)}{!shared.length && <li><span>no other covered program</span></li>}</ul>
      <div className="id">{p.id}</div>
    </aside>
  );
}

// One caption per close shot, from the day's record (counts and dollars are computed, never typed).
function Captions({ live, p }) {
  const at = (s) => live.filter((x) => x.stage === s);
  const sum = (a) => usd(a.reduce((t, x) => t + x.usd, 0));
  const kamino = live.find((x) => x.id === "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
  const lines = [
    null,
    [`Stage 0 · ${at(0).length} programs · ${sum(at(0))}`, "One key can replace the code today. No second signer, no waiting period."],
    [`Stage 1 · ${at(1).length} programs · ${sum(at(1))}`, `Several signers, but less than a day of notice.${kamino ? ` Kamino Lend's ${usd(kamino.usd)} is here: its admin key is 4 of 10 with no timelock.` : ""}`],
    [`Stage 2 · ${at(2).length} programs · ${sum(at(2))}`, "Every change waits 24 hours or more, long enough for users to see it coming and leave."],
    [`Stage 3 · ${at(3).length} programs · ${sum(at(3))}`, "Cannot be changed at all, or only after a seven-day exit window."],
    null,
  ];
  const f = p * (lines.length - 1), i = Math.round(f), near = 1 - Math.min(1, Math.abs(f - i) * 2.2);
  const line = lines[i];
  return line ? <div className="caption" style={{ opacity: near }}><b>{line[0]}</b><span>{line[1]}</span></div> : null;
}

function Odometer({ value }) {
  const [v, setV] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) return;
    const t0 = performance.now(); let raf;
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / 1400); setV(value * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="num">{usd(v)}</span>;
}

createRoot(document.getElementById("root")).render(<App />);
