// Stage map: four terraced steps, Stage 0 lowest and nearest. Every covered program is one instanced column on its
// step; height is the dollars it holds (log scale), and programs whose controlling multisig has an open
// control-relevant proposal glow and pulse orange. Columns rise from the step on load; reduced motion shows them still.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const RUNG = ["#c8482c", "#c9a24a", "#7fa37a", "#e9e4d8"];
const PENDING = new THREE.Color("#ff7a1a");
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
      <meshStandardMaterial color="#2a2620" roughness={0.85} metalness={0.05} />
    </mesh>
  )).concat([0, 1, 2, 3].map((s) => (
    <mesh key={"e" + s} position={[0, s * STEP_H + 0.003, -s * STEP_D + STEP_D / 2 - 0.02]}>
      <boxGeometry args={[width + 0.6, 0.012, 0.04]} />
      <meshBasicMaterial color={RUNG[s]} toneMapped={false} />
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
      ref.current.setColorAt(i, isP ? c.copy(PENDING).multiplyScalar(glow * 1.6) : c.set(RUNG[p.stage]));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    if (moving) invalidate();
  });
  return (
    <instancedMesh ref={ref} args={[null, null, marks.length]} castShadow
      onPointerMove={(e) => { e.stopPropagation(); onHover(marks[e.instanceId] ?? null); }} onPointerOut={() => onHover(null)}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.45} metalness={0.15} toneMapped={false} />
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
    const d = (width / 2 + 0.8) / Math.tan(half);
    camera.position.set(0, 1.2 + d * 0.55, d * 0.85 - 1.6);
    camera.lookAt(0, 0.6, -2.4);
    camera.updateProjectionMatrix();
  }, [camera, narrow, size.width, size.height, width]);
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[-5, 9, 6]} intensity={2.2} color="#fff1dc" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
      <directionalLight position={[6, 3, -6]} intensity={0.5} color="#9fb6ff" />
      <Steps width={width} />
      <Columns marks={marks} pending={pending} onHover={onHover} />
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
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }} data-device="stage-map">
      <Canvas frameloop="demand" shadows dpr={[1, 2]} camera={{ fov: 38, near: 0.1, far: 60 }} gl={{ antialias: true }}>
        <Scene data={data} onHover={setHover} />
      </Canvas>
      <div className="legend">
        {[3, 2, 1, 0].map((s) => (
          <div key={s} className="row"><span style={{ color: RUNG[s] }}>Stage {s} · {n[s]}</span><span className="top">{top(s)}</span></div>
        ))}
        <div className="row"><span style={{ color: "#ff7a1a" }}>Open proposal · {(data.pending ?? []).length}</span></div>
      </div>
      {hover && <div className="card"><div>{name(hover)}</div><div>Stage {hover.stage} · {hover.usd ? usd(hover.usd) + " held" : "no dollars traced"}</div><div className="id">{hover.id}</div>{(data.pending ?? []).includes(hover.id) && <div style={{ color: "#ff7a1a" }}>open proposal on its controlling multisig</div>}</div>}
      <h1>{live.length} Solana programs, ranked by who can change them · {data.day}</h1>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
