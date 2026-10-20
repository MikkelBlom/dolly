// Warm sessions (the daemon) and lazy sessions (fully cached renders): a reloaded page renders like a
// fresh one, a lazy session starts no browser, and concurrent launches never share a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Session, launch } from "../src/index.ts";

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/components");
const pngSize = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];

test("concurrent launches get their own browsers (no debugging-port collisions)", async () => {
  const bs = await Promise.all([launch(), launch(), launch()]);
  try {
    assert.equal(new Set(bs.map(b => b.port)).size, 3);
    assert.equal(new Set(bs.map(b => b.browserWs)).size, 3);
  } finally { bs.forEach(b => b.close()); }
});

test("a lazy session reuses cached scene metadata and starts no browser", async () => {
  const cold = await Session.open({ project: FIXTURE, width: 320, height: 180, workers: 1 });
  const meta = cold.meta;
  cold.close();
  const lazy = await Session.open({ project: FIXTURE, width: 320, height: 180, workers: 1, lazy: true });
  try {
    assert.equal(lazy.workers.length, 0);
    assert.deepEqual(lazy.meta, meta);
    assert.deepEqual([lazy.width, lazy.height], [320, 180]);
    await lazy.ensureWorkers();
    assert.equal(lazy.workers.length, 1);
  } finally { lazy.close(); }
});

test("a warm session follows size changes and renders the same frame after reloads", async () => {
  const s = await Session.open({ project: FIXTURE, width: 320, height: 180, workers: 1 });
  s.keepAlive = true;
  try {
    const a = await s.workers[0].frame([2.3]);
    await s.refresh({ width: 480, height: 270 });
    assert.deepEqual(pngSize(await s.workers[0].frame([2.3])), [480, 270]);
    await s.refresh({ width: 320, height: 180 });
    const b = await s.workers[0].frame([2.3]);
    assert.deepEqual(pngSize(b), [320, 180]);
    assert.ok(a.equals(b), "frame differs after reloading the page");
    s.close(); // keepAlive: still usable
    assert.ok(s.workers[0].alive);
  } finally { s.dispose(); }
});
