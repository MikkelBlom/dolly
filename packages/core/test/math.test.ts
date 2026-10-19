import { test } from "node:test";
import assert from "node:assert/strict";
import {
  spring, springOvershoot, springSettleTime, appleSpring, EASINGS, cubicBezier, expoOut, quartInOut,
  keys, keys2, stagger, prog, clamp, rng, noise1, quad, arcControl,
  camera, cameraPath, worldToScreen, screenToWorld, cameraDisplacement, fitRect, parallax, cameraTransform,
  roll, slide, countUp, validateStoryboard, contrast, parseColor, readingTime,
} from "../src/index.ts";

const near = (a: number, b: number, eps = 1e-6, msg?: string) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ≉ ${b} (±${eps})`);

// The baseline page's spring, verbatim, as the reference the port must reproduce.
function baselineSpring(t: number, freq = 1.8, zeta = 0.5): number {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq, wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
}

test("spring matches the Price Peek baseline for under-damped params", () => {
  for (const [f, z] of [[1.8, 0.5], [2.1, 0.42], [1.25, 0.62], [1.0, 0.7], [2.6, 0.75]])
    for (let t = 0; t < 3; t += 0.037) near(spring(t, { freq: f, zeta: z }), baselineSpring(t, f, z), 1e-12);
});

test("spring starts at 0, ends at 1, is continuous across damping regimes", () => {
  for (const zeta of [0.3, 0.999, 1, 1.001, 2]) {
    assert.equal(spring(0, { zeta }), 0);
    near(spring(10, { freq: 2, zeta }), 1, 1e-4, `zeta ${zeta} settles`);
  }
  near(spring(0.3, { freq: 2, zeta: 0.999 }), spring(0.3, { freq: 2, zeta: 1 }), 2e-3);
  near(spring(0.3, { freq: 2, zeta: 1.001 }), spring(0.3, { freq: 2, zeta: 1 }), 2e-3);
});

test("spring overshoot formula agrees with the sampled peak", () => {
  const p = { freq: 2.1, zeta: 0.42 };
  let peak = 0;
  for (let t = 0; t < 2; t += 0.0005) peak = Math.max(peak, spring(t, p));
  near(peak - 1, springOvershoot(p), 1e-4);
  assert.equal(springOvershoot({ zeta: 1 }), 0);
});

test("springSettleTime bounds the error after it", () => {
  const p = { freq: 1.8, zeta: 0.5 };
  const ts = springSettleTime(p, 0.005);
  for (let t = ts; t < ts + 3; t += 0.01) assert.ok(Math.abs(1 - spring(t, p)) <= 0.005 + 1e-9);
});

test("stiffness/mass/damping and freq/zeta forms are the same spring", () => {
  const k = 170, m = 1, c = 26; // react-spring "default"
  const freq = Math.sqrt(k / m) / (2 * Math.PI), zeta = c / (2 * Math.sqrt(k * m));
  for (let t = 0; t < 2; t += 0.05) near(spring(t, { stiffness: k, mass: m, damping: c }), spring(t, { freq, zeta }), 1e-12);
});

test("appleSpring: bounce 0 is critically damped, 0.3 overshoots ~", () => {
  const a = appleSpring(0.5, 0);
  near(a.damping / (2 * Math.sqrt(a.stiffness)), 1, 1e-12);
  const b = appleSpring(0.5, 0.3);
  near(b.damping / (2 * Math.sqrt(b.stiffness)), 0.7, 1e-12);
  assert.ok(springOvershoot(b) < 0.05);
});

test("spring initial velocity", () => {
  const dt = 1e-5;
  near(spring(dt, { freq: 2, zeta: 0.5, velocity: 3 }) / dt, 3, 1e-2);
  near(spring(dt, { freq: 2, zeta: 2, velocity: 3 }) / dt, 3, 1e-2);
});

test("every easing maps 0→0 and 1→1", () => {
  for (const [name, e] of Object.entries(EASINGS)) {
    near(e(0), 0, 1e-9, `${name}(0)`);
    near(e(1), 1, 1e-9, `${name}(1)`);
  }
});

test("in-out easings are symmetric", () => {
  for (const name of ["sineInOut", "quadInOut", "cubicInOut", "quartInOut", "quintInOut", "expoInOut", "circInOut"] as const)
    for (let i = 0; i <= 20; i++) { const p = i / 20; near(EASINGS[name](p) + EASINGS[name](1 - p), 1, 1e-9, name); }
});

test("cubicBezier: CSS 'ease' and linear", () => {
  const ease = cubicBezier(0.25, 0.1, 0.25, 1);
  near(ease(0.5), 0.8024033877399112, 1e-5); // reference value from the CSS spec's algorithm
  const lin = cubicBezier(0, 0, 1, 1);
  for (let p = 0; p <= 1; p += 0.1) near(lin(p), p, 1e-6);
  let prev = -1;
  for (let p = 0; p <= 1; p += 0.01) { const v = ease(p); assert.ok(v >= prev - 1e-12); prev = v; }
});

test("keys: holds outside, easing belongs to the arriving segment", () => {
  const tr = [[0, 10], [1, 20, "linear"], [2, 0, quartInOut]] as const;
  assert.equal(keys(-1, tr), 10);
  assert.equal(keys(5, tr), 0);
  near(keys(0.5, tr), 15);
  near(keys(1.5, tr), 20 - 20 * quartInOut(0.5));
  assert.throws(() => keys(0, []));
  assert.deepEqual(keys2(0.5, [[0, [0, 0]], [1, [10, 20], "linear"]]), [5, 10]);
});

test("stagger orders", () => {
  assert.equal(stagger(3, 5, { each: 0.1 }), 0.30000000000000004);
  assert.equal(stagger(0, 5, { each: 0.1, from: "end" }), 0.4);
  assert.equal(stagger(2, 5, { each: 0.1, from: "center" }), 0);
  near(stagger(4, 5, { total: 1 }), 1);
});

test("prog/clamp edge cases", () => {
  assert.equal(prog(5, 5, 0), 1);
  assert.equal(prog(4, 5, 0), 0);
  assert.equal(clamp(2), 1);
});

test("rng and noise are deterministic", () => {
  const a = rng(42), b = rng(42);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
  assert.equal(noise1(3.3, 7), noise1(3.3, 7));
  for (let t = 0; t < 5; t += 0.1) assert.ok(Math.abs(noise1(t)) <= 1);
});

test("bezier helpers", () => {
  assert.deepEqual(quad([0, 0], [5, 10], [10, 0], 0), [0, 0]);
  assert.deepEqual(quad([0, 0], [5, 10], [10, 0], 1), [10, 0]);
  assert.deepEqual(arcControl([0, 0], [10, 0], 0.25), [5, 2.5]);
});

const STAGE = { width: 1280, height: 720 };

test("camera: screen/world round trip with zoom and roll", () => {
  const c = { x: 900, y: 300, zoom: 2.3, rotate: 17 };
  for (const p of [[0, 0], [640, 360], [1280, 720], [100, 600]] as const) {
    const w = screenToWorld(c, STAGE, p), q = worldToScreen(c, STAGE, w);
    near(q[0], p[0], 1e-9); near(q[1], p[1], 1e-9);
  }
  assert.deepEqual(worldToScreen(c, STAGE, [900, 300]), [640, 360]);
});

test("camera: transform string matches worldToScreen", () => {
  const c = { x: 795, y: 112, zoom: 2.7, rotate: 0 };
  assert.equal(cameraTransform(c, STAGE), "translate(640px,360px) scale(2.7) translate(-795px,-112px)");
});

test("camera displacement: pure pan moves every point by pan × zoom", () => {
  const a = { x: 640, y: 360, zoom: 2, rotate: 0 }, b = { ...a, x: 650 };
  near(cameraDisplacement(a, b, STAGE), 20, 1e-9);
  const z = cameraDisplacement(a, { ...a, zoom: 2.2 }, STAGE);
  near(z, Math.hypot(640, 360) * 0.1, 1e-9); // corners move most under zoom
});

test("camera path builder reproduces the baseline's pull-back + whip", () => {
  const cam = cameraPath(STAGE).at(0, { x: 795, y: 112, zoom: 2.7 }).at(0.95, { x: 795, y: 116, zoom: 2.55 })
    .at(2.45, { x: 640, y: 360, zoom: 1 }, "quartInOut").whip(6.7, 7.3, { x: 2240 }).build();
  assert.deepEqual(cam(0), { x: 795, y: 112, zoom: 2.7, rotate: 0 });
  near(cam(1.7).x, 795 + (640 - 795) * quartInOut(0.5));
  near(cam(7.0).x, 640 + (2240 - 640) * quartInOut(0.5));
  assert.equal(cam(10).x, 2240);
  assert.throws(() => cameraPath(STAGE).at(2, { x: 1 }).at(1, { x: 2 }), /before the previous key/);
  const c2 = camera({}, STAGE);
  assert.deepEqual(c2(3), { x: 640, y: 360, zoom: 1, rotate: 0 });
});

test("fitRect and parallax", () => {
  const f = fitRect({ x: 0, y: 0, w: 640, h: 360 }, STAGE, 0);
  assert.deepEqual(f, { x: 320, y: 180, zoom: 2, rotate: 0 });
  const p = parallax({ x: 1640, y: 360, zoom: 2, rotate: 0 }, 0.5, STAGE);
  assert.deepEqual(p, { x: 1140, y: 360, zoom: 1.5, rotate: 0 });
});

test("odometer roll: unchanged digits stay, finished roll is plain", () => {
  assert.equal(roll("1.234", "1.234", 0.5), "1.234");
  assert.equal(roll("12", "13", 1), "13");
  const mid = roll("129", "130", 0.3);
  assert.match(mid, /^1<span class="dolly-rl">/);
  assert.equal(slide("a", "b", 1), "b");
  assert.equal(countUp(0, 100, 1), "100");
});

test("storyboard validation reports every problem with a path", () => {
  const ok = validateStoryboard({ title: "x", scenes: [{ name: "hook", duration: 2, idea: "a", text: ["Shopping abroad?"] }, { name: "proof", duration: 5, idea: "b" }] });
  assert.ok(ok.ok, JSON.stringify(ok.problems));
  assert.deepEqual(ok.timeline.map(s => [s.start, s.end]), [[0, 2], [2, 7]]);
  const bad = validateStoryboard({ title: "", scenes: [{ name: "Hook", duration: -1, idea: "" }, { name: "b", duration: 1, idea: "x", text: ["one two three four five six seven eight nine ten"] }] });
  assert.ok(!bad.ok);
  const paths = bad.problems.map(p => p.path);
  for (const p of ["$.title", "$.scenes[0].name", "$.scenes[0].duration", "$.scenes[0].idea", "$.scenes[1].text[0]"]) assert.ok(paths.includes(p), `missing ${p}`);
  near(readingTime("one two three"), 1.5);
});

test("WCAG contrast", () => {
  near(contrast("#000", "#fff"), 21, 1e-9);
  near(contrast("#777", "#fff"), 4.478, 1e-3);
  assert.deepEqual(parseColor("rgba(10, 20, 30, 0.5)"), [10, 20, 30, 0.5]);
  assert.deepEqual(parseColor("#3355ff"), [51, 85, 255, 1]);
});

test("expoOut reaches 1 exactly at 1", () => { assert.equal(expoOut(1), 1); });
