import { test } from "node:test";
import assert from "node:assert/strict";
import { subTimes, sampleCounts, smearVector, frameKey, nextPow2, shutterSeconds, DEFAULT_BLUR } from "../src/frames.ts";

test("sub-frame times are stratified and centred on the frame", () => {
  const ts = subTimes(60, 4, 60, 180);
  assert.equal(ts.length, 4);
  const mid = ts.reduce((a, b) => a + b) / 4;
  assert.ok(Math.abs(mid - 1) < 1e-12);
  const span = (ts[3] - ts[0]) * 60;
  assert.ok(Math.abs(span - 0.5 * 3 / 4) < 1e-12, `span ${span}`); // 180° shutter, stratified: 3/4 of half a frame
  assert.deepEqual(subTimes(30, 1, 60, 180), [0.5]);
  assert.equal(shutterSeconds(60, 180), 1 / 120);
});

test("sample counts: powers of two, capped, smoothed over neighbours", () => {
  const n = sampleCounts([0, 0, 0, 10, 0, 0, 0, 0, 200], DEFAULT_BLUR);
  assert.deepEqual(n, [1, 8, 8, 8, 8, 8, 32, 32, 32]);
  assert.equal(nextPow2(5), 8);
  assert.equal(nextPow2(0.3), 1);
});

test("smear only past the cap and only when the camera dominates", () => {
  assert.equal(smearVector({ px: 40, camera: 40, vx: -40, vy: 0 }, 32, DEFAULT_BLUR), null); // gap 1.25 px: fine
  assert.deepEqual(smearVector({ px: 128, camera: 128, vx: -128, vy: 0 }, 32, DEFAULT_BLUR), [-4, 0]);
  assert.equal(smearVector({ px: 128, camera: 20, vx: -20, vy: 0 }, 32, DEFAULT_BLUR), null); // elements dominate
  assert.equal(smearVector({ px: 128, camera: 128, vx: 0, vy: 0 }, 32, DEFAULT_BLUR), null); // pure zoom
});

test("cache keys change with what changes pixels, not with scene order", () => {
  const base = { globalHash: "g", sceneHashes: ["a", "b"], t: 1, times: [1], width: 1920, height: 1080 };
  const k = frameKey(base);
  assert.equal(frameKey({ ...base, sceneHashes: ["b", "a"] }), k);
  for (const change of [{ globalHash: "h" }, { sceneHashes: ["a", "c"] }, { times: [0.99, 1.01] }, { width: 1280 }, { smear: [1, 0] as [number, number] }])
    assert.notEqual(frameKey({ ...base, ...change }), k, JSON.stringify(change));
});
