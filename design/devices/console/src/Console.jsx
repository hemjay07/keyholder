import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { DIAL_CAP_S, DIAL_START, DIAL_END, dialFrac, dialAngle, needleRotationZ } from "./dialMath.js";

// MOTION.md durations: tick 90ms (lamp), element 240ms (key turn), data 320ms (needle spring).
const T_TICK = 0.09;
const T_ELEMENT = 0.24;
const T_DATA = 0.32;

// Warm-grey painted aluminium instrument (plan/CREATIVE.md v3 SS2/SS4): a light painted
// face carries ink text at real contrast; the body is a darker anodised chassis around it.
const PANEL_BODY = "#DDD4C0"; // outer chassis, brushed aluminium (warmed per CHARTER)
const PANEL_BODY_TRIM = "#BFB49B"; // bezel/chamfer shadow ring
const PANEL_FACE = "#F1EAD9"; // painted face plate — warm cream, so ink reads at >=7:1
const INK = "#1B1A17"; // primary engraved ink (contrast vs PANEL_FACE ~16:1)
const INK_SOFT = "#3A362E"; // secondary ink, still >10:1 on the face
const SOCKET_RING = "#948C7B"; // metal rim lighting the socket edge — not a black hole
const SOCKET_VOID = "#26221A"; // recessed void, not pure black
const KEY_METAL = "#EAE5D7"; // brushed turned-key metal, lit
const KEY_METAL_SHADOW = "#B7AF9E";
const READOUT_BG = "#26221A";
const READOUT_INK = "#EAE5D7";
const WEAKENED = "#FF5A1F";
const VERIFIED_ON = "#1F6B4A";
const LAMP_OFF = "#3A362E";
const SCREW_METAL = "#9E9581";

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x) => {
  const c1 = 1.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

function usePanelTextures() {
  // Real PBR maps (ambientCG "Metal027", CC0), downsampled to 256px / ~1.6KB each so the
  // subtle roughness/normal break-up costs almost nothing against the page's 3000KB budget.
  // See public/textures/*.SOURCE.json for provenance.
  const [rough, normal] = useTexture([
    "/textures/panel_roughness_256.jpg",
    "/textures/panel_normal_256.jpg",
  ]);
  useMemo(() => {
    for (const t of [rough, normal]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(2.2, 1.3);
    }
  }, [rough, normal]);
  return { rough, normal };
}

// A turned key: a metal shaft, a knurled head, and a flat bit — reads as a real key,
// not a knob. The whole group rotates 90deg on turn (MOTION-RULES element: 240ms).
function KeySlot({ x, turned, delay }) {
  const group = useRef();
  const start = useRef(null);
  useFrame((_, dt) => {
    if (start.current === null) start.current = 0;
    start.current += dt;
    const t = Math.max(0, Math.min(1, (start.current - delay) / T_ELEMENT));
    const eased = turned ? easeOutBack(t) : 0;
    const target = turned ? -Math.PI / 2 + eased * (Math.PI / 2) : -Math.PI / 2;
    if (group.current) group.current.rotation.z = target;
  });
  return (
    <group position={[x, 0, 0]}>
      {/* recessed socket: a lit metal rim around a dark (not pure-black) void gives it depth */}
      <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.082]}>
        <cylinderGeometry args={[0.1, 0.1, 0.014, 28]} />
        <meshStandardMaterial color={SOCKET_RING} roughness={0.32} metalness={0.75} />
      </mesh>
      {/* torusGeometry already faces +Z by default; unlike the cylinders here it needs no rotation */}
      <mesh position={[0, 0, 0.076]}>
        <torusGeometry args={[0.078, 0.006, 10, 28]} />
        <meshStandardMaterial color={SOCKET_RING} roughness={0.25} metalness={0.9} emissive={SOCKET_RING} emissiveIntensity={0.08} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.07]}>
        <cylinderGeometry args={[0.072, 0.072, 0.02, 24]} />
        <meshStandardMaterial color={SOCKET_VOID} roughness={0.85} metalness={0.15} />
      </mesh>
      {turned && (
        <group ref={group} position={[0, 0, 0.09]}>
          {/* shaft */}
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.026, 0.026, 0.17, 18]} />
            <meshStandardMaterial color={KEY_METAL} roughness={0.24} metalness={0.88} />
          </mesh>
          {/* knurled head */}
          <mesh position={[0, 0, 0]}>
            <torusGeometry args={[0.055, 0.017, 12, 28]} />
            <meshStandardMaterial color={KEY_METAL} roughness={0.24} metalness={0.88} />
          </mesh>
          {/* the cut bit, so the head reads as a key and not a knob */}
          <mesh position={[0.05, 0.16, 0]} rotation-z={0.15}>
            <boxGeometry args={[0.05, 0.022, 0.01]} />
            <meshStandardMaterial color={KEY_METAL_SHADOW} roughness={0.35} metalness={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// A large round instrument gauge: printed 0 / 1H / 24H / 48H scale (sqrt-spaced so the
// low end — where every real timelock value in this product actually lives — is legible),
// a needle with a hub, and the 0 stop marked in the signal colour (the hard-stop reading
// is the weakened state).
const DIAL_TICKS = [
  { h: 0, label: "0", hard: true },
  { h: 1, label: "1H", hard: false },
  { h: 24, label: "24H", hard: false },
  { h: 48, label: "48H", hard: false },
];

function TimelockDial({ seconds }) {
  const R = 0.38;
  const needle = useRef();
  const targetAngle = dialAngle(dialFrac(seconds));
  const elapsed = useRef(0);
  useFrame((_, dt) => {
    elapsed.current += dt;
    const t = Math.max(0, Math.min(1, (elapsed.current - 0.12) / T_DATA));
    const eased = easeOutCubic(t);
    const start = dialAngle(1); // parked at full sweep, settles down to the live value
    const angle = start + (targetAngle - start) * eased;
    // needleRotationZ, not `angle` itself: the tick marks are placed at [sin(a), cos(a)]
    // but three.js rotates the needle's [0,1] tip to [-sin(t), cos(t)] for rotation.z = t,
    // so the needle must be rotated by -angle to land on the same point as the tick.
    if (needle.current) needle.current.rotation.z = needleRotationZ(angle);
  });
  return (
    <group position={[0, 0, 0.082]}>
      {/* gauge face: painted, same light plate as the rest of the panel */}
      <mesh position={[0, 0, -0.006]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[R, R, 0.016, 40]} />
        <meshStandardMaterial color={PANEL_FACE} roughness={0.6} metalness={0.15} />
      </mesh>
      {/* bezel ring */}
      <mesh position={[0, 0, -0.01]}>
        <torusGeometry args={[R + 0.012, 0.014, 12, 48]} />
        <meshStandardMaterial color={PANEL_BODY_TRIM} roughness={0.4} metalness={0.6} />
      </mesh>
      {DIAL_TICKS.map((tk, i) => {
        const a = dialAngle(dialFrac(tk.h * 3600));
        const rTick = R - 0.045;
        const rLabel = R - 0.11;
        return (
          <group key={i}>
            <mesh position={[Math.sin(a) * rTick, Math.cos(a) * rTick, 0.006]} rotation={[0, 0, -a]}>
              <boxGeometry args={[0.012, tk.hard ? 0.06 : 0.035, 0.01]} />
              <meshStandardMaterial
                color={tk.hard ? WEAKENED : INK}
                emissive={tk.hard ? WEAKENED : "#000000"}
                emissiveIntensity={tk.hard ? 0.5 : 0}
              />
            </mesh>
            <Text
              position={[Math.sin(a) * rLabel, Math.cos(a) * rLabel, 0.01]}
              fontSize={0.045}
              color={tk.hard ? WEAKENED : INK}
              font={FONT}
              letterSpacing={0.04}
              anchorX="center"
              anchorY="middle"
            >
              {tk.label}
            </Text>
          </group>
        );
      })}
      {/* needle: hub + pointer, resting exactly at the live value */}
      <group ref={needle} position={[0, 0, 0.014]}>
        <mesh position={[0, R * 0.42, 0]}>
          <boxGeometry args={[0.018, R * 0.84, 0.012]} />
          <meshStandardMaterial color={INK} roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.032, 0.032, 0.02, 20]} />
          <meshStandardMaterial color={SCREW_METAL} roughness={0.25} metalness={0.85} />
        </mesh>
        <mesh position={[0, 0, 0.011]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.012, 0.012, 0.006, 16]} />
          <meshStandardMaterial color={INK} roughness={0.4} metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function Lamp({ x, on, color, delay }) {
  const mat = useRef();
  const elapsed = useRef(0);
  useFrame((_, dt) => {
    elapsed.current += dt;
    const t = Math.max(0, Math.min(1, (elapsed.current - delay) / T_TICK));
    const target = on ? 1.6 : 0.05;
    if (mat.current) mat.current.emissiveIntensity = target * (on ? t : 1);
  });
  return (
    <mesh position={[x, 0, 0.086]} rotation-x={Math.PI / 2}>
      <cylinderGeometry args={[0.045, 0.045, 0.02, 20]} />
      <meshStandardMaterial ref={mat} color={LAMP_OFF} emissive={color} emissiveIntensity={0.05} roughness={0.35} metalness={0.2} />
    </mesh>
  );
}

// A screw head, purely decorative bezel detail — fixed, never animated.
function Screw({ x, y }) {
  return (
    <group position={[x, y, 0.086]}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.032, 0.032, 0.012, 20]} />
        <meshStandardMaterial color={SCREW_METAL} roughness={0.3} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.008]} rotation-z={0.5}>
        <boxGeometry args={[0.05, 0.007, 0.004]} />
        <meshStandardMaterial color="#54503f" roughness={0.6} metalness={0.4} />
      </mesh>
    </group>
  );
}

const FONT = "/fonts/GeistMono-Regular.ttf";

function RowLabel({ y, children }) {
  return (
    <Text
      position={[-1.62, y, 0.093]}
      fontSize={0.075}
      color={INK_SOFT}
      font={FONT}
      letterSpacing={0.14}
      anchorX="left"
      anchorY="middle"
    >
      {children}
    </Text>
  );
}

export default function Console({ data }) {
  const { protocol, threshold, members, timelockSeconds, verified, weakened, label } = data;
  const { rough, normal } = usePanelTextures();

  const socketXs = useMemo(() => {
    const n = Math.max(members, 1);
    const startX = -0.95, endX = 0.55;
    if (n === 1) return [startX];
    const step = (endX - startX) / (n - 1);
    return Array.from({ length: n }, (_, i) => startX + step * i);
  }, [members]);

  // Fixed row geometry, checked by hand for clearance against the enlarged dial (R=0.38)
  // and against the panel/face bounds below — nothing here overlaps at rest.
  const PANEL_H = 3.1;
  const FACE_H = 2.8;
  const Y_NAME = 1.24;
  const Y_KEYS = 0.82;
  const Y_TIME = 0.02;
  const Y_CODE = -0.86;
  const Y_LAST = -1.24;

  return (
    <group>
      {/* chamfer/bezel: a slightly larger, darker trim sits behind the body to read as a bevel */}
      <RoundedBox args={[3.86, PANEL_H + 0.14, 0.15]} radius={0.07} smoothness={4} position={[0, 0, -0.02]}>
        <meshStandardMaterial color={PANEL_BODY_TRIM} roughness={0.5} metalness={0.5} />
      </RoundedBox>
      {/* the slab: warm-grey anodised aluminium body, modelled from real dimensions */}
      <RoundedBox args={[3.7, PANEL_H, 0.16]} radius={0.045} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color={PANEL_BODY} roughness={0.5} roughnessMap={rough} normalMap={normal} metalness={0.6} />
      </RoundedBox>
      {/* painted face plate: light, so engraved ink reads at real contrast */}
      <RoundedBox args={[3.42, FACE_H, 0.02]} radius={0.03} smoothness={4} position={[0, 0, 0.075]}>
        <meshStandardMaterial color={PANEL_FACE} roughness={0.65} roughnessMap={rough} metalness={0.1} />
      </RoundedBox>

      {/* corner screws */}
      <Screw x={-1.72} y={PANEL_H / 2 - 0.18} />
      <Screw x={1.72} y={PANEL_H / 2 - 0.18} />
      <Screw x={-1.72} y={-(PANEL_H / 2 - 0.18)} />
      <Screw x={1.72} y={-(PANEL_H / 2 - 0.18)} />

      {/* protocol nameplate */}
      <Text position={[-1.62, Y_NAME, 0.093]} fontSize={0.09} color={INK} font={FONT} letterSpacing={0.1} anchorX="left">
        {protocol}
      </Text>
      <group position={[0.92, Y_NAME, 0]}>
        <Lamp x={0} on={weakened} color={WEAKENED} delay={0.55} />
      </group>
      <Text position={[1.62, Y_NAME, 0.093]} fontSize={0.078} color={weakened ? WEAKENED : INK_SOFT} font={FONT} letterSpacing={0.08} anchorX="right">
        {weakened ? "WEAKENED" : "NOMINAL"}
      </Text>

      {/* KEYS row: the turn requirement is the largest text on the panel */}
      <RowLabel y={Y_KEYS}>KEYS</RowLabel>
      <group position={[0, Y_KEYS, 0]}>
        {socketXs.map((x, i) => (
          <KeySlot key={i} x={x} turned={i < threshold} delay={0.06 + i * 0.045} />
        ))}
      </group>
      <Text position={[1.62, Y_KEYS - 0.28, 0.093]} fontSize={0.16} color={INK} font={FONT} letterSpacing={0.01} anchorX="right">
        {threshold} of {members} required
      </Text>

      {/* TIME row: a large round gauge, printed scale, needle resting at the live value */}
      <RowLabel y={Y_TIME}>TIME</RowLabel>
      <group position={[-0.62, Y_TIME, 0]}>
        <TimelockDial seconds={timelockSeconds} />
      </group>
      <Text position={[1.62, Y_TIME, 0.093]} fontSize={0.08} color={INK} font={FONT} anchorX="right">
        {timelockSeconds === 0 ? "0 h (none)" : `${(timelockSeconds / 3600).toFixed(1)} h`}
      </Text>

      {/* CODE row */}
      <RowLabel y={Y_CODE}>CODE</RowLabel>
      <group position={[-0.95, Y_CODE, 0]}>
        <Lamp x={0} on={verified} color={VERIFIED_ON} delay={0.55} />
      </group>
      <Text position={[-0.82, Y_CODE, 0.093]} fontSize={0.078} color={INK} font={FONT} anchorX="left">
        {verified ? "verified" : "not verified"}
      </Text>
      <group position={[0.55, Y_CODE, 0]}>
        <Lamp x={0} on={weakened} color={WEAKENED} delay={0.55} />
      </group>
      <Text position={[0.68, Y_CODE, 0.093]} fontSize={0.078} color={weakened ? WEAKENED : INK} font={FONT} anchorX="left">
        {weakened ? "drifted" : "current"}
      </Text>

      {/* LAST readout: a recessed window in the face, framed by a raised bezel */}
      <RowLabel y={Y_LAST}>LAST</RowLabel>
      <mesh position={[0.25, Y_LAST, 0.08]}>
        <boxGeometry args={[2.16, 0.28, 0.006]} />
        <meshStandardMaterial color={PANEL_BODY_TRIM} roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0.25, Y_LAST, 0.084]}>
        <boxGeometry args={[2.06, 0.22, 0.012]} />
        <meshStandardMaterial color={READOUT_BG} roughness={0.7} metalness={0.1} />
      </mesh>
      <Text
        position={[-0.75, Y_LAST, 0.092]}
        fontSize={0.058}
        color={READOUT_INK}
        font={FONT}
        letterSpacing={0.02}
        anchorX="left"
        maxWidth={2.0}
      >
        {label}
      </Text>
    </group>
  );
}
