// Regression test for the TIMELOCK gauge's value -> angle mapping and the needle/tick
// sign convention. Run with: node scripts/test-dial-angle.mjs
// This is what would have caught the bug where the needle pointed near 48H for a 0s
// (HERO) timelock instead of resting on the 0 stop.
import assert from "node:assert/strict";
import {
  DIAL_CAP_S,
  DIAL_START,
  DIAL_END,
  dialFrac,
  dialAngle,
  tickPosition,
  needleTipPosition,
} from "../src/dialMath.js";

const EPS = 1e-9;

// 1. 0 seconds must map to the start angle (the 0 hard stop).
const angle0 = dialAngle(dialFrac(0));
assert.ok(Math.abs(angle0 - DIAL_START) < EPS, `0s should map to DIAL_START, got ${angle0}`);

// 2. 3,600 seconds (1h, the LIVE state's timelock) must map to exactly the same angle as
// the printed "1H" tick.
const angle1h = dialAngle(dialFrac(3600));
const tick1h = dialAngle(dialFrac(1 * 3600));
assert.ok(Math.abs(angle1h - tick1h) < EPS, `1h value angle should equal the 1H tick angle, got ${angle1h} vs ${tick1h}`);
assert.ok(angle1h > DIAL_START && angle1h < DIAL_END, "1h angle should sit strictly between the 0 and 48h stops");

// 3. 172,800 seconds (48h, the cap) must map to the end angle.
const angle48h = dialAngle(dialFrac(DIAL_CAP_S));
assert.ok(Math.abs(angle48h - DIAL_END) < EPS, `172800s should map to DIAL_END, got ${angle48h}`);

// 4. The needle's rendered tip must land on the same screen point as the tick at the same
// angle — this is the actual bug: tick placement and the needle's three.js rotation used
// opposite sign conventions, so the needle pointed near 48H while the 0 stop tick sat at
// the opposite side of the dial for the same (0s) value.
for (const [label, angle] of [["0h", angle0], ["1h", angle1h], ["48h", angle48h]]) {
  const [tx, ty] = tickPosition(angle, 1);
  const [nx, ny] = needleTipPosition(angle, 1);
  assert.ok(Math.abs(tx - nx) < EPS && Math.abs(ty - ny) < EPS,
    `${label}: needle tip (${nx.toFixed(4)},${ny.toFixed(4)}) must equal tick position (${tx.toFixed(4)},${ty.toFixed(4)})`);
}

console.log("dial angle mapping OK:", {
  angle0: angle0.toFixed(4),
  angle1h: angle1h.toFixed(4),
  angle48h: angle48h.toFixed(4),
  DIAL_START: DIAL_START.toFixed(4),
  DIAL_END: DIAL_END.toFixed(4),
});
console.log("needle/tick alignment OK for 0h, 1h and 48h");
