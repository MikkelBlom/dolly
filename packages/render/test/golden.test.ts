// Golden-frame tests: every component at key moments, compared with stored PNGs. Regenerate with
// UPDATE_GOLDEN=1 after an intended visual change (and look at the new images before committing).
// Goldens come from GPU raster on the reference laptop (Windows fonts); other machines may need their own.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Session, stills, determinism } from "../src/index.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, "fixtures/components");
const GOLDEN = path.join(HERE, "golden");
const OUT = path.join(FIXTURE, ".dolly/test-out");
const TIMES = [0.35, 0.95, 1.9, 2.3, 2.95, 3.85, 4.42, 5.4, 6.0, 6.6, 7.6];
const update = !!process.env.UPDATE_GOLDEN;

let s: Session;
before(async () => { s = await Session.open({ project: FIXTURE, width: 640, height: 360, workers: 4 }); });
after(() => s?.close());

const raw = (file: string) => spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 26 }).stdout;
// Same criterion as `dolly diff`: Chromium's render-history-dependent raster leaves a faint anti-aliasing
// fringe on moving text (never > 128 levels); a real change moves or recolours something.
function compare(a: string, b: string): { meanAbs: number; strong: number; ok: boolean } {
  const x = raw(a), y = raw(b);
  assert.equal(x.length, y.length, "image sizes differ");
  let sum = 0, strong = 0;
  for (let i = 0; i < x.length; i++) { const d = Math.abs(x[i] - y[i]); sum += d; if (d > 128) strong++; }
  const meanAbs = sum / x.length, strongPct = (strong / x.length) * 100;
  return { meanAbs, strong: strongPct, ok: meanAbs <= 0.4 && strongPct <= 0.002 };
}

test("component frames match the goldens", async () => {
  const shots = await stills(s, { times: TIMES, outDir: OUT, prefix: "frame" });
  fs.mkdirSync(GOLDEN, { recursive: true });
  const failures: string[] = [];
  for (const sh of shots) {
    const g = path.join(GOLDEN, path.basename(sh.path));
    if (update || !fs.existsSync(g)) { fs.copyFileSync(sh.path, g); continue; }
    const c = compare(sh.path, g);
    if (!c.ok) failures.push(`t=${sh.t} (${sh.scene}): mean ${c.meanAbs.toFixed(3)}, ${c.strong.toFixed(4)} % of pixels changed > 128 levels: ${sh.path} vs ${g}`);
  }
  assert.deepEqual(failures, []);
});

test("motion-blurred frame matches its golden", async () => {
  const [sh] = await stills(s, { times: [5.3], outDir: OUT, prefix: "blur", blur: true });
  assert.ok(sh.samples > 1, `expected blur samples during the camera move, got ${sh.samples}`);
  const g = path.join(GOLDEN, path.basename(sh.path));
  if (update || !fs.existsSync(g)) { fs.copyFileSync(sh.path, g); return; }
  const c = compare(sh.path, g);
  assert.ok(c.ok, `blur frame drifted: mean ${c.meanAbs.toFixed(3)}, ${c.strong.toFixed(4)} % > 128 levels`);
});

test("frames are identical across render orders and workers", async () => {
  const r = await determinism(s, { times: [0.5, 1.2, 2.4, 3.2, 4.1, 4.6, 5.4, 6.4, 7.2], blur: true, outDir: OUT });
  assert.ok(r.ok, JSON.stringify(r.mismatches));
});
