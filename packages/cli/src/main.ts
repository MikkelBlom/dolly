// dolly CLI. Agent-first: every command takes --json and then prints exactly one JSON object on stdout
// (progress goes to stderr); image-producing commands print the paths of the images; exit codes mean
// something; errors name the scene, element and time.
import fs from "node:fs";
import path from "node:path";
import { parseArgs, num, list, size, UsageError, type Parsed } from "./args.ts";
import { HELP, COMMAND_HELP } from "./help.ts";

export const EXIT = { ok: 0, usage: 1, project: 2, render: 3, lint: 4, determinism: 5, environment: 6 } as const;

class CliError extends Error {
  code: number; detail?: Record<string, unknown>;
  constructor(code: number, message: string, detail?: Record<string, unknown>) { super(message); this.code = code; this.detail = detail; }
}

const out = (json: boolean, value: unknown, human: () => string) => {
  if (json) process.stdout.write(JSON.stringify(value) + "\n");
  else process.stdout.write(human() + "\n");
};

const progress = (json: boolean, quiet: boolean) => (p: { stage: string; done: number; total: number; elapsedMs: number }) => {
  if (quiet) return;
  if (p.done % 30 && p.done !== p.total) return;
  const line = `${p.stage} ${p.done}/${p.total} · ${(p.elapsedMs / 1000).toFixed(1)} s`;
  if (json) process.stderr.write(JSON.stringify({ progress: p }) + "\n");
  else process.stderr.write(`\r${line}   `);
};

function projectArg(a: Parsed): string {
  const p = a._[1] ?? (typeof a.flags.project === "string" ? a.flags.project : ".");
  return path.resolve(p);
}

async function session(a: Parsed, extra: Record<string, unknown> = {}) {
  const { Session } = await import("@dolly/render");
  try {
    return await Session.open({ project: projectArg(a), workers: num(a.flags.workers), aspect: typeof a.flags.aspect === "string" ? a.flags.aspect : undefined, ...size(a.flags.size), ...extra });
  } catch (e) {
    throw new CliError(EXIT.project, (e as Error).message);
  }
}

const outDir = (a: Parsed, project: string, sub: string) => path.resolve(typeof a.flags.out === "string" ? a.flags.out : path.join(project, "out", sub));

const COMMANDS: Record<string, (a: Parsed) => Promise<number>> = {
  async help(a) { process.stdout.write((a._[1] && COMMAND_HELP[a._[1]]) || HELP); return EXIT.ok; },

  async doctor(a) {
    const { findBrowser, ffmpegAvailable } = await import("@dolly/render");
    const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
    checks.push({ name: "node", ok: +process.versions.node.split(".")[0] >= 24, detail: process.version });
    try { const b = findBrowser(); checks.push({ name: "chromium", ok: true, detail: `${b.kind}: ${b.exe}` }); }
    catch (e) { checks.push({ name: "chromium", ok: false, detail: (e as Error).message }); }
    const ff = ffmpegAvailable();
    checks.push({ name: "ffmpeg", ok: ff.ok, detail: ff.version ?? "not on PATH" });
    for (const enc of ["h264_nvenc", "hevc_nvenc", "libx264", "prores_ks"]) checks.push({ name: enc, ok: ff.encoders.includes(enc), detail: ff.encoders.includes(enc) ? "available" : "missing (presets using it will fail)" });
    const ok = checks.filter(c => ["node", "chromium", "ffmpeg"].includes(c.name)).every(c => c.ok);
    out(!!a.flags.json, { ok, checks }, () => checks.map(c => `${c.ok ? "✓" : "✗"} ${c.name.padEnd(10)} ${c.detail}`).join("\n"));
    return ok ? EXIT.ok : EXIT.environment;
  },

  async new(a) {
    const { scaffold } = await import("./scaffold.ts");
    const dir = a._[1];
    if (!dir) throw new UsageError("usage: dolly new <dir> [--title \"…\"] [--aspect 16:9] [--duration 15] [--storyboard file.json]");
    const r = scaffold(path.resolve(dir), {
      title: typeof a.flags.title === "string" ? a.flags.title : path.basename(path.resolve(dir)),
      aspect: typeof a.flags.aspect === "string" ? a.flags.aspect as any : "16:9",
      duration: num(a.flags.duration, 15)!, storyboard: typeof a.flags.storyboard === "string" ? path.resolve(a.flags.storyboard) : undefined,
      force: !!a.flags.force,
    });
    out(!!a.flags.json, { ok: true, ...r }, () => `created ${r.dir}\n${r.files.map(f => "  " + f).join("\n")}\nnext: dolly sheet ${path.relative(process.cwd(), r.dir) || "."}`);
    return EXIT.ok;
  },

  async info(a) {
    const s = await session(a, { workers: 1 });
    try {
      const v = { ok: true, title: s.meta.title, duration: s.meta.duration, fps: s.meta.fps, stage: s.meta.stage, bpm: s.meta.bpm, aspect: s.meta.aspect, scenes: s.meta.scenes, markers: s.meta.markers, hashes: { global: s.build.globalHash.slice(0, 12), scenes: s.build.sceneHashes } };
      out(!!a.flags.json, v, () => [`${v.title} · ${v.duration} s @ ${v.fps} fps · stage ${v.stage.width}×${v.stage.height}${v.bpm ? ` · ${v.bpm} BPM` : ""}`,
        ...v.scenes.map((x: any) => `  ${x.start.toFixed(2).padStart(6)}–${x.end.toFixed(2).padEnd(6)} ${x.name}${x.file ? `  (${x.file})` : ""}`),
        `markers: ${v.markers.map((m: any) => `${m.name}@${m.t}`).join(", ")}`].join("\n"));
    } finally { s.close(); }
    return EXIT.ok;
  },

  async still(a) {
    const times = list(a.flags.times ?? a.flags.t ?? a._[2]);
    if (!times?.length) throw new UsageError("usage: dolly still [project] --times 1.5,4,7.2 [--blur] [--out dir]");
    const { stills } = await import("@dolly/render");
    const s = await session(a, { workers: Math.min(times.length, num(a.flags.workers, 4)!) });
    try {
      const r = await stills(s, { times, outDir: outDir(a, s.build.dir, "stills"), blur: !!a.flags.blur });
      out(!!a.flags.json, { ok: true, stills: r }, () => r.map(x => `${x.t.toFixed(2)} s  ${x.scene.padEnd(14)} ${x.path}`).join("\n"));
    } catch (e) { throw new CliError(EXIT.render, (e as Error).message); } finally { s.close(); }
    return EXIT.ok;
  },

  async sheet(a) {
    const { sheet } = await import("@dolly/render");
    const s = await session(a, { workers: num(a.flags.workers, 6) });
    try {
      const file = typeof a.flags.out === "string" ? path.resolve(a.flags.out) : path.join(s.build.dir, "out", `sheet${a.flags.from !== undefined ? `-${a.flags.from}-${a.flags.to}` : ""}.png`);
      const r = await sheet(s, { from: num(a.flags.from), to: num(a.flags.to), cols: num(a.flags.cols), rows: num(a.flags.rows), times: list(a.flags.times), out: file, blur: !!a.flags.blur, cellWidth: num(a.flags.cell) });
      out(!!a.flags.json, { ok: true, ...r }, () => `${r.path}\n${r.cells.map(c => `${c.t.toFixed(2)}s ${c.scene}`).join(" · ")}`);
    } catch (e) { throw new CliError(EXIT.render, (e as Error).message); } finally { s.close(); }
    return EXIT.ok;
  },

  async draft(a) {
    return COMMANDS.render({ ...a, flags: { preset: "draft", size: "960x540", fps: "30", blur: false, ...a.flags, _draft: true } });
  },

  async render(a) {
    const { render } = await import("@dolly/render");
    const json = !!a.flags.json;
    const blur = a.flags.blur === false ? false : { ...(num(a.flags.shutter) ? { shutter: num(a.flags.shutter)! } : {}), ...(num(a.flags.gap) ? { gap: num(a.flags.gap)! } : {}), ...(num(a.flags.nmax) ? { nmax: num(a.flags.nmax)! } : {}) };
    const project = projectArg(a);
    const isDraft = !!a.flags._draft;
    try {
      const r = await render({
        project, workers: num(a.flags.workers), aspect: typeof a.flags.aspect === "string" ? a.flags.aspect : undefined, ...size(a.flags.size),
        fps: num(a.flags.fps), from: num(a.flags.from), to: num(a.flags.to), preset: (a.flags.preset as any) ?? "youtube", blur,
        cache: a.flags.cache !== false, audio: a.flags.audio !== false, nmax: num(a.flags.nmax),
        out: typeof a.flags.out === "string" ? path.resolve(a.flags.out) : isDraft ? path.join(project, "out", "draft.mp4") : undefined,
        onProgress: progress(json, !!a.flags.quiet),
      });
      if (!json && !a.flags.quiet) process.stderr.write("\n");
      out(json, { ok: true, ...r }, () => [
        `${r.out}`,
        `${r.frames} frames ${r.width}×${r.height}@${r.fps} · ${r.preset} · ${(r.wallMs / 1000).toFixed(1)} s wall (${r.throughput.outputFps.toFixed(1)} fps, ${r.workers} workers)`,
        `cache ${r.cache.hits} hit / ${r.cache.misses} rendered${r.blur ? ` · blur ${r.blur.samples} sub-frames, N ${Object.entries(r.blur.histogram).map(([n, c]) => `${n}:${c}`).join(" ")}` : ""}`,
      ].join("\n"));
      return EXIT.ok;
    } catch (e) {
      const m = (e as Error).message;
      const sc = m.match(/scene "([^"]+)" at t=([\d.]+)s/);
      throw new CliError(EXIT.render, m, sc ? { scene: sc[1], t: +sc[2] } : undefined);
    }
  },

  async lint(a) {
    const { lint } = await import("@dolly/lint");
    const s = await session(a, { workers: num(a.flags.workers, 8) });
    try {
      const r = await lint(s, { step: num(a.flags.step) });
      const strict = !!a.flags.strict;
      const line = (f: typeof r.findings[number]) => `  ${f.t0.toFixed(2).padStart(6)}–${f.t1.toFixed(2).padEnd(6)} ${f.scene ?? "-"}${f.element ? ` · ${f.element}` : ""}\n      ${f.message}${f.fix ? ` → ${f.fix}` : ""}`;
      // human output: grouped by rule, a few examples each (--all for every finding; --json is always complete)
      const groups = new Map<string, typeof r.findings>();
      for (const f of r.findings) groups.set(`${f.severity} ${f.rule}`, [...(groups.get(`${f.severity} ${f.rule}`) ?? []), f]);
      const order = ["error", "warn", "info"];
      out(!!a.flags.json, r, () => r.findings.length
        ? [...groups].sort((x, y) => order.indexOf(x[1][0].severity) - order.indexOf(y[1][0].severity)).map(([g, fs_]) =>
            `${g} (${fs_.length})\n${(a.flags.all ? fs_ : fs_.slice(0, 3)).map(line).join("\n")}${!a.flags.all && fs_.length > 3 ? `\n  … ${fs_.length - 3} more (--all)` : ""}`).join("\n")
          + `\n${r.errors} errors, ${r.warnings} warnings, ${r.infos} info (${r.samples} samples)`
        : `clean (${r.samples} samples)`);
      return r.errors || (strict && r.warnings) ? EXIT.lint : EXIT.ok;
    } finally { s.close(); }
  },

  async diff(a) {
    const { determinism } = await import("@dolly/render");
    const s = await session(a, { workers: 2 });
    try {
      const r = await determinism(s, { times: list(a.flags.times), blur: !!a.flags.blur, outDir: outDir(a, s.build.dir, "determinism") });
      out(!!a.flags.json, r, () => r.ok ? `deterministic: ${r.checked} frames identical across render orders and workers` : r.mismatches.map(m => `✗ t=${m.t} (${m.scene}, ${m.samples}×) differs: ${m.diffPath}`).join("\n"));
      return r.ok ? EXIT.ok : EXIT.determinism;
    } finally { s.close(); }
  },

  async bench(a) {
    const { bench } = await import("@dolly/render");
    const s = await session(a, {});
    try {
      const r = await bench(s, { frames: num(a.flags.frames), outDir: outDir(a, s.build.dir, "bench") });
      const startup = { stage: `start ${s.workers.length} browsers`, fps: 0, msPerFrame: 0, note: `${(s.timings.startMs / 1000).toFixed(1)} s` };
      out(!!a.flags.json, { ok: true, ...r, startupMs: s.timings.startMs }, () => [`${r.machine.workers} workers · ${r.machine.width}×${r.machine.height}`, `${startup.stage}: ${startup.note}`,
        ...r.stages.map(x => `${x.stage.padEnd(52)} ${x.fps.toFixed(1).padStart(8)} fps ${x.msPerFrame.toFixed(1).padStart(8)} ms/frame  ${x.note}`)].join("\n"));
      return EXIT.ok;
    } finally { s.close(); }
  },

  async storyboard(a) {
    const { validateStoryboard, storyboardSchema } = await import("@dolly/core");
    const sub = a._[1];
    if (sub === "schema") { process.stdout.write(JSON.stringify(storyboardSchema, null, 2) + "\n"); return EXIT.ok; }
    if (sub !== "check" || !a._[2]) throw new UsageError("usage: dolly storyboard check <file.json> | dolly storyboard schema");
    let data: unknown;
    try { data = JSON.parse(fs.readFileSync(path.resolve(a._[2]), "utf8")); } catch (e) { throw new CliError(EXIT.project, `can't read ${a._[2]}: ${(e as Error).message}`); }
    const r = validateStoryboard(data);
    out(!!a.flags.json, r, () => [...r.problems.map(p => `${p.severity.padEnd(5)} ${p.path}: ${p.message}`), r.timeline.map(t => `${t.start.toFixed(2)}–${t.end.toFixed(2)} ${t.name}`).join("\n"), r.ok ? "ok" : "invalid"].filter(Boolean).join("\n"));
    return r.ok ? EXIT.ok : EXIT.lint;
  },

  async dev(a) {
    const { startDev } = await import("@dolly/player");
    const d = await startDev({ project: projectArg(a), port: num(a.flags.port), open: !!a.flags.open });
    out(!!a.flags.json, { ok: true, url: d.url }, () => `player: ${d.url}\n(watching for changes; Ctrl+C to stop)`);
    await new Promise(() => {});
    return EXIT.ok;
  },

  async mcp() {
    const { startMcp } = await import("@dolly/mcp");
    await startMcp();
    await new Promise(() => {});
    return EXIT.ok;
  },
};

export async function main(argv: string[]): Promise<number> {
  const a = parseArgs(argv);
  const cmd = a._[0] ?? "help";
  if (a.flags.help) return COMMANDS.help({ ...a, _: ["help", cmd] });
  const fn = COMMANDS[cmd];
  const json = !!a.flags.json;
  if (!fn) { process.stderr.write(`unknown command "${cmd}"\n\n${HELP}`); return EXIT.usage; }
  try { return await fn(a); }
  catch (e) {
    const code = e instanceof CliError ? e.code : e instanceof UsageError ? EXIT.usage : EXIT.render;
    const message = (e as Error).message;
    if (json) process.stdout.write(JSON.stringify({ ok: false, error: { code, message, ...(e instanceof CliError ? e.detail : {}) } }) + "\n");
    else process.stderr.write(`dolly ${cmd}: ${message}\n`);
    if (process.env.DOLLY_DEBUG) process.stderr.write(String((e as Error).stack) + "\n");
    return code;
  }
}
