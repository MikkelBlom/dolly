// `dolly daemon`: keeps one project's worker pool warm so review commands (sheet, still, lint, info,
// diff, render) skip the 3–9 s browser start-up. The daemon runs the very same CLI commands in-process
// (the CLI stays the source of truth) and streams their stdout/stderr back, so output is identical.
// Clients find it through <project>/.dolly/daemon.json and talk to it over loopback HTTP with a token.
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { num, size, type Parsed } from "./args.ts";
import { EXIT, host, io, main } from "./main.ts";

interface DaemonFile { pid: number; port: number; token: string; project: string; workers: number; env: Record<string, string>; started: string }

/** Environment that changes how browsers are launched: a client with different values runs cold. */
const launchEnv = (): Record<string, string> =>
  Object.fromEntries(["DOLLY_GPU", "DOLLY_CHROME", "DOLLY_CHROME_FLAGS"].map(k => [k, process.env[k] ?? ""]));

const projectDir = (project: string): string => (fs.existsSync(project) && fs.statSync(project).isFile() ? path.dirname(project) : project);
const daemonFile = (project: string): string => path.join(projectDir(project), ".dolly", "daemon.json");

function readDaemon(project: string): DaemonFile | null {
  try { return JSON.parse(fs.readFileSync(daemonFile(project), "utf8")); } catch { return null; }
}

const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };

function request(d: DaemonFile, method: string, route: string, body?: unknown): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: d.port, method, path: route, headers: { "x-dolly-token": d.token, "content-type": "application/json" } }, resolve);
    req.on("error", reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

async function readJson(res: http.IncomingMessage): Promise<any> {
  let s = "";
  for await (const c of res) s += c;
  return JSON.parse(s);
}

/**
 * Run a command in the project's daemon. Returns its exit code, or null when there is no usable
 * daemon (none running, stale file, different launch environment): the caller then runs it cold.
 */
export async function forward(argv: string[], project: string): Promise<number | null> {
  const d = readDaemon(project);
  if (!d) return null;
  if (JSON.stringify(d.env) !== JSON.stringify(launchEnv())) return null;
  let res: http.IncomingMessage;
  try { res = await request(d, "POST", "/run", { argv, cwd: process.cwd() }); }
  catch {
    if (!alive(d.pid)) fs.rmSync(daemonFile(project), { force: true });
    return null;
  }
  if (res.statusCode !== 200) { res.resume(); return null; }
  // newline-delimited messages: {o} stdout, {e} stderr, {h} heartbeat, {exit} the exit code
  let buf = "", exit: number | null = null, wrote = false;
  try {
    for await (const chunk of res) {
      buf += chunk;
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
        if (m.o !== undefined) { process.stdout.write(m.o); wrote = true; }
        else if (m.e !== undefined) process.stderr.write(m.e);
        else if (m.exit !== undefined) exit = m.exit;
      }
    }
  } catch { /* connection lost: reported below */ }
  if (exit !== null) return exit;
  const message = "the dolly daemon stopped during the command";
  if (argv.includes("--json") && !wrote) process.stdout.write(JSON.stringify({ ok: false, error: { code: EXIT.render, message } }) + "\n");
  else process.stderr.write(`dolly: ${message}\n`);
  return EXIT.render;
}

export async function daemonCommand(a: Parsed, project: string): Promise<number> {
  const json = !!a.flags.json;
  const print = (v: Record<string, unknown>, human: string) => io.out((json ? JSON.stringify(v) : human) + "\n");
  const status = async (): Promise<Record<string, unknown> | null> => {
    const d = readDaemon(project);
    if (!d) return null;
    try { return await readJson(await request(d, "GET", "/status")); } catch { return null; }
  };

  if (a.flags.status) {
    const s = await status();
    print(s ? { ok: true, running: true, ...s } : { ok: true, running: false }, s ? `running · pid ${s.pid} · ${s.workers} workers · ${s.url}` : "not running");
    return EXIT.ok;
  }
  if (a.flags.stop) {
    const d = readDaemon(project);
    let stopped = false;
    if (d) { try { (await request(d, "POST", "/stop")).resume(); stopped = true; } catch { fs.rmSync(daemonFile(project), { force: true }); } }
    print({ ok: true, stopped }, stopped ? "stopped" : "not running");
    return EXIT.ok;
  }
  const running = await status();
  if (running) { print({ ok: true, running: true, ...running }, `already running · pid ${running.pid} · ${running.url}`); return EXIT.ok; }

  if (a.flags.detach) {
    // start a background daemon and return once it is serving (so an agent can fire and forget)
    const bin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../bin/dolly.ts");
    const args = process.argv.slice(2).filter(x => x !== "--detach" && x !== "--json");
    fs.mkdirSync(path.join(projectDir(project), ".dolly"), { recursive: true });
    const log = fs.openSync(path.join(projectDir(project), ".dolly", "daemon.log"), "w");
    const child = spawn(process.execPath, [bin, ...args], { detached: true, stdio: ["ignore", log, log], windowsHide: true });
    child.unref();
    for (let i = 0; i < 600; i++) {
      await new Promise(r => setTimeout(r, 100));
      const s = await status();
      if (s) { print({ ok: true, running: true, ...s }, `started · pid ${s.pid} · ${s.workers} workers · ${s.url}`); return EXIT.ok; }
      if (child.exitCode !== null) break;
    }
    const tail = fs.readFileSync(path.join(projectDir(project), ".dolly", "daemon.log"), "utf8").trim().split("\n").slice(-3).join(" ");
    throw new Error(`daemon did not start${tail ? `: ${tail}` : ""}`);
  }

  const d = await startDaemon({ project, workers: num(a.flags.workers), aspect: typeof a.flags.aspect === "string" ? a.flags.aspect : undefined, ...size(a.flags.size), idleMinutes: num(a.flags.idle, 30)! });
  print({ ok: true, running: true, ...d.status() }, `dolly daemon · ${d.status().workers} workers warm · ${d.status().url}\n(serving ${projectDir(project)}; stops after ${num(a.flags.idle, 30)} idle minutes, or: dolly daemon --stop)`);
  await new Promise(() => {});
  return EXIT.ok;
}

const IGNORE = /(^|[\\/])(\.dolly|out|node_modules|\.git)([\\/]|$)/;

async function startDaemon(o: { project: string; workers?: number; aspect?: string; width?: number; height?: number; idleMinutes: number }) {
  const { Session, resolveEntry } = await import("@dolly/render");
  const t0 = performance.now();
  const s = await Session.open({ project: o.project, workers: o.workers, aspect: o.aspect, width: o.width, height: o.height });
  s.keepAlive = true;
  const startMs = Math.round(performance.now() - t0);
  const entry = s.build.entry;

  // commands run one at a time: a worker's pages serve one frame at a time
  let chain: Promise<unknown> = Promise.resolve();
  const queue = <T>(f: () => Promise<T>): Promise<T> => { const p = chain.then(f); chain = p.catch(() => {}); return p; };

  host.session = async opts => {
    // another project (or entry file) than the one kept warm: an ordinary cold session
    if (resolveEntry(opts.project).entry !== entry) return Session.open(opts);
    await s.refresh({ width: opts.width, height: opts.height, aspect: opts.aspect, nmax: opts.nmax });
    return s;
  };

  // rebuild and reload in the background as files change, so the next command finds warm, fresh pages
  let timer: NodeJS.Timeout | null = null;
  const watcher = fs.watch(s.build.dir, { recursive: true }, (_ev, file) => {
    if (!file || IGNORE.test(file)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void queue(() => s.refresh({ width: s.o.width, height: s.o.height, aspect: s.o.aspect, nmax: s.o.nmax }))
        .catch(e => process.stderr.write(`reload after ${file} changed: ${(e as Error).message}\n`));
    }, 150);
  });

  const token = crypto.randomBytes(16).toString("hex");
  let idle: NodeJS.Timeout;
  const touch = () => { clearTimeout(idle); idle = setTimeout(() => shutdown(), o.idleMinutes * 60_000); };
  let served = 0;
  const server = http.createServer(async (req, res) => {
    if (req.headers["x-dolly-token"] !== token) { res.statusCode = 403; return res.end(); }
    touch();
    if (req.method === "GET" && req.url === "/status") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(status())); }
    if (req.method === "POST" && req.url === "/stop") { res.end("{}"); return shutdown(); }
    if (req.method !== "POST" || req.url !== "/run") { res.statusCode = 404; return res.end(); }
    let body = "";
    for await (const c of req) body += c;
    const { argv, cwd } = JSON.parse(body) as { argv: string[]; cwd: string };
    res.writeHead(200, { "content-type": "application/x-ndjson" });
    const send = (m: unknown) => res.write(JSON.stringify(m) + "\n");
    const beat = setInterval(() => send({ h: 1 }), 20_000);
    await queue(async () => {
      const home = process.cwd();
      const saved = { ...io };
      io.out = x => send({ o: x });
      io.err = x => send({ e: x });
      let code: number;
      try { process.chdir(cwd); code = await main(argv); }
      catch (e) { io.err(`dolly: ${(e as Error).message}\n`); code = EXIT.render; }
      finally { Object.assign(io, saved); process.chdir(home); }
      served++;
      clearInterval(beat);
      res.end(JSON.stringify({ exit: code }) + "\n");
    });
    touch();
  });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const file = daemonFile(o.project);
  const record: DaemonFile = { pid: process.pid, port, token, project: s.build.dir, workers: s.workers.length, env: launchEnv(), started: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(record));
  touch();

  function status() {
    return { pid: process.pid, url: `http://127.0.0.1:${port}`, project: s.build.dir, workers: s.workers.length, width: s.width, height: s.height, startMs, served, started: record.started };
  }
  let stopping = false;
  function shutdown(): void {
    if (stopping) return;
    stopping = true;
    watcher.close();
    // only remove the file if it is still ours (a newer daemon may have replaced it)
    try { if (readDaemon(o.project)?.pid === process.pid) fs.rmSync(file, { force: true }); } catch { /* gone */ }
    server.close();
    s.dispose();
    setTimeout(() => process.exit(0), 200);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return { status };
}
