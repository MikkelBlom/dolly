// @dolly/mcp: a thin MCP server over the dolly CLI. It adds what MCP is good at: images returned inline
// (stills and contact sheets arrive in the same tool call, no separate file read) and long renders run
// as background jobs with status polling. Every tool shells out to the CLI with --json, so the CLI stays
// the single source of truth.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../cli/bin/dolly.ts");

interface CliResult { code: number; json: any; stderr: string }

function cli(args: string[], cwd?: string): Promise<CliResult> {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [CLI, ...args, "--json"], { cwd: cwd ?? process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", d => (out += d)); p.stderr.on("data", d => (err += d));
    p.on("close", code => {
      let json: any = null;
      try { json = JSON.parse(out.trim().split("\n").pop() ?? "null"); } catch { json = { ok: false, error: { message: out || err } }; }
      resolve({ code: code ?? 1, json, stderr: err });
    });
  });
}

/** Downscale to ≤ maxW and JPEG-encode, so images stay small in context; the full PNG stays on disk. */
function inlineImage(file: string, maxW = 1600): { type: "image"; data: string; mimeType: string } {
  const tmp = path.join(os.tmpdir(), `dolly-mcp-${process.pid}-${Date.now()}.jpg`);
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", file, "-vf", `scale='min(${maxW},iw)':-2`, "-q:v", "4", tmp]);
  if (r.status === 0 && fs.existsSync(tmp)) {
    const data = fs.readFileSync(tmp).toString("base64"); fs.rmSync(tmp, { force: true });
    return { type: "image", data, mimeType: "image/jpeg" };
  }
  return { type: "image", data: fs.readFileSync(file).toString("base64"), mimeType: "image/png" };
}

const text = (v: unknown) => ({ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 1) });
const fail = (r: CliResult) => ({ isError: true, content: [text(r.json?.error ?? r.stderr)] });

interface Job { id: string; args: string[]; started: number; progress: any; result: any; done: boolean; code: number | null }
const jobs = new Map<string, Job>();

function build(): McpServer {
  const server = new McpServer({ name: "dolly", version: "0.1.0" }, {
    capabilities: { tools: {} },
    instructions: "dolly renders code-driven motion-graphics videos. Review loop: dolly_sheet (look) → edit scene files → dolly_lint → dolly_render_start with draft:true (pacing) → final render. Paths are project directories containing video.ts. The dolly skill documents the scene API.",
  });

  server.registerTool("dolly_sheet", {
    title: "Contact sheet",
    description: "Render a labelled contact sheet (N×M frames spread over a time range) of a dolly video project and return it as an image. The first thing to look at after any change.",
    inputSchema: z.object({
      project: z.string().describe("project directory (contains video.ts)"),
      from: z.number().optional(), to: z.number().optional(),
      cols: z.number().int().optional(), rows: z.number().int().optional(),
      times: z.array(z.number()).optional().describe("explicit times instead of an even spread"),
      blur: z.boolean().optional().describe("render with motion blur (slower)"),
    }),
    annotations: { readOnlyHint: true },
  }, async a => {
    const args = ["sheet", a.project];
    if (a.from !== undefined) args.push("--from", String(a.from));
    if (a.to !== undefined) args.push("--to", String(a.to));
    if (a.cols) args.push("--cols", String(a.cols));
    if (a.rows) args.push("--rows", String(a.rows));
    if (a.times?.length) args.push("--times", a.times.join(","));
    if (a.blur) args.push("--blur");
    const r = await cli(args);
    if (r.code) return fail(r);
    return { content: [inlineImage(r.json.path), text({ path: r.json.path, cells: r.json.cells })] };
  });

  server.registerTool("dolly_still", {
    title: "Stills",
    description: "Render single frames at given times and return them as images (≤ 6 per call keeps context small).",
    inputSchema: z.object({ project: z.string(), times: z.array(z.number()).min(1).max(12), blur: z.boolean().optional() }),
    annotations: { readOnlyHint: true },
  }, async a => {
    const r = await cli(["still", a.project, "--times", a.times.join(","), ...(a.blur ? ["--blur"] : [])]);
    if (r.code) return fail(r);
    const stills = r.json.stills as Array<{ t: number; path: string; scene: string }>;
    return { content: [...stills.slice(0, 6).map(s => inlineImage(s.path, 1280)), text(stills)] };
  });

  server.registerTool("dolly_lint", {
    title: "Motion-grammar lint",
    description: "Check a video against motion-grammar rules (reading time, safe areas, text size, contrast, static spans, entrances, cuts). Returns findings with times, scene, element and a fix.",
    inputSchema: z.object({ project: z.string(), strict: z.boolean().optional() }),
    annotations: { readOnlyHint: true },
  }, async a => {
    const r = await cli(["lint", a.project, ...(a.strict ? ["--strict"] : [])]);
    if (r.json?.findings) return { content: [text(r.json)], isError: false };
    return fail(r);
  });

  server.registerTool("dolly_info", {
    title: "Project info",
    description: "Scenes, markers, duration, fps and stage size of a dolly project.",
    inputSchema: z.object({ project: z.string() }),
    annotations: { readOnlyHint: true },
  }, async a => { const r = await cli(["info", a.project]); return r.code ? fail(r) : { content: [text(r.json)] }; });

  server.registerTool("dolly_new", {
    title: "New project",
    description: "Scaffold a dolly video project (optionally from a storyboard JSON: one scene file per storyboard scene).",
    inputSchema: z.object({ dir: z.string(), title: z.string().optional(), aspect: z.enum(["16:9", "9:16", "1:1", "4:5"]).optional(), duration: z.number().optional(), storyboard: z.string().optional() }),
  }, async a => {
    const args = ["new", a.dir];
    if (a.title) args.push("--title", a.title);
    if (a.aspect) args.push("--aspect", a.aspect);
    if (a.duration) args.push("--duration", String(a.duration));
    if (a.storyboard) args.push("--storyboard", a.storyboard);
    const r = await cli(args);
    return r.code ? fail(r) : { content: [text(r.json)] };
  });

  server.registerTool("dolly_render_start", {
    title: "Start a render",
    description: "Start a render in the background and return a job id; poll dolly_render_status. draft:true renders 960×540 30 fps without blur in seconds. Final renders use adaptive motion blur and NVENC.",
    inputSchema: z.object({
      project: z.string(), draft: z.boolean().optional(),
      preset: z.enum(["youtube", "youtube-hevc", "archive", "prores", "webm-alpha", "web-av1", "lossless", "draft"]).optional(),
      from: z.number().optional(), to: z.number().optional(), out: z.string().optional(), noBlur: z.boolean().optional(),
    }),
  }, async a => {
    const args = [a.draft ? "draft" : "render", a.project];
    if (a.preset) args.push("--preset", a.preset);
    if (a.from !== undefined) args.push("--from", String(a.from));
    if (a.to !== undefined) args.push("--to", String(a.to));
    if (a.out) args.push("--out", a.out);
    if (a.noBlur) args.push("--no-blur");
    const id = `r${Date.now().toString(36)}`;
    const job: Job = { id, args, started: Date.now(), progress: null, result: null, done: false, code: null };
    jobs.set(id, job);
    const p = spawn(process.execPath, [CLI, ...args, "--json"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", d => (out += d));
    p.stderr.on("data", d => { for (const l of String(d).split("\n")) { try { const j = JSON.parse(l); if (j.progress) job.progress = j.progress; } catch { /* not a progress line */ } } });
    p.on("close", code => { job.done = true; job.code = code; try { job.result = JSON.parse(out.trim().split("\n").pop()!); } catch { job.result = { ok: false, error: { message: out } }; } });
    return { content: [text({ job: id, args })] };
  });

  server.registerTool("dolly_render_status", {
    title: "Render status",
    description: "Progress or result of a render started with dolly_render_start (output path, timings per stage, cache hits, blur histogram).",
    inputSchema: z.object({ job: z.string() }),
    annotations: { readOnlyHint: true },
  }, async a => {
    const j = jobs.get(a.job);
    if (!j) return { isError: true, content: [text(`no job ${a.job}`)] };
    return { content: [text({ job: j.id, done: j.done, elapsedS: +((Date.now() - j.started) / 1000).toFixed(1), progress: j.progress, result: j.result })] };
  });

  return server;
}

export async function startMcp(): Promise<void> {
  serveStdio(build);
}
