// Pure geometry for the TIMELOCK gauge, kept out of Console.jsx so it can be unit tested
// without a JSX transform (see scripts/test-dial-angle.mjs).
//
// Angle convention: `dialAngle` returns an angle in the same convention as the printed
// tick marks, which are placed at [sin(a) * r, cos(a) * r] (0 rad = straight up, positive
// = clockwise as seen on the panel). The needle mesh points up (+Y) at rest and is turned
// by rotating its group about the dial's normal (+Z) using three.js's standard
// right-handed rotation, whose tip lands at [-sin(t) * r, cos(t) * r] for a rotation of
// t radians. To make the needle land on the same point as a tick at angle `a`, the group
// must be rotated by t = -a (see needleRotationZ below) — mixing this up was the bug that
// put the needle 180-ish degrees away from the 0 stop.
export const DIAL_CAP_S = 172800; // 48h sweep
export const DIAL_START = -Math.PI * 0.78; // the 0 hard stop
export const DIAL_END = Math.PI * 0.78; // the 48h stop

export function dialFrac(seconds) {
  return Math.sqrt(Math.max(0, Math.min(1, seconds / DIAL_CAP_S)));
}

export function dialAngle(frac) {
  return DIAL_START + (DIAL_END - DIAL_START) * frac;
}

// The rotation to apply to the needle's <group rotation.z> so its tip lands on the tick
// at `angle` (both using the tick-placement convention described above).
export function needleRotationZ(angle) {
  return -angle;
}

export function tickPosition(angle, r) {
  return [Math.sin(angle) * r, Math.cos(angle) * r];
}

export function needleTipPosition(angle, r) {
  const t = needleRotationZ(angle);
  return [-Math.sin(t) * r, Math.cos(t) * r];
}
