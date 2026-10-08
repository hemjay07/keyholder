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
let NAMES = {};
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

function Columns({ marks, pending, onHover }) {
  const ref = useRef();
  const { invalidate } = useThree();
  const t0 = useRef(performance.now());
  const m = useMemo(() => new THREE.Object3D(), []);
  const c = useMemo(() => new THREE.Color(), []);
  useEffect(() => { t0.current = performance.now(); invalidate(); }, [marks, invalidate]);
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
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    if (moving) invalidate();
  });
  return (
    <instancedMesh ref={ref} args={[null, null, marks.length]} castShadow
      onPointerMove={(e) => { e.stopPropagation(); onHover(marks[e.instanceId] ?? null); }} onPointerOut={() => onHover(null)}>
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

function Scene({ data, onHover }) {
  const { viewport, camera, size } = useThree();
  const narrow = size.width < 600;
  const width = narrow ? 5 : 11;
  const marks = useMemo(() => layout(data.programs, width), [data, width]);
  const pending = useMemo(() => new Set(data.pending ?? []), [data]);
  useEffect(() => {
    // Fit the whole width: distance from the horizontal half-angle, then lift for the terrace view.
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (size.width / size.height));
    const d = (width / 2 + (narrow ? 0.3 : 0.8)) / Math.tan(half);
    camera.position.set(0, narrow ? d * 0.95 : 0.6 + d * 0.5, narrow ? d * 0.55 - 1.6 : d * 0.88 - 2.4);
    camera.lookAt(0, 0.6, -2.4);
    camera.updateProjectionMatrix();
  }, [camera, narrow, size.width, size.height, width]);
  return (
    <>
      <hemisphereLight args={["#ffffff", "#d9d3c6", 1.4]} />
      <directionalLight position={[-5, 9, 6]} intensity={1.6} color="#fffaf0" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
      
      <Steps width={width} />
      <Columns marks={marks} pending={pending} onHover={onHover} />
      <Beacons marks={marks} pending={pending} />
    </>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    Promise.all([fetch("/map.json").then((r) => r.json()), fetch("/names.json").then((r) => r.json())]).then(([m, n]) => { NAMES = n; setData(m); });
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
      <div className="map">
        <Canvas frameloop="demand" shadows dpr={[1, 2]} camera={{ fov: 20, near: 0.1, far: 200 }} gl={{ antialias: true }}>
          <Scene data={data} onHover={setHover} />
        </Canvas>
      </div>
      <dl className="legend">
        {[3, 2, 1, 0].map((s) => (
          <div key={s}><dt><i style={{ background: RUNG[s] }} />Stage {s}<b>{n[s]}</b></dt><dd>{top(s) || "\u00a0"}</dd></div>
        ))}
        <div><dt><i className="pulse" />Open proposal<b>{(data.pending ?? []).length}</b></dt><dd>a pending vote on a multisig that controls the program</dd></div>
      </dl>
      {hover && <div className="card"><div className="nm">{name(hover)}</div><div>Stage {hover.stage} · {hover.usd ? usd(hover.usd) + " traced" : "no dollars traced"}</div><div className="id">{hover.id}</div>{(data.pending ?? []).includes(hover.id) && <div className="warn">open proposal on its controlling multisig</div>}</div>}
    </div>
  );
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
