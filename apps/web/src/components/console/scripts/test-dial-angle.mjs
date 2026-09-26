// Regression test for the TIMELOCK gauge's value -> angle mapping (ported from
// design/devices/console/scripts/test-dial-angle.mjs). Run: node src/components/console/scripts/test-dial-angle.mjs
import assert from "node:assert/strict";
import {
  DIAL_CAP_S,
  DIAL_START,
  DIAL_END,
  dialFrac,
  dialAngle,
  tickPosition,
  needleTipPosition,
} from "../dialMath.js";

const EPS = 1e-9;

const angle0 = dialAngle(dialFrac(0));
assert.ok(Math.abs(angle0 - DIAL_START) < EPS, `0s should map to DIAL_START, got ${angle0}`);

const angle1h = dialAngle(dialFrac(3600));
const tick1h = dialAngle(dialFrac(1 * 3600));
assert.ok(Math.abs(angle1h - tick1h) < EPS, `1h value angle should equal the 1H tick angle, got ${angle1h} vs ${tick1h}`);
assert.ok(angle1h > DIAL_START && angle1h < DIAL_END, "1h angle should sit strictly between the 0 and 48h stops");

const angle48h = dialAngle(dialFrac(DIAL_CAP_S));
assert.ok(Math.abs(angle48h - DIAL_END) < EPS, `172800s should map to DIAL_END, got ${angle48h}`);

for (const [label, angle] of [["0h", angle0], ["1h", angle1h], ["48h", angle48h]]) {
  const [tx, ty] = tickPosition(angle, 1);
  const [nx, ny] = needleTipPosition(angle, 1);
  assert.ok(Math.abs(tx - nx) < EPS && Math.abs(ty - ny) < EPS,
    `${label}: needle tip (${nx.toFixed(4)},${ny.toFixed(4)}) must equal tick position (${tx.toFixed(4)},${ty.toFixed(4)})`);
}

console.log("dial angle mapping OK");
