// A video project on disk: bundle its entry for the browser, compute content hashes for the frame cache
// (one for everything shared, one per scene source file), and serve it over a local HTTP server.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const CORE_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../core/src/index.ts");
const HOST_HTML = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "host.html");

export interface Build {
  dir: string;
  entry: string;
  /** Hash of everything that isn't owned by one scene (runtime, theme, world, assets). */
  globalHash: string;
  /** Scene file (project-relative) → hash of its transitive inputs. */
  sceneHashes: Record<string, string>;
  /** Combined hash of the whole bundle. */
  bundleHash: string;
  /** Bundled JS. */
  js: string;
  warnings: string[];
}

const sha = (...parts: Array<string | Buffer>) => { const h = crypto.createHash("sha1"); for (const p of parts) h.update(p); return h.digest("hex"); };

/** Locate a project's entry file: an explicit path, or video.ts / video.js in the directory. */
export function resolveEntry(target: string): { dir: string; entry: string } {
  const abs = path.resolve(target);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return { dir: path.dirname(abs), entry: abs };
  for (const name of ["video.ts", "video.tsx", "video.js"]) {
    const p = path.join(abs, name);
    if (fs.existsSync(p)) return { dir: abs, entry: p };
  }
  throw new Error(`no video.ts in ${abs} (pass the project directory or the entry file)`);
}

const IGNORE = /(^|[\\/])(node_modules|\.dolly|out|dist|\.git)([\\/]|$)/;

/** Hash of every non-code file in the project (images, fonts, audio) that pages may load by URL. */
function assetsHash(dir: string): string {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (IGNORE.test(path.relative(dir, p))) continue;
      if (e.isDirectory()) walk(p);
      else if (!/\.(ts|tsx|js|mjs|json|md)$/.test(e.name)) files.push(p);
    }
  };
  walk(dir);
  files.sort();
  return sha(...files.map(f => `${path.relative(dir, f)}:${sha(fs.readFileSync(f))}`));
}

export async function buildProject(target: string): Promise<Build> {
  const { dir, entry } = resolveEntry(target);
  const out = path.join(dir, ".dolly", "build");
  fs.mkdirSync(out, { recursive: true });
  const sceneFiles = new Set<string>();
  const stamp: esbuild.Plugin = {
    name: "dolly-scene-stamp",
    setup(b) {
      // stamp every defineScene() call with its source file, so the cache knows what a scene depends on
      b.onLoad({ filter: /\.(ts|tsx|js)$/ }, async args => {
        if (!args.path.startsWith(dir) || IGNORE.test(path.relative(dir, args.path))) return undefined;
        let src = await fs.promises.readFile(args.path, "utf8");
        const rel = path.relative(dir, args.path).replace(/\\/g, "/");
        if (/\bdefineScene\s*\(/.test(src)) {
          sceneFiles.add(args.path);
          src = src.replace(/\bdefineScene\s*\(/g, `defineScene.from(${JSON.stringify(rel)}, `);
        }
        return { contents: src, loader: args.path.endsWith("x") ? "tsx" : args.path.endsWith(".js") ? "js" : "ts" };
      });
    },
  };
  const stub = `import video from ${JSON.stringify(entry.replace(/\\/g, "/"))};
import { mount } from "@dolly/core";
window.__dollyMount = mount(video, { assetBase: "/project/" }).catch(e => { window.__dollyError = String(e && e.stack || e); throw e; });`;
  const res = await esbuild.build({
    stdin: { contents: stub, resolveDir: dir, loader: "ts", sourcefile: "dolly-entry.ts" },
    bundle: true, write: false, format: "iife", target: "chrome120", metafile: true, sourcemap: "inline", absWorkingDir: dir,
    alias: { "@dolly/core": CORE_SRC }, plugins: [stamp], logLevel: "silent",
  });
  const js = res.outputFiles[0].text;
  const inputs = res.metafile.inputs;
  const absOf = (p: string) => path.resolve(dir, p);
  const content = new Map<string, string>();
  for (const p of Object.keys(inputs)) {
    const a = absOf(p);
    content.set(p, fs.existsSync(a) ? sha(fs.readFileSync(a)) : sha(p));
  }
  const isScene = (p: string) => sceneFiles.has(absOf(p));
  const closure = (roots: string[], stopAtScenes: boolean): string[] => {
    const seen = new Set<string>(), stack = [...roots];
    while (stack.length) {
      const p = stack.pop()!;
      if (seen.has(p) || !inputs[p]) continue;
      seen.add(p);
      for (const imp of inputs[p].imports) if (!(stopAtScenes && isScene(imp.path))) stack.push(imp.path);
    }
    return [...seen].sort();
  };
  const all = Object.keys(inputs);
  const rootInputs = all.filter(p => !all.some(q => inputs[q].imports.some(i => i.path === p)));
  const shared = closure(rootInputs, true).filter(p => !isScene(p));
  const globalHash = sha(assetsHash(dir), ...shared.map(p => `${p}:${content.get(p)}`));
  const sceneHashes: Record<string, string> = {};
  for (const p of all.filter(isScene)) {
    const rel = path.relative(dir, absOf(p)).replace(/\\/g, "/");
    sceneHashes[rel] = sha(...closure([p], false).map(q => `${q}:${content.get(q)}`));
  }
  fs.writeFileSync(path.join(out, "bundle.js"), js);
  fs.writeFileSync(path.join(out, "frame.html"), `<!doctype html><meta charset="utf-8"><title>dolly frame</title><body></body><script src="bundle.js"></script>`);
  fs.copyFileSync(HOST_HTML, path.join(out, "host.html"));
  return { dir, entry, globalHash, sceneHashes, bundleHash: sha(js), js, warnings: res.warnings.map(w => w.text) };
}

const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2",
  ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
  ".mp4": "video/mp4", ".webm": "video/webm", ".gif": "image/gif",
};

export interface Server { url: string; close(): void; routes: Map<string, (req: http.IncomingMessage, res: http.ServerResponse) => void> }

/** Serve the build at / and the project directory at /project/. Extra routes can be added. */
export function serve(build: { dir: string }, extraRoot?: Record<string, string>): Promise<Server> {
  const buildDir = path.join(build.dir, ".dolly", "build");
  const roots: Record<string, string> = { "/project/": build.dir, ...(extraRoot ?? {}), "/": buildDir };
  const routes = new Map<string, (req: http.IncomingMessage, res: http.ServerResponse) => void>();
  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    const route = routes.get(u.pathname);
    if (route) return route(req, res);
    const prefix = Object.keys(roots).find(p => u.pathname.startsWith(p))!;
    const file = path.join(roots[prefix], decodeURIComponent(u.pathname.slice(prefix.length)) || "index.html");
    if (!file.startsWith(roots[prefix]) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end("not found"); }
    res.setHeader("content-type", MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream");
    res.setHeader("cache-control", "no-store");
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => {
    const port = (server.address() as { port: number }).port;
    resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close(), routes });
  }));
}
