// Minimal CDP client for capture experiments (Node 24 built-in fetch/WebSocket, no deps).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sleep = ms => new Promise(r => setTimeout(r, ms));

export const BROWSERS = {
  chrome: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  shell: path.join(process.env.LOCALAPPDATA, "ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe"),
};

let nextPort = 9400;

export async function launch({ browser = "shell", flags = [], width = 1920, height = 1080 } = {}) {
  const exe = BROWSERS[browser] || browser;
  const port = nextPort++;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pvr-probe-"));
  const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--hide-scrollbars",
    "--force-color-profile=srgb", `--window-size=${width},${height}`, "--no-first-run", "--mute-audio", ...flags];
  if (browser === "chrome") args.unshift("--headless=new");
  args.push("about:blank");
  const proc = spawn(exe, args, { stdio: "ignore" });
  let version, target;
  for (let i = 0; i < 100 && !target; i++) {
    await sleep(100);
    try {
      version ??= await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === "page");
    } catch {}
  }
  if (!target) { proc.kill(); throw new Error(`${browser} did not start`); }
  const session = await connect(target.webSocketDebuggerUrl);
  session.version = version;
  session.close = () => { session.ws.close(); proc.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 500); };
  return session;
}

export async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const listeners = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) (listeners.get(m.method) || []).forEach(f => f(m.params));
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id; pending.set(n, m => m.error ? rej(new Error(method + ": " + m.error.message)) : res(m.result));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async expr => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const on = (method, f) => listeners.set(method, [...(listeners.get(method) || []), f]);
  return { ws, send, evaluate, on };
}

export async function openPage(s, url, { width = 1920, height = 1080 } = {}) {
  await s.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await s.send("Page.enable");
  await s.send("Page.navigate", { url });
  for (let i = 0; i < 200; i++) { await sleep(50); if (await s.evaluate("typeof window.ready === 'object'").catch(() => false)) break; }
  await s.evaluate("window.ready");
}

// The port follows the committed baseline (2a2b909). The working copy in the KRW repo may be edited by
// other sessions, so experiments read the committed file (read-only git show) into experiments/out.
import { execSync } from "node:child_process";
const pinned = path.resolve("experiments/out/baseline-2a2b909.html");
if (!fs.existsSync(pinned)) {
  fs.mkdirSync(path.dirname(pinned), { recursive: true });
  fs.writeFileSync(pinned, execSync("git -C C:/Users/mikke/Desktop/Projects/KRW-Extension show 2a2b909:store/video/promo-video.html"));
}
export const BASELINE = "file:///" + pinned.replace(/\\/g, "/") + "?record";
