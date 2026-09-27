"use client";

// The launch console, mounted client-side after text (LCP must not wait on WebGL).
// REVAMP 1: studio lightformers instead of an HDR download, bloom on the
// lamps only, a camera fit that accounts for the panel's turn (the right edge
// was clipped at 1280), and a small turn toward the pointer. Front-on and
// still under reduced motion or at phone width; static fallback without WebGL.
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, ContactShadows } from "@react-three/drei";
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
    const check = () => setMobile(window.innerWidth < 600);
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

function FitCamera({ still }: { still: boolean }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const halfFov = (persp.fov * Math.PI) / 360;
    // Panel is 3.9 x 3.28; turned, its near edge grows, so fit with margin.
    const halfW = still ? 2.02 : 2.2;
    const halfH = still ? 1.72 : 1.8;
    const d = Math.max(halfW / (Math.tan(halfFov) * Math.max(aspect, 0.001)), halfH / Math.tan(halfFov));
    camera.position.set(still ? 0 : 0.35, still ? -0.02 : 0.25, d);
    camera.lookAt(0, -0.02, 0);
    persp.updateProjectionMatrix();
  }, [size.width, size.height, camera, still]);
  return null;
}

function Studio() {
  // A studio built from lightformers: one broad key from upper left, a rim
  // strip from the right, a soft fill from below. Warm, token-coloured.
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#E6E2D9"]} />
      <Lightformer form="rect" intensity={1.3} color="#FFF4E6" position={[-3, 3, 4]} scale={[6, 3, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.4} color="#FFFFFF" position={[4, 0.5, 2]} scale={[0.5, 5, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0.6} color="#E9DFCB" position={[0, -3, 3]} scale={[8, 1, 1]} target={[0, 0, 0]} />
      <Lightformer form="circle" intensity={0.8} color="#FFFFFF" position={[0, 4, -2]} scale={2} target={[0, 0, 0]} />
    </Environment>
  );
}

function Scene({ data, reduced, mobile }: { data: ConsoleData; reduced: boolean; mobile: boolean }) {
  const still = reduced || mobile;
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.88 }}
      camera={{ position: [0.35, 0.25, 5.4], fov: 28 }}
      frameloop="demand"
    >
      <FitCamera still={still} />
      <color attach="background" args={["#E6E2D9"]} />
      <ambientLight intensity={0.25} color="#FFF6E9" />
      <directionalLight position={[-2.5, 3.2, 3]} intensity={0.55} color="#FFF1DE" />
      <Suspense fallback={null}>
        <Studio />
        <ConsoleMotion.Provider value={{ reduced }}>
          <Rig still={still}>
            <Console data={data} />
          </Rig>
        </ConsoleMotion.Provider>
        <ContactShadows position={[0, -1.75, 0]} resolution={512} scale={12} blur={2.6} far={1.8} opacity={0.45} color="#2a2620" frames={1} />
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={1.0} luminanceSmoothing={0.1} radius={0.6} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}

export default function ConsoleScene({ data }: { data: ConsoleData }) {
  const reduced = useReducedMotion();
  const mobile = useMobile();
  const [mounted, setMounted] = useState(false);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    setWebgl(hasWebGL());
    // Mount the canvas after the first paint so the console never delays LCP.
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!mounted || !webgl) {
    return <ConsoleFallback data={data} />;
  }

  return (
    <div data-device="console" className="console-canvas">
      <Scene data={data} reduced={reduced} mobile={mobile} />
    </div>
  );
}
