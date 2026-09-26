import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree, invalidate } from "@react-three/fiber";
import { Environment, ContactShadows, ScrollControls, useScroll } from "@react-three/drei";
import Console from "./Console.jsx";
import { stateFromQuery } from "./state.js";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
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

// scroll-controls-3d: the console turns from three-quarter view to front, once, as the reader scrolls.
function Rig({ reduced }) {
  const scroll = useScroll();
  const group = useRef();
  useFrame(() => {
    const offset = reduced ? 0 : scroll.offset;
    const k = Math.min(1, offset * 1.4);
    if (group.current) {
      group.current.rotation.y = -0.4 + 0.4 * k;
      group.current.position.x = -0.14 + 0.14 * k;
    }
  });
  const data = stateFromQuery();
  return (
    <group ref={group}>
      <Console data={data} />
    </group>
  );
}

// The panel's real width is fixed; the camera distance is not. At a narrow (portrait)
// viewport the same field of view crops the slab, so the rig re-frames it on every resize
// rather than shipping a phone-specific fov hack. At phone width the panel is framed
// front-on and zoomed to the KEYS+TIME rows (the ones the judge asked to keep legible),
// rather than shrinking the whole object to a thumbnail.
function FitCamera({ mobile }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    const halfFov = (camera.fov * Math.PI) / 360;
    if (mobile) {
      // Fit the row content's real width (labels run to x=-1.62, numbers to x=+1.62) exactly
      // to the viewport, cropping the decorative bezel rather than any text; look at the
      // midpoint of KEYS and TIME so those two rows sit in the readable centre of a portrait
      // frame, and let the CODE/LAST rows fall into the (still visible, if tighter) bottom.
      const targetHalfWidth = 1.8;
      const d = targetHalfWidth / (Math.tan(halfFov) * Math.max(aspect, 0.001));
      camera.position.set(0, 0, d);
      camera.lookAt(0, 0.42, 0);
    } else {
      const targetHalfWidth = 1.95;
      const d = targetHalfWidth / (Math.tan(halfFov) * Math.max(aspect, 0.001));
      camera.position.set(0.5 * Math.min(1, aspect), 0.4, Math.max(4.8, d));
      camera.lookAt(0, -0.05, 0);
    }
    camera.updateProjectionMatrix();
  }, [size.width, size.height, camera, mobile]);
  return null;
}

// The entrance (keys turning, needle settling, lamps fading in) is the only thing that
// needs a continuous render loop; nothing loops after it (MOTION-RULES 6/7). Once it has
// played out the canvas drops to on-demand, which is what a static instrument should cost.
function EntranceClock({ ms = 1700 }) {
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

export default function App() {
  const reduced = useReducedMotion();
  const mobile = useMobile();
  const data = stateFromQuery();
  // At phone width the object is framed front-on and stays still: the scroll-driven
  // three-quarter turn only reads at a width wide enough to see it happen.
  const frontOn = reduced || mobile;
  return (
    <div data-device="console" style={{ position: "fixed", inset: 0 }}>
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
        {/* the device sits on the page's own paper ground (CHARTER "console bg"), not a
            dark studio box, so it reads as part of the world rather than floating in it */}
        <color attach="background" args={["#E6E2D9"]} />
        <ambientLight intensity={0.5} color="#FFF6E9" />
        <directionalLight position={[2.5, 3.5, 2.5]} intensity={1.5} color="#FFF1DE" castShadow />
        <directionalLight position={[-3, 1.5, -2]} intensity={0.45} color="#FFEBD2" />
        <Suspense fallback={null}>
          <Environment files="/hdri/wooden_studio_17_1k.hdr" resolution={256} />
          {frontOn ? (
            <group scale={1.05}>
              <Console data={data} />
            </group>
          ) : (
            <ScrollControls pages={1.3} damping={4}>
              <Rig reduced={reduced} />
            </ScrollControls>
          )}
          <mesh rotation-x={-Math.PI / 2} position={[0, -1.15, 0]} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#E6E2D9" roughness={1} />
          </mesh>
          <ContactShadows position={[0, -1.1, 0]} resolution={256} scale={6} blur={1.8} far={1.4} opacity={0.55} color="#2a2620" frames={reduced ? 1 : Infinity} />
        </Suspense>
      </Canvas>
    </div>
  );
}
