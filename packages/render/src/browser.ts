// Chromium launch and a minimal CDP client (Node 24 built-in fetch/WebSocket; no puppeteer).
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** GPU raster on the discrete GPU via ANGLE/D3D11: measured 1.3× faster than SwiftShader at 12 workers. */
export const GPU_FLAGS = ["--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--force-gpu-mem-available-mb=12000"];

const BASE_FLAGS = [
  "--hide-scrollbars", "--force-color-profile=srgb", "--no-first-run", "--no-default-browser-check", "--mute-audio",
  "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
  "--disable-features=UseEcoQoSForBackgroundProcess,CalculateNativeWinOcclusion", "--disable-extensions", "--font-render-hinting=none",
  "--allow-file-access-from-files",
  // greyscale text AA everywhere: blended iframes (motion blur) never get LCD text, so plain frames must not either
  "--disable-lcd-text",
  // never capture low-resolution or not-yet-decoded tiles: raster must finish before the screenshot
  "--disable-low-res-tiling", "--disable-checker-imaging",
];

/**
 * Find a Chromium build. chrome-headless-shell is preferred (it is what the measurements used and the
 * only headless mode with beginFrame). Order: $DOLLY_CHROME, newest Playwright headless-shell, Chrome.
 */
export function findBrowser(): { exe: string; kind: "shell" | "chrome" } {
  const env = process.env.DOLLY_CHROME;
  if (env) return { exe: env, kind: /headless-shell/i.test(env) ? "shell" : "chrome" };
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".cache"), "ms-playwright");
  if (fs.existsSync(pw)) {
    const dirs = fs.readdirSync(pw).filter(d => /^chromium_headless_shell-\d+$/.test(d)).sort((a, b) => +b.split("-")[1] - +a.split("-")[1]);
    for (const d of dirs) {
      for (const sub of ["chrome-headless-shell-win64/chrome-headless-shell.exe", "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux/headless_shell"]) {
        const exe = path.join(pw, d, sub);
        if (fs.existsSync(exe)) return { exe, kind: "shell" };
      }
    }
  }
  for (const exe of ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"])
    if (fs.existsSync(exe)) return { exe, kind: "chrome" };
  throw new Error("no Chromium found: install one with `npx playwright install chromium-headless-shell` or set DOLLY_CHROME");
}

export interface CdpSession {
  send<T = any>(method: string, params?: Record<string, unknown>): Promise<T>;
  evaluate<T = any>(expression: string): Promise<T>;
  on(method: string, f: (params: any) => void): void;
  close(): void;
}

export async function connect(url: string): Promise<CdpSession> {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error(`CDP connect failed: ${url}`)); });
  let id = 0;
  const pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void; method: string }>();
  const listeners = new Map<string, Array<(p: any) => void>>();
  ws.onmessage = e => {
    const m = JSON.parse(typeof e.data === "string" ? e.data : String(e.data));
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)!; pending.delete(m.id);
      if (m.error) p.rej(new Error(`${p.method}: ${m.error.message}`)); else p.res(m.result);
    } else if (m.method) for (const f of listeners.get(m.method) ?? []) f(m.params);
  };
  ws.onclose = () => { for (const p of pending.values()) p.rej(new Error(`${p.method}: browser connection closed`)); pending.clear(); };
  const send = <T>(method: string, params: Record<string, unknown> = {}) => new Promise<T>((res, rej) => {
    const n = ++id; pending.set(n, { res, rej, method });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async <T>(expression: string): Promise<T> => {
    const r = await send<any>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      const ex = r.exceptionDetails.exception;
      throw new Error(ex?.description?.split("\n    at ")[0] ?? ex?.value ?? r.exceptionDetails.text);
    }
    return r.result.value as T;
  };
  return { send, evaluate, on: (m, f) => listeners.set(m, [...(listeners.get(m) ?? []), f]), close: () => ws.close() };
}

export interface Browser {
  version: string;
  browserWs: string;
  port: number;
  proc: ChildProcess;
  /** Open a new tab and return its session. */
  newPage(): Promise<CdpSession>;
  close(): void;
}

let portSeed = 9500 + Math.floor(Math.random() * 300);

export async function launch(o: { gpu?: boolean; flags?: string[]; width?: number; height?: number } = {}): Promise<Browser> {
  const { exe, kind } = findBrowser();
  const port = portSeed++;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dolly-chrome-"));
  const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${o.width ?? 1920},${o.height ?? 1080}`,
    ...BASE_FLAGS, ...(o.gpu === false || process.env.DOLLY_GPU === "0" ? [] : GPU_FLAGS), ...(o.flags ?? []),
    // extra flags for experiments, e.g. DOLLY_CHROME_FLAGS="--disable-distance-field-text"
    ...(process.env.DOLLY_CHROME_FLAGS?.split(/\s+/).filter(Boolean) ?? [])];
  if (kind === "chrome") args.unshift("--headless=new");
  args.push("about:blank");
  const proc = spawn(exe, args, { stdio: "ignore" });
  let version: any;
  for (let i = 0; i < 150 && !version; i++) {
    await sleep(60);
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { /* not up yet */ }
  }
  if (!version) { proc.kill(); throw new Error(`Chromium did not start (${exe})`); }
  const browserSession = await connect(version.webSocketDebuggerUrl);
  const close = () => {
    browserSession.close(); proc.kill();
    setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* still locked */ } }, 800);
  };
  return {
    version: version.Browser, browserWs: version.webSocketDebuggerUrl, port, proc, close,
    async newPage() {
      const { targetId } = await browserSession.send<{ targetId: string }>("Target.createTarget", { url: "about:blank" });
      return connect(`ws://127.0.0.1:${port}/devtools/page/${targetId}`);
    },
  };
}

/** Navigate a page at a fixed viewport and wait for the scene document's ready promise. */
export async function openScene(page: CdpSession, url: string, width: number, height: number, readyExpr = "window.__dolly && window.__dolly.ready"): Promise<any> {
  await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  const errors: string[] = [];
  page.on("Runtime.exceptionThrown", p => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text));
  await page.send("Page.navigate", { url });
  for (let i = 0; i < 400; i++) {
    await sleep(25);
    const ok = await page.evaluate<boolean>(`!!(${readyExpr})`).catch(() => false);
    if (ok) break;
    if (errors.length) throw new Error(`page failed to load: ${errors[0]}`);
  }
  return page.evaluate(readyExpr);
}

export async function screenshot(page: CdpSession, format: "png" | "jpeg" = "png", quality = 90): Promise<Buffer> {
  const r = await page.send<{ data: string }>("Page.captureScreenshot", { format, ...(format === "jpeg" ? { quality } : {}), optimizeForSpeed: true });
  return Buffer.from(r.data, "base64");
}
