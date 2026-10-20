// `dolly daemon`: commands forwarded to a warm daemon print exactly what a cold run prints.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(HERE, "../bin/dolly.ts");
const FIXTURE = path.join(HERE, "../../render/test/fixtures/components");
const dolly = (...args: string[]) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", env: { ...process.env, DOLLY_NO_DAEMON: "" } });

before(() => {
  const r = dolly("daemon", FIXTURE, "--detach", "--workers", "2", "--idle", "5", "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(JSON.parse(r.stdout).running, true);
});
after(() => { dolly("daemon", FIXTURE, "--stop"); });

test("daemon output is identical to a cold run (info, still, error)", () => {
  for (const args of [["info", FIXTURE, "--json"], ["still", FIXTURE, "--times", "1.9", "--json"], ["still", FIXTURE, "--json"]]) {
    const cold = dolly(...args, "--no-daemon"), warm = dolly(...args);
    assert.equal(warm.status, cold.status, args.join(" "));
    assert.equal(warm.stdout, cold.stdout, args.join(" "));
  }
  assert.ok(fs.existsSync(path.join(FIXTURE, ".dolly", "daemon.json")));
});

test("daemon --status reports the warm pool", () => {
  const s = JSON.parse(dolly("daemon", FIXTURE, "--status", "--json").stdout);
  assert.equal(s.running, true);
  assert.equal(s.workers, 2);
  assert.ok(s.served >= 3);
});
