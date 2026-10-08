'use client';
// File: apps/web/src/components/stagemap/scene.tsx
// The Stage map's 3D scene (design/devices/stage-map spike, ported): four terraced steps, Stage 0 lowest and nearest;
// every program is one instanced column on its step, height = dollars traced (log). Orange only for weak control
// (Stage 0, open proposals), green only for a 24 h+ delay on every path, ink for the rest (design/CHARTER.md).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { ControlFacts, MapProgram, Mark } from './types';

export const SIGNAL = '#FF5A1F';
/** Scene colours per page theme (globals.css light/dark tokens); marks keep their meaning in both. */
export interface Palette { stage1: string; ink: string; holds: string; step: string; dim: THREE.Color; pending: THREE.Color; sky: [string, string, number] }
export const PALETTES: Record<'light' | 'dark', Palette> = {
  light: { stage1: '#1B1A17', ink: '#1B1A17', holds: '#1F6B4A', step: '#F4F1EA', dim: new THREE.Color('#D6D1C6'), pending: new THREE.Color('#A32F06'), sky: ['#ffffff', '#d9d3c6', 1.4] },
  dark: { stage1: '#9A938A', ink: '#E6E0D4', holds: '#4CC08E', step: '#2A2825', dim: new THREE.Color('#34312C'), pending: new THREE.Color('#E0531F'), sky: ['#fff4e6', '#1a1917', 1.6] },
};
const rungColor = (pal: Palette, stage: number): string => [SIGNAL, pal.stage1, pal.holds, pal.holds][stage] ?? pal.ink;
const STEP_H = 0.55;

export const prefersReduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

export function keysOfFacts(c: ControlFacts | undefined): string[] {
  if (!c) return [];
  return c.ms?.memberKeys ?? (c.kind === 'single_key' && c.auth ? [c.auth] : []);
}

/** Columns per rung, biggest first; phones get shorter, deeper rows (stepD) so every rung reads at 390 px. */
export function layout(programs: MapProgram[], width: number, stepD: number, perCap: number): Mark[] {
  const rows: MapProgram[][] = [[], [], [], []];
  programs.filter((p) => !p.closed).sort((a, b) => b.usd - a.usd).forEach((p) => rows[p.stage]?.push(p));
  const out: Mark[] = [];
  rows.forEach((row, s) => {
    const lines = Math.max(1, Math.ceil(row.length / perCap));
    const perLine = Math.ceil(row.length / lines) || 1;
    const pitchX = width / Math.max(perLine, Math.min(20, perCap)), pitchZ = (stepD * 0.8) / Math.max(lines, 3);
    row.forEach((p, i) => {
      const line = Math.floor(i / perLine), col = i % perLine;
      const h = 0.04 + (p.usd > 0 ? Math.log10(1 + p.usd) / 9.3 : 0) * 1.4;
      out.push({ ...p, x: -((perLine - 1) * pitchX) / 2 + col * pitchX, z: -s * stepD + stepD * 0.35 - line * pitchZ, base: s * STEP_H, h, w: Math.min(pitchX, pitchZ) * 0.62 });
    });
  });
  return out;
}

function Steps({ width, stepD, pal }: { width: number; stepD: number; pal: Palette }) {
  return (
    <>
      {[0, 1, 2, 3].map((s) => (
        <mesh key={s} position={[0, s * STEP_H - STEP_H / 2, -s * stepD]} receiveShadow>
          <boxGeometry args={[width + 0.6, STEP_H, stepD]} />
          <meshStandardMaterial color={pal.step} roughness={0.95} metalness={0} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((s) => (
        <mesh key={`e${s}`} position={[0, s * STEP_H + 0.003, -s * stepD + stepD / 2 - 0.02]}>
          <boxGeometry args={[width + 0.6, 0.006, 0.012]} />
          <meshBasicMaterial color={pal.ink} transparent opacity={0.5} />
        </mesh>
      ))}
    </>
  );
}

interface ColumnsProps { pal: Palette; marks: Mark[]; pending: Set<string>; related: Set<string> | null; onHover: (m: Mark | null) => void; onPick: (m: Mark | null) => void }

/** Columns rise stage by stage on load; pending ones breathe in deep orange. */
function Columns({ pal, marks, pending, related, onHover, onPick }: ColumnsProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { invalidate } = useThree();
  const t0 = useRef(0);
  const m = useMemo(() => new THREE.Object3D(), []);
  const c = useMemo(() => new THREE.Color(), []);
  const reduced = prefersReduced();
  useEffect(() => { t0.current = performance.now(); invalidate(); }, [marks, invalidate]);
  useEffect(() => { invalidate(); }, [related, invalidate]);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = (performance.now() - t0.current) / 1000;
    let moving = false;
    marks.forEach((p, i) => {
      const k = reduced ? 1 : Math.min(1, Math.max(0, (t - (p.stage * 0.18 + (i % 40) * 0.012)) / 0.8));
      if (k < 1) moving = true;
      const isP = pending.has(p.id);
      if (isP && !reduced) moving = true;
      const h = Math.max(0.001, p.h * easeOut(k));
      m.position.set(p.x, p.base + h / 2, p.z); m.scale.set(p.w, h, p.w); m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
      if (isP) c.copy(pal.pending).multiplyScalar(reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 3 + i)); else c.set(rungColor(pal, p.stage));
      if (related && !related.has(p.id)) c.lerp(pal.dim, 0.82);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (moving) invalidate();
  });
  const at = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId == null ? null : marks[e.instanceId] ?? null);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, marks.length]} castShadow
      onPointerMove={(e) => { e.stopPropagation(); onHover(at(e)); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { onHover(null); document.body.style.cursor = ''; }}
      onClick={(e) => { e.stopPropagation(); onPick(at(e)); }}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.6} metalness={0} />
    </instancedMesh>
  );
}

/** A small orange beacon above every program with an open proposal, so a pending vote reads on any rung. */
function Beacons({ marks, pending }: { marks: Mark[]; pending: Set<string> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { invalidate } = useThree();
  const list = useMemo(() => marks.filter((p) => pending.has(p.id)), [marks, pending]);
  const m = useMemo(() => new THREE.Object3D(), []);
  const reduced = prefersReduced();
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = performance.now() / 1000;
    list.forEach((p, i) => {
      m.position.set(p.x, p.base + p.h + 0.12 + (reduced ? 0 : 0.04 * Math.sin(t * 2.2 + i)), p.z);
      m.scale.setScalar(reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 3 + i)); m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (!reduced) invalidate();
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]}>
      <octahedronGeometry args={[0.045, 0]} />
      <meshBasicMaterial color={SIGNAL} />
    </instancedMesh>
  );
}

export interface Fan { keys: string[]; nodes: THREE.Vector3[]; segs: { from: THREE.Vector3; to: THREE.Vector3; shared: boolean; i: number }[]; related: Mark[] }

/** Key nodes just above the picked column, with segments to it ("own") and to every column a key also signs for. */
export function fanFor(picked: Mark | null, marks: Mark[], width: number, control: Record<string, ControlFacts>): Fan | null {
  if (!picked) return null;
  const keys = keysOfFacts(control[picked.id]);
  const byId = new Map(marks.map((p) => [p.id, p]));
  const nodes: THREE.Vector3[] = [], segs: Fan['segs'] = [], related: Mark[] = [];
  const spread = Math.min(width < 6 ? 1.9 : 3, keys.length * 0.3);
  const cx = THREE.MathUtils.clamp(picked.x, -width / 2 + 1, width / 2 - 1);
  const top = (q: Mark) => new THREE.Vector3(q.x, q.base + q.h, q.z);
  keys.forEach((k, i) => {
    const node = new THREE.Vector3(cx + (keys.length === 1 ? 0 : (i / (keys.length - 1) - 0.5) * spread), picked.base + picked.h + 1.1, picked.z - 0.3);
    nodes.push(node);
    segs.push({ from: node, to: top(picked), shared: false, i });
    for (const [id, c] of Object.entries(control)) {
      const q = byId.get(id);
      if (id === picked.id || !q || !keysOfFacts(c).includes(k)) continue;
      related.push(q); segs.push({ from: node, to: top(q), shared: true, i });
    }
  });
  return { keys, nodes, segs, related };
}

/** Keys drop in one after another, lines draw down from each key, a ring settles round the picked column. */
function SignerFan({ pal, fan, picked, onKey }: { pal: Palette; fan: Fan | null; picked: Mark | null; onKey: (k: string | null) => void }) {
  const own = useRef<THREE.LineSegments>(null), shared = useRef<THREE.LineSegments>(null);
  const nodes = useRef<THREE.InstancedMesh>(null), ring = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null);
  const t0 = useRef(0);
  const { invalidate } = useThree();
  const m = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const buf = useMemo(() => fan && {
    own: new Float32Array(fan.segs.filter((x) => !x.shared).length * 6),
    shared: new Float32Array(Math.max(1, fan.segs.filter((x) => x.shared).length) * 6),
  }, [fan]);
  const reduced = prefersReduced();
  useEffect(() => { t0.current = performance.now(); invalidate(); }, [fan, invalidate]);
  useFrame(() => {
    if (!fan || !buf || !nodes.current || !own.current || !shared.current || !ring.current) return;
    const t = reduced ? 9 : (performance.now() - t0.current) / 1000;
    const step = 0.32 / Math.max(1, fan.nodes.length);
    fan.nodes.forEach((v, i) => {
      const k = easeOut((t - i * step) / 0.28);
      m.position.set(v.x, v.y + (1 - k) * 0.35, v.z); m.scale.setScalar(Math.max(0.001, k)); m.updateMatrix();
      nodes.current!.setMatrixAt(i, m.matrix);
    });
    nodes.current.instanceMatrix.needsUpdate = true;
    let o = 0, s = 0;
    for (const g of fan.segs) {
      tmp.lerpVectors(g.from, g.to, Math.max(0.0001, easeOut((t - 0.25 - g.i * step - (g.shared ? 0.25 : 0)) / 0.45)));
      (g.shared ? buf.shared : buf.own).set([g.from.x, g.from.y, g.from.z, tmp.x, tmp.y, tmp.z], (g.shared ? s++ : o++) * 6);
    }
    const op = own.current.geometry.attributes.position, sp = shared.current.geometry.attributes.position;
    if (op) op.needsUpdate = true;
    if (sp) sp.needsUpdate = true;
    const rk = easeOut((t - 0.1) / 0.5);
    ring.current.scale.setScalar(0.6 + 0.4 * rk); ring.current.material.opacity = 0.85 * rk;
    if (t < 2) invalidate();
  });
  if (!fan || !picked || !buf) return null;
  const key = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId == null ? null : fan.keys[e.instanceId] ?? null);
  return (
    <group>
      <lineSegments ref={own}><bufferGeometry><bufferAttribute attach="attributes-position" args={[buf.own, 3]} /></bufferGeometry><lineBasicMaterial color={pal.ink} transparent opacity={0.35} /></lineSegments>
      <lineSegments ref={shared}><bufferGeometry><bufferAttribute attach="attributes-position" args={[buf.shared, 3]} /></bufferGeometry><lineBasicMaterial color={pal.ink} transparent opacity={0.6} /></lineSegments>
      <instancedMesh ref={nodes} args={[undefined, undefined, fan.nodes.length]}
        onPointerOver={(e) => { e.stopPropagation(); onKey(key(e)); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { onKey(null); document.body.style.cursor = ''; }}
        onClick={(e) => { e.stopPropagation(); const k = key(e); if (k) { void navigator.clipboard?.writeText(k); onKey(`${k} ✓`); } }}>
        <sphereGeometry args={[0.055, 20, 20]} /><meshStandardMaterial color={pal.ink} roughness={0.35} />
      </instancedMesh>
      <mesh ref={ring} position={[picked.x, picked.base + 0.004, picked.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[picked.w * 1.1, picked.w * 1.1 + 0.025, 48]} /><meshBasicMaterial color={pal.ink} transparent opacity={0} />
      </mesh>
    </group>
  );
}

export interface SceneProps {
  pal: Palette; programs: MapProgram[]; pending: Set<string>; control: Record<string, ControlFacts>; picked: MapProgram | null;
  onHover: (m: Mark | null) => void; onPick: (m: Mark | null) => void; onKey: (k: string | null) => void;
  /** Scroll progress through the pinned story, 0..1, read every frame (no React re-render per scroll). */
  scroll?: { current: number };
}

/** Whole-map shot fitted to width and depth; a pick eases the camera to frame the column, its keys and its links. */
export function Scene({ pal, programs, pending, control, picked, onHover, onPick, onKey, scroll }: SceneProps) {
  const { camera, size, invalidate } = useThree();
  const narrow = size.width < 600;
  const width = narrow ? 5 : 11, stepD = narrow ? 2.6 : 1.6;
  const marks = useMemo(() => layout(programs, width, stepD, narrow ? 18 : 40), [programs, width, stepD, narrow]);
  const pickedMark = useMemo(() => (picked ? marks.find((p) => p.id === picked.id) ?? null : null), [picked, marks]);
  const fan = useMemo(() => fanFor(pickedMark, marks, width, control), [pickedMark, marks, width, control]);
  const related = useMemo(() => (fan && pickedMark ? new Set([pickedMark.id, ...fan.related.map((q) => q.id)]) : null), [fan, pickedMark]);
  const fov = (camera as THREE.PerspectiveCamera).fov;
  const shot = useMemo(() => {
    const vf = THREE.MathUtils.degToRad(fov / 2), hf = Math.atan(Math.tan(vf) * (size.width / size.height));
    if (fan && pickedMark) {
      const box = new THREE.Box3().expandByPoint(new THREE.Vector3(pickedMark.x, pickedMark.base, pickedMark.z));
      fan.nodes.forEach((v) => box.expandByPoint(v));
      fan.related.forEach((q) => { box.expandByPoint(new THREE.Vector3(q.x, q.base, q.z)); box.expandByPoint(new THREE.Vector3(q.x, q.base + q.h, q.z)); });
      const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const usable = narrow ? 0.92 : 0.62, usableV = narrow ? 0.4 : 0.9;
      const d = Math.max((sz.x / 2 + 0.6) / (Math.tan(hf) * usable), (sz.y / 2 + 0.6) / (Math.tan(vf) * usableV), 4.5);
      const look = c.clone();
      if (narrow) look.y -= Math.tan(vf) * d * 0.55; else look.x += Math.tan(hf) * d * (1 - usable); // clear of panel / sheet
      return { look, pos: look.clone().add(new THREE.Vector3(0.12, narrow ? 0.38 : 0.32, 1).normalize().multiplyScalar(d)) };
    }
    return null;
  }, [fan, pickedMark, fov, size.width, size.height, narrow]);
  // Scroll story: the whole map, a close shot of each step (Stage 0 up to 3, aimed at its biggest program), the
  // whole map again. Without a scroll ref (or with reduced motion) the camera holds the whole-map shot.
  const shots = useMemo(() => {
    const vf = THREE.MathUtils.degToRad(fov / 2), hf = Math.atan(Math.tan(vf) * (size.width / size.height));
    const d = Math.max((width / 2 + (narrow ? 0.4 : 1.3)) / Math.tan(hf), ((stepD * 4 * 0.5 + 1.4) / Math.tan(vf)) * (narrow ? 0.85 : 0.5));
    const whole = { pos: new THREE.Vector3(0, narrow ? d * 0.95 : 0.6 + d * 0.5, narrow ? d * 0.55 - 1.6 : d * 0.88 - 2.4), look: new THREE.Vector3(0, 0.75, -1.75 * stepD) };
    const close = (st: number) => {
      const top = marks.filter((p) => p.stage === st).sort((a, b) => b.usd - a.usd)[0];
      const x = THREE.MathUtils.clamp(top ? top.x + width * 0.12 : 0, -width * 0.3, width * 0.3);
      const look = new THREE.Vector3(narrow ? 0 : x, st * 0.55 + 0.4, -st * stepD);
      return { pos: look.clone().add(new THREE.Vector3(narrow ? 0 : 1.4, narrow ? 4.4 : 2.6, narrow ? 6.8 : 6.0)), look };
    };
    return [whole, close(0), close(1), close(2), close(3), whole];
  }, [fov, size.width, size.height, width, narrow, stepD, marks]);
  const goal = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() }), []);
  const look = useRef<THREE.Vector3 | null>(null);
  const reduced = prefersReduced();
  useEffect(() => { invalidate(); }, [shot, shots, invalidate]);
  useFrame(() => {
    if (shot) { goal.pos.copy(shot.pos); goal.look.copy(shot.look); }
    else {
      const p = reduced ? 0 : Math.min(1, Math.max(0, scroll?.current ?? 0));
      const f = p * (shots.length - 1), i = Math.min(shots.length - 2, Math.floor(f)), k = f - i, e = k * k * (3 - 2 * k);
      goal.pos.lerpVectors(shots[i]!.pos, shots[i + 1]!.pos, e);
      goal.look.lerpVectors(shots[i]!.look, shots[i + 1]!.look, e);
    }
    const first = !look.current;
    if (!look.current) look.current = goal.look.clone();
    const t = first || reduced ? 1 : 0.14;
    camera.position.lerp(goal.pos, t);
    look.current.lerp(goal.look, t);
    camera.lookAt(look.current);
    if (camera.position.distanceToSquared(goal.pos) > 1e-6 || look.current.distanceToSquared(goal.look) > 1e-6) invalidate();
  });
  return (
    <>
      <hemisphereLight args={pal.sky} />
      <directionalLight position={[-5, 9, 6]} intensity={1.6} color="#fffaf0" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
      <Steps key={narrow ? 'n' : 'w'} width={width} stepD={stepD} pal={pal} />
      <Columns pal={pal} marks={marks} pending={pending} related={related} onHover={onHover} onPick={onPick} />
      <SignerFan pal={pal} fan={fan} picked={pickedMark} onKey={onKey} />
      <Beacons marks={marks} pending={pending} />
    </>
  );
}
