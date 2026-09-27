// The launch console: one protocol's control, as an instrument. REVAMP 1
// (design/REVAMP.md): machined materials, keyswitches that insert and turn,
// a glass-fronted timelock gauge, lamps with a lens, a readout that types in.
// Every part eases toward its current data, so a page can drive the console
// through a story (home, replay, proof) by changing its props.
"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { dialFrac, dialAngle, needleRotationZ } from "./dialMath.js";
import { Bezel, BackPlate, Face, Turned } from "./parts";

// MOTION.md: element 240 ms (key turn), data 320 ms (needle), tick 90 ms (lamp).
// Damping rates chosen so each settles within its budget.
const RATE_KEY = 16;
const RATE_NEEDLE = 11;
const RATE_LAMP = 26;
const EPS = 0.001;

// Palette: token-derived. Bone enamel face in a deep anodised bezel.
const BEZEL = "#2B2822";
const BEZEL_EDGE = "#6B6357";
const FACE = "#F1EAD9";
const INK = "#1B1A17";
const INK_SOFT = "#4A453C";
const STEEL = "#D9D4C7";
const STEEL_DARK = "#8C8575";
const SOCKET_VOID = "#1A1814";
const READOUT_BG = "#171512";
const READOUT_INK = "#F1EAD9";
const WEAKENED = "#FF5A1F";
const VERIFIED_ON = "#2FA36F";
const LAMP_GLASS = "#3A342B";

const FONT = "/fonts/GeistMono-Regular.ttf";
const READOUT_FONT = "/fonts/DepartureMono-Regular.otf";

/** Reduced motion: every part snaps to its target. */
export const ConsoleMotion = createContext({ reduced: false });

function damp(current: number, target: number, rate: number, dt: number, reduced: boolean): number {
  if (reduced) return target;
  return THREE.MathUtils.damp(current, target, rate, Math.min(dt, 0.05));
}

function usePanelTextures() {
  const [rough, normal] = useTexture(["/textures/panel_roughness_256.jpg", "/textures/panel_normal_256.jpg"]);
  useMemo(() => {
    for (const t of [rough, normal] as THREE.Texture[]) {
      if (!t) continue;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(2.2, 1.3);
    }
  }, [rough, normal]);
  return { rough, normal };
}

/** A keyswitch: bezel ring, recessed socket; the key slides in and turns when counted. */
function KeySlot({ turned, delay }: { turned: boolean; delay: number }) {
  const { reduced } = useContext(ConsoleMotion);
  const key = useRef<THREE.Group>(null);
  const progress = useRef(turned && reduced ? 1 : 0);
  const wait = useRef(delay);
  useEffect(() => {
    wait.current = delay;
  }, [turned, delay]);
  useFrame((state, dt) => {
    if (wait.current > 0 && !reduced) {
      wait.current -= dt;
      state.invalidate();
      return;
    }
    const target = turned ? 1 : 0;
    progress.current = damp(progress.current, target, RATE_KEY, dt, reduced);
    const p = progress.current;
    if (key.current) {
      key.current.visible = p > 0.01;
      // Insert over the first 40 %, turn over the rest.
      const insert = Math.min(1, p / 0.4);
      const turn = Math.max(0, (p - 0.4) / 0.6);
      key.current.position.z = 0.09 + (1 - insert) * 0.12;
      key.current.rotation.z = -Math.PI / 2 + turn * (Math.PI / 2);
    }
    if (Math.abs(p - target) > EPS) state.invalidate();
  });
  return (
    <group>
      {/* turned key well: raised chamfered rim, recessed floor, keyway */}
      <Turned profile={[[0, 0.074], [0.026, 0.074], [0.026, 0.08], [0.066, 0.08], [0.074, 0.094], [0.094, 0.097], [0.104, 0.089]]} color={STEEL} roughness={0.22} />
      <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.078]}>
        <cylinderGeometry args={[0.026, 0.026, 0.01, 20]} />
        <meshStandardMaterial color={SOCKET_VOID} roughness={0.9} metalness={0.1} />
      </mesh>
      {/* the key */}
      <group ref={key} position={[0, 0, 0.2]} visible={false}>
        {/* barrel: many facets read as knurling under the lightformers */}
        <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.012]}>
          <cylinderGeometry args={[0.034, 0.038, 0.05, 32]} />
          <meshStandardMaterial color={STEEL} roughness={0.18} metalness={1} />
        </mesh>
        {/* bow */}
        <RoundedBox args={[0.085, 0.16, 0.024]} radius={0.018} smoothness={3} position={[0, 0.095, 0.03]}>
          <meshStandardMaterial color={STEEL} roughness={0.16} metalness={1} />
        </RoundedBox>
        <mesh position={[0, 0.13, 0.043]}>
          <torusGeometry args={[0.018, 0.005, 8, 24]} />
          <meshStandardMaterial color={STEEL_DARK} roughness={0.3} metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

const DIAL_TICKS = [
  { h: 0, label: "0", hard: true },
  { h: 1, label: "1H", hard: false },
  { h: 24, label: "24H", hard: false },
  { h: 48, label: "48H", hard: false },
];

/** Glass-fronted timelock gauge; the needle swings to the timelock. */
function TimelockDial({ seconds, hideNeedle = false }: { seconds: number; hideNeedle?: boolean }) {
  const { reduced } = useContext(ConsoleMotion);
  const R = 0.38;
  const needle = useRef<THREE.Group>(null);
  const target = dialAngle(dialFrac(seconds));
  const angle = useRef(reduced ? target : dialAngle(1));
  useFrame((state, dt) => {
    angle.current = damp(angle.current, target, RATE_NEEDLE, dt, reduced);
    if (needle.current) needle.current.rotation.z = needleRotationZ(angle.current);
    if (Math.abs(angle.current - target) > EPS) state.invalidate();
  });
  return (
    <group position={[0, 0, 0.082]}>
      {/* turned dial bezel with a chamfered lip */}
      <Turned profile={[[R - 0.004, 0.034], [R + 0.01, 0.036], [R + 0.034, 0.024], [R + 0.046, 0.004], [R + 0.05, -0.006]]} color={STEEL} roughness={0.2} segments={72} z={-0.006} />
      {/* printed face */}
      <mesh position={[0, 0, -0.006]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[R, R, 0.012, 64]} />
        <meshStandardMaterial color="#F4EEDF" roughness={0.6} metalness={0.02} />
      </mesh>
      {/* scale arc */}
      <mesh position={[0, 0, 0.001]}>
        {/* dialAngle measures clockwise from 12 o'clock; ringGeometry counter-clockwise from 3 o'clock */}
        <ringGeometry args={[R - 0.022, R - 0.012, 64, 1, Math.PI / 2 - dialAngle(1), dialAngle(1) - dialAngle(0)]} />
        <meshBasicMaterial color={INK} side={THREE.DoubleSide} />
      </mesh>
      {DIAL_TICKS.map((tk, i) => {
        const a = dialAngle(dialFrac(tk.h * 3600));
        const rTick = R - 0.05;
        const rLabel = R - 0.15;
        return (
          <group key={i}>
            <mesh position={[Math.sin(a) * rTick, Math.cos(a) * rTick, 0.004]} rotation={[0, 0, -a]}>
              <boxGeometry args={[0.014, tk.hard ? 0.07 : 0.04, 0.006]} />
              <meshStandardMaterial color={tk.hard ? WEAKENED : INK} emissive={tk.hard ? WEAKENED : "#000"} emissiveIntensity={tk.hard ? 0.6 : 0} />
            </mesh>
            <Text position={[Math.sin(a) * rLabel, Math.cos(a) * rLabel, 0.006]} fontSize={0.046} color={tk.hard ? WEAKENED : INK} font={FONT} letterSpacing={0.04} anchorX="center" anchorY="middle">
              {tk.label}
            </Text>
          </group>
        );
      })}
      {/* needle with counterweight */}
      <group ref={needle} position={[0, 0, 0.016]} visible={!hideNeedle}>
        <mesh position={[0, R * 0.4, 0]}>
          <boxGeometry args={[0.014, R * 0.8, 0.008]} />
          <meshStandardMaterial color={INK} roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[0, -0.07, 0]}>
          <boxGeometry args={[0.03, 0.06, 0.008]} />
          <meshStandardMaterial color={INK} roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.03, 0.03, 0.018, 24]} />
          <meshStandardMaterial color={STEEL_DARK} roughness={0.2} metalness={0.95} />
        </mesh>
      </group>
      {/* glass */}
      <mesh position={[0, 0, 0.03]} rotation-x={Math.PI / 2} renderOrder={2}>
        <cylinderGeometry args={[R + 0.006, R + 0.006, 0.006, 64]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.1} depthWrite={false} roughness={0.04} metalness={0} clearcoat={1} clearcoatRoughness={0.02} />
      </mesh>
    </group>
  );
}

/** A lamp with a domed lens; pulses once when it lights. */
function Lamp({ on, color, delay }: { on: boolean; color: string; delay: number }) {
  const { reduced } = useContext(ConsoleMotion);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const level = useRef(0);
  const pulse = useRef(0);
  const wait = useRef(delay);
  const wasOn = useRef(false);
  useEffect(() => {
    if (on && !wasOn.current) {
      pulse.current = reduced ? 0 : 1;
      wait.current = delay;
    }
    wasOn.current = on;
  }, [on, delay, reduced]);
  useFrame((state, dt) => {
    if (wait.current > 0 && !reduced) {
      wait.current -= dt;
      state.invalidate();
      return;
    }
    const target = on ? 2.2 : 0.04;
    level.current = damp(level.current, target, RATE_LAMP, dt, reduced);
    pulse.current = damp(pulse.current, 0, 5, dt, reduced);
    if (mat.current) mat.current.emissiveIntensity = level.current + pulse.current * 3;
    if (Math.abs(level.current - target) > EPS || pulse.current > EPS) state.invalidate();
  });
  return (
    <group position={[0, 0, 0.082]}>
      <mesh>
        <torusGeometry args={[0.05, 0.01, 10, 32]} />
        <meshStandardMaterial color={STEEL_DARK} roughness={0.2} metalness={0.95} />
      </mesh>
      <mesh position={[0, 0, 0.004]} scale={[1, 1, 0.55]}>
        <sphereGeometry args={[0.044, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial ref={mat} color={LAMP_GLASS} emissive={color} emissiveIntensity={0.04} roughness={0.15} metalness={0.1} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Screw({ x, y }: { x: number; y: number }) {
  // Domed, slotted cap screw sitting on the bezel face.
  return (
    <group position={[x, y, 0]} rotation-z={0.5 + x * 0.7}>
      <Turned profile={[[0, 0.132], [0.014, 0.131], [0.026, 0.126], [0.034, 0.118], [0.036, 0.11]]} color={STEEL} roughness={0.28} />
      <mesh position={[0, 0, 0.128]}>
        <boxGeometry args={[0.056, 0.009, 0.012]} />
        <meshStandardMaterial color={BEZEL} roughness={0.7} metalness={0.3} />
      </mesh>
    </group>
  );
}

function RowLabel({ y, children }: { y: number; children: string }) {
  return (
    <Text position={[-1.62, y, 0.093]} fontSize={0.075} color={INK_SOFT} font={FONT} letterSpacing={0.14} anchorX="left" anchorY="middle">
      {children}
    </Text>
  );
}

/** The LAST readout types in whenever its text changes. */
function Readout({ text, y }: { text: string; y: number }) {
  const { reduced } = useContext(ConsoleMotion);
  const [shown, setShown] = useState(reduced ? text.length : 0);
  const acc = useRef(0);
  useEffect(() => {
    setShown(reduced ? text.length : 0);
    acc.current = 0;
  }, [text, reduced]);
  useFrame((state, dt) => {
    if (shown >= text.length) return;
    acc.current += dt;
    // ~70 characters a second, within the 1.6 s cap for any readout here.
    const next = Math.min(text.length, Math.floor(acc.current * 70));
    if (next !== shown) setShown(next);
    state.invalidate();
  });
  return (
    <Text position={[-0.75, y, 0.096]} fontSize={0.056} color={READOUT_INK} font={READOUT_FONT} anchorY="middle" overflowWrap="break-word" letterSpacing={0.01} anchorX="left" maxWidth={1.98} lineHeight={1.25}>
      {text.slice(0, shown) + (shown < text.length ? "▌" : "")}
    </Text>
  );
}

export interface ConsoleData {
  /** e.g. "DRIFT · UPGRADE" */
  protocol: string;
  threshold: number;
  members: number;
  /** seconds; a "no timelock feature" protocol is passed 0 with noTimelockFeature=true */
  timelockSeconds: number;
  noTimelockFeature?: boolean;
  verified: boolean;
  codeDrifted: boolean;
  weakened: boolean;
  /** null when reconstructed, not a live read */
  slot: number | string | null;
  label: string;
  /** No wallet or protocol read yet: every reading is blank, nothing is implied. */
  waiting?: boolean;
  /** Status plate text while waiting (default WAITING), e.g. UNRESOLVED. */
  status?: string;
  /** While waiting, the code row still shows its reading when it was read. */
  codeKnown?: boolean;
  /** While waiting, what the keys readout says instead of "? of ? required". */
  keysText?: string;
}

export default function Console({ data }: { data: ConsoleData }) {
  const { protocol, threshold, members, timelockSeconds, noTimelockFeature, verified, codeDrifted, weakened, label, waiting = false, status, codeKnown = false, keysText } = data;
  const codeBlank = waiting && !codeKnown;
  const { rough, normal } = usePanelTextures();

  // Up to 7 keys sit on the left of the row; more run the full width (the
  // "N of M required" readout is on the line below) and each slot shrinks to
  // its pitch, so 15 keys (marginfi) never overlap.
  const { socketXs, slotScale } = useMemo(() => {
    const n = Math.max(members, 1);
    const startX = -0.95;
    const endX = n > 7 ? 1.5 : 0.55;
    if (n === 1) return { socketXs: [startX], slotScale: 1 };
    const step = (endX - startX) / (n - 1);
    return { socketXs: Array.from({ length: n }, (_, i) => startX + step * i), slotScale: Math.min(1, step / 0.26) };
  }, [members]);

  const PANEL_H = 3.1;
  const FACE_H = 2.8;
  const Y_NAME = 1.24;
  const Y_KEYS = 0.82;
  const Y_TIME = 0.02;
  const Y_CODE = -0.86;
  const Y_LAST = -1.24;

  return (
    <group>
      {/* machined body: back plate, recessed enamel face, bevelled anodised bezel */}
      <BackPlate w={3.86} h={3.24} z={0.04} color={BEZEL} />
      <Face w={3.46} h={2.84} z={0.048} color={FACE} roughMap={rough} />
      <Bezel w={3.92} h={3.3} depth={0.16} border={0.22} tint={BEZEL_EDGE} />
      {/* engraved rules between rows, like a printed panel */}
      {[1.02, 0.4, -0.66, -1.06].map((y) => (
        <mesh key={y} position={[0, y, 0.0885]}>
          <planeGeometry args={[3.3, 0.006]} />
          <meshBasicMaterial color={INK_SOFT} transparent opacity={0.28} />
        </mesh>
      ))}
      <Screw x={-1.845} y={1.535} />
      <Screw x={1.845} y={1.535} />
      <Screw x={-1.845} y={-1.535} />
      <Screw x={1.845} y={-1.535} />

      <Text position={[-1.62, Y_NAME, 0.093]} fontSize={0.09} color={INK} font={FONT} letterSpacing={0.1} anchorX="left">
        {protocol}
      </Text>
      <group position={[0.92, Y_NAME, 0]}>
        <Lamp on={weakened} color={WEAKENED} delay={0.5} />
      </group>
      <Text position={[1.62, Y_NAME, 0.093]} fontSize={0.078} color={weakened ? WEAKENED : INK_SOFT} font={FONT} letterSpacing={0.08} anchorX="right">
        {waiting ? status ?? "WAITING" : weakened ? "WEAKENED" : "NOMINAL"}
      </Text>

      <RowLabel y={Y_KEYS}>KEYS</RowLabel>
      <group position={[0, Y_KEYS, 0]}>
        {socketXs.map((x, i) => (
          <group key={i} position={[x, 0, 0]} scale={[slotScale, slotScale, 1]}>
            <KeySlot turned={!waiting && i < threshold} delay={0.06 + i * 0.05} />
          </group>
        ))}
      </group>
      <Text position={[1.62, Y_KEYS - 0.28, 0.093]} fontSize={0.16} color={INK} font={FONT} letterSpacing={0.01} anchorX="right">
        {waiting ? keysText ?? "? of ? required" : `${threshold} of ${members} required`}
      </Text>

      <RowLabel y={Y_TIME}>TIME</RowLabel>
      <group position={[-0.62, Y_TIME, 0]}>
        <TimelockDial seconds={timelockSeconds} hideNeedle={waiting} />
      </group>
      <Text position={[1.62, Y_TIME, 0.093]} fontSize={waiting || noTimelockFeature ? 0.1 : 0.16} color={INK} font={FONT} letterSpacing={0.01} anchorX="right" anchorY="middle" textAlign="right" maxWidth={1.25} lineHeight={1.15}>
        {waiting ? "not read" : noTimelockFeature ? "no timelock feature" : timelockSeconds === 0 ? "none" : timelockSeconds % 86400 === 0 ? `${timelockSeconds / 86400} d` : timelockSeconds < 3600 ? `${timelockSeconds} s` : `${+(timelockSeconds / 3600).toFixed(1)} h`}
      </Text>

      <RowLabel y={Y_CODE}>CODE</RowLabel>
      <group position={[-0.95, Y_CODE, 0]}>
        <Lamp on={!codeBlank && verified} color={VERIFIED_ON} delay={0.55} />
      </group>
      <Text position={[-0.82, Y_CODE, 0.093]} fontSize={0.078} color={INK} font={FONT} anchorX="left">
        {codeBlank ? "not read" : verified ? "verified" : "not verified"}
      </Text>
      {!codeBlank && (
        <>
          <group position={[0.55, Y_CODE, 0]}>
            <Lamp on={codeDrifted} color={WEAKENED} delay={0.55} />
          </group>
          <Text position={[0.68, Y_CODE, 0.093]} fontSize={0.078} color={codeDrifted ? WEAKENED : INK} font={FONT} anchorX="left">
            {codeDrifted ? "drifted" : "no drift record"}
          </Text>
        </>
      )}

      <RowLabel y={Y_LAST}>LAST</RowLabel>
      <RoundedBox args={[2.18, 0.3, 0.012]} radius={0.02} smoothness={3} position={[0.25, Y_LAST, 0.08]}>
        <meshStandardMaterial color={STEEL_DARK} roughness={0.25} metalness={0.9} />
      </RoundedBox>
      <mesh position={[0.25, Y_LAST, 0.086]}>
        <boxGeometry args={[2.08, 0.23, 0.01]} />
        <meshStandardMaterial color={READOUT_BG} roughness={0.8} metalness={0.05} />
      </mesh>
      <Readout text={label} y={Y_LAST} />
    </group>
  );
}
