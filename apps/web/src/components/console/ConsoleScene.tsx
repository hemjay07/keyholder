"use client";

// The launch console, mounted client-side after text (LCP must not wait on WebGL).
// scroll-controls-3d in the "hero" pose: a slow three-quarter turn driven by scroll.
// Front-on and still at phone width, under reduced motion, or when WebGL is unavailable.
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree, invalidate } from "@react-three/fiber";
import { Environment, ContactShadows, ScrollControls, useScroll } from "@react-three/drei";
import Console, { type ConsoleData } from "./Console";
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

function Rig({ reduced, data }: { reduced: boolean; data: ConsoleData }) {
  const scroll = useScroll();
  const group = useRef<import("three").Group>(null);
  useFrame(() => {
    const offset = reduced ? 0 : scroll.offset;
    const k = Math.min(1, offset * 1.4);
    if (group.current) {
      group.current.rotation.y = -0.4 + 0.4 * k;
      group.current.position.x = -0.14 + 0.14 * k;
    }
  });
  return (
    <group ref={group}>
      <Console data={data} />
    </group>
  );
}

function FitCamera({ mobile }: { mobile: boolean }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const persp = camera as import("three").PerspectiveCamera;
    const aspect = size.width / size.height;
    const halfFov = (persp.fov * Math.PI) / 360;
    if (mobile) {
      // Same two-axis fit as desktop, looking straight at the panel's centre, so the
      // nameplate and the LAST row both stay in frame with no empty band.
      const d = Math.max(1.95 / (Math.tan(halfFov) * Math.max(aspect, 0.001)), 1.72 / Math.tan(halfFov));
      camera.position.set(0, -0.05, d);
      camera.lookAt(0, -0.05, 0);
    } else {
      // Fit both axes: the panel's full height (nameplate to the LAST readout, whose
      // label is required by design/CHARTER.md) must stay in frame, not just its width —
      // a width-only fit crops the LAST row in a wide device-frame aspect ratio.
      const targetHalfWidth = 1.95;
      const targetHalfHeight = 1.72;
      const dWidth = targetHalfWidth / (Math.tan(halfFov) * Math.max(aspect, 0.001));
      const dHeight = targetHalfHeight / Math.tan(halfFov);
      const d = Math.max(dWidth, dHeight);
      camera.position.set(0.5 * Math.min(1, aspect), 0.4, Math.max(4.8, d));
      camera.lookAt(0, -0.05, 0);
    }
    persp.updateProjectionMatrix();
  }, [size.width, size.height, camera, mobile]);
  return null;
}

function EntranceClock({ ms = 1700 }: { ms?: number }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    invalidate();
  });
  useEffect(() => {
    const id = setTimeout(() => { done.current = true; }, ms);
    return () => clearTimeout(id);
  }, [ms]);
  return null;
}

function Scene({ data, reduced, mobile }: { data: ConsoleData; reduced: boolean; mobile: boolean }) {
  const frontOn = reduced || mobile;
  return (
    <Canvas
      dpr={[1, 1.5]}
      shadows
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ position: [0.55, 0.4, 5.1], fov: 28 }}
      onCreated={({ camera }) => camera.lookAt(0, -0.05, 0)}
      frameloop="demand"
    >
      <FitCamera mobile={mobile} />
      {!reduced && <EntranceClock />}
      <color attach="background" args={["#E6E2D9"]} />
      <ambientLight intensity={0.5} color="#FFF6E9" />
      <directionalLight position={[2.5, 3.5, 2.5]} intensity={1.5} color="#FFF1DE" castShadow />
      <directionalLight position={[-3, 1.5, -2]} intensity={0.45} color="#FFEBD2" />
      <Suspense fallback={null}>
        <Environment files="/hdri/wooden_studio_17_512.hdr" resolution={256} />
        {frontOn ? (
          <group scale={1.05}>
            <Console data={data} />
          </group>
        ) : (
          <ScrollControls pages={1.3} damping={4}>
            <Rig reduced={reduced} data={data} />
          </ScrollControls>
        )}
        <ContactShadows position={[0, -1.65, 0]} resolution={256} scale={6} blur={1.8} far={1.4} opacity={0.55} color="#2a2620" frames={reduced ? 1 : Infinity} />
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
