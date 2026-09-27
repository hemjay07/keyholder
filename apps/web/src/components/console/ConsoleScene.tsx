"use client";

// The launch console, mounted client-side after text (LCP must not wait on WebGL).
// REVAMP 1: studio lightformers instead of an HDR download, bloom on the
// lamps only, a camera fit that accounts for the panel's turn (the right edge
// was clipped at 1280), and a small turn toward the pointer. Front-on and
// still under reduced motion or at phone width; static fallback without WebGL.
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import Console, { ConsoleMotion, type ConsoleData } from "./Console";
import ConsoleFallback from "./ConsoleFallback";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth <= 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const BASE_YAW = -0.32;

/** Holds the three-quarter pose and turns a little toward the pointer. */
function Rig({ still, children }: { still: boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const { invalidate } = useThree();
  useEffect(() => {
    if (still) return;
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
      invalidate();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [still, invalidate]);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const yaw = still ? 0 : BASE_YAW + pointer.current.x * 0.08;
    const pitch = still ? 0 : pointer.current.y * 0.05;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, yaw, 6, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, pitch, 6, dt);
    if (Math.abs(g.rotation.y - yaw) > 0.0005 || Math.abs(g.rotation.x - pitch) > 0.0005) state.invalidate();
  });
  return (
    <group ref={group} rotation-y={still ? 0 : BASE_YAW}>
      {children}
    </group>
  );
}

function FitCamera({ still, wide = false }: { still: boolean; wide?: boolean }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const halfFov = (persp.fov * Math.PI) / 360;
    // Panel is 3.9 x 3.28; turned, its near edge grows, so fit with margin.
    const halfW = (still ? 2.06 : 2.42) + (wide ? 0.95 : 0);
    const halfH = (still ? 1.74 : 1.86) + (wide ? 0.25 : 0);
    const d = Math.max(halfW / (Math.tan(halfFov) * Math.max(aspect, 0.001)), halfH / Math.tan(halfFov));
    camera.position.set(still ? 0 : 0.35, still ? -0.02 : 0.25, d);
    camera.lookAt(wide ? 0.25 : 0, wide ? -0.2 : -0.02, 0);
    persp.updateProjectionMatrix();
  }, [size.width, size.height, camera, still, wide]);
  return null;
}

function Studio() {
  // A studio built from lightformers: one broad key from upper left, a rim
  // strip from the right, a soft fill from below. Warm, token-coloured.
  return (
    <>
      {/* Photographed studio (Poly Haven studio_small_09, CC0) for real metal reflections, */}
      <Environment files="/hdri/studio_small_09_512.hdr" environmentIntensity={0.9} />
    </>
  );
}

/** A second console that slides in beside the first (the replay's second multisig). */
function Companion({ data, reduced }: { data: ConsoleData | null; reduced: boolean }) {
  const g = useRef<THREE.Group>(null);
  const shown = useRef(data ? 1 : 0);
  const last = useRef<ConsoleData | null>(data);
  if (data) last.current = data;
  useFrame((state, dt) => {
    const target = data ? 1 : 0;
    shown.current = reduced ? target : THREE.MathUtils.damp(shown.current, target, 7, Math.min(dt, 0.05));
    if (g.current) {
      g.current.position.x = 2.55 + (1 - shown.current) * 2.2;
      g.current.visible = shown.current > 0.01;
    }
    if (Math.abs(shown.current - target) > 0.001) state.invalidate();
  });
  if (!last.current) return null;
  return (
    <group ref={g} position={[4.75, -0.95, -0.6]} scale={0.46} rotation-y={-0.18}>
      <Console data={last.current} />
    </group>
  );
}

function Scene({ data, companion, reduced, mobile }: { data: ConsoleData; companion: ConsoleData | null | undefined; reduced: boolean; mobile: boolean }) {
  const still = reduced || mobile;
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.88 }}
      camera={{ position: [0.35, 0.25, 5.4], fov: 28 }}
      frameloop="demand"
      resize={{ offsetSize: true }}
    >
      <FitCamera still={still} wide={companion !== undefined} />

      <ambientLight intensity={0.25} color="#FFF6E9" />
      <directionalLight position={[-2.5, 3.2, 3]} intensity={0.55} color="#FFF1DE" />
      <Suspense fallback={null}>
        <Studio />
        <ConsoleMotion.Provider value={{ reduced }}>
          <Rig still={still}>
            <group position-x={companion !== undefined ? -0.55 : 0}>
              <Console data={data} />
            </group>
            {companion !== undefined && <Companion data={companion} reduced={reduced} />}
          </Rig>
        </ConsoleMotion.Provider>
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={1.0} luminanceSmoothing={0.1} radius={0.6} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}

// After the first console has mounted, later pages mount theirs at once: waiting a
// frame showed the flat fallback first, and the page transition captured that flash.
let booted = false;
let webglOk: boolean | null = null;

export default function ConsoleScene({ data, companion }: { data: ConsoleData; companion?: ConsoleData | null }) {
  const reduced = useReducedMotion();
  const mobile = useMobile();
  const [mounted, setMounted] = useState(booted);
  const [webgl, setWebgl] = useState(webglOk ?? true);

  useEffect(() => {
    if (webglOk === null) webglOk = hasWebGL();
    setWebgl(webglOk);
    if (booted) return;
    // First console on the site: mount after the first paint so it never delays LCP.
    const id = requestAnimationFrame(() => {
      booted = true;
      setMounted(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Phones get the flat, readable console: the 3D one is too small to read there
  // and the most expensive thing on the page (founder, 2026-09-27).
  if (!webgl || mobile) return <ConsoleFallback data={data} />;
  if (!mounted) return <div className="console-canvas" aria-hidden="true" />;

  return (
    <div data-device="console" className="console-canvas">
      <Scene data={data} companion={companion} reduced={reduced} mobile={mobile} />
    </div>
  );
}
