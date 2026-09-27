"use client";
// Machined parts for the console (OVERHAUL §1, P05–P07). Parametric, as
// DEVICE.md allows for thin flat objects, but made the way a panel is made:
// bevelled extrusions for bezel and face, turned (lathe) profiles for key
// wells, dial ring and screw heads, and real brushed-metal maps (ambientCG
// Metal009, CC0) instead of flat colour.
import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function useBrushed(repeat: [number, number] = [2, 2]) {
  const [color, normal, rough] = useTexture(["/textures/metal/Color.jpg", "/textures/metal/NormalGL.jpg", "/textures/metal/Roughness.jpg"]);
  useMemo(() => {
    for (const t of [color, normal, rough] as THREE.Texture[]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
      t.anisotropy = 8;
    }
    (color as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
  }, [color, normal, rough, repeat]);
  return { color, normal, rough };
}

/** Anodised bezel: an extruded rounded frame with a bevelled edge and a window for the face. */
export function Bezel({ w, h, depth, border, tint }: { w: number; h: number; depth: number; border: number; tint: string }) {
  const { normal, rough } = useBrushed([3, 2.5]);
  const geo = useMemo(() => {
    const outer = roundedRect(w, h, 0.12);
    const hole = roundedRect(w - border * 2, h - border * 2, 0.06);
    outer.holes.push(hole as unknown as THREE.Path);
    const g = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.028, bevelSegments: 4, curveSegments: 16 });
    g.translate(0, 0, -depth / 2);
    return g;
  }, [w, h, depth, border]);
  return (
    <mesh geometry={geo}>
      <meshPhysicalMaterial color={tint} metalness={0.9} roughness={0.24} roughnessMap={rough} normalMap={normal} normalScale={new THREE.Vector2(1.1, 1.1)} envMapIntensity={1.6} clearcoat={0.5} clearcoatRoughness={0.22} />
    </mesh>
  );
}

/** Back plate behind the face (closes the bezel window). */
export function BackPlate({ w, h, z, color }: { w: number; h: number; z: number; color: string }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(roundedRect(w, h, 0.08), 16), [w, h]);
  return (
    <mesh geometry={geo} position={[0, 0, z]}>
      <meshStandardMaterial color={color} roughness={0.9} metalness={0.1} />
    </mesh>
  );
}

/** Enamel face: a thin bevelled slab. */
export function Face({ w, h, z, color, roughMap }: { w: number; h: number; z: number; color: string; roughMap?: THREE.Texture }) {
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedRect(w, h, 0.05), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 12 });
    return g;
  }, [w, h]);
  return (
    <mesh geometry={geo} position={[0, 0, z]}>
      <meshPhysicalMaterial color={color} roughness={0.6} roughnessMap={roughMap} metalness={0.02} clearcoat={0.25} clearcoatRoughness={0.45} envMapIntensity={0.55} emissive={color} emissiveIntensity={0.18} />
    </mesh>
  );
}

/** A turned profile (lathe) around Z. `profile` is [radius, z] pairs from the axis outwards. */
export function Turned({ profile, color, metalness = 0.95, roughness = 0.25, segments = 48, z = 0 }: { profile: Array<[number, number]>; color: string; metalness?: number; roughness?: number; segments?: number; z?: number }) {
  const geo = useMemo(() => {
    const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, segments);
    g.rotateX(Math.PI / 2);
    return g;
  }, [profile, segments]);
  return (
    <mesh geometry={geo} position={[0, 0, z]}>
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} side={THREE.DoubleSide} />
    </mesh>
  );
}
