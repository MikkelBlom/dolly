// @dolly/player: `dolly dev`. Serves a review UI next to the scene document, rebuilds on file changes
// and tells the page to reload (keeping the playhead) over server-sent events.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { buildProject, serve, type Server } from "@dolly/render";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export interface Dev { url: string; server: Server; close(): void }

export async function startDev(o: { project: string; port?: number; open?: boolean }): Promise<Dev> {
  let build = await buildProject(o.project);
  let lastError: string | null = null;
  const ui = await esbuild.build({ entryPoints: [path.join(HERE, "ui.ts")], bundle: true, write: false, format: "iife", target: "chrome120", logLevel: "silent" });
  const uiJs = ui.outputFiles[0].text;
  const uiHtml = fs.readFileSync(path.join(HERE, "ui.html"), "utf8");
  const server = await serve(build, undefined, o.port ?? 0).catch(() => serve(build));
  const clients = new Set<import("node:http").ServerResponse>();
  const send = (event: string, data: unknown) => { for (const c of clients) c.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };

  server.routes.set("/", (_req, res) => { res.setHeader("content-type", "text/html"); res.end(uiHtml); });
  server.routes.set("/player.js", (_req, res) => { res.setHeader("content-type", "text/javascript"); res.end(uiJs); });
  server.routes.set("/events", (req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write(`event: hello\ndata: ${JSON.stringify({ error: lastError })}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
  });
  // audio files the user drops into the page are kept in memory; project audio is served from /project/
  server.routes.set("/api/build", (_req, res) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ globalHash: build.globalHash, sceneHashes: build.sceneHashes, error: lastError })); });

  // rebuild on change (debounced); the page reloads its scene frame and restores the playhead
  let timer: NodeJS.Timeout | null = null;
  const watcher = fs.watch(build.dir, { recursive: true }, (_ev, file) => {
    if (!file || /(^|[\\/])(\.dolly|out|node_modules|\.git)([\\/]|$)/.test(file)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        build = await buildProject(o.project);
        lastError = null;
        send("reload", { file, hash: build.globalHash.slice(0, 8) });
      } catch (e) {
        lastError = (e as Error).message;
        send("error", { message: lastError, file });
      }
    }, 120);
  });

  const url = server.url + "/";
  if (o.open) {
    const { spawn } = await import("node:child_process");
    spawn(process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open", process.platform === "win32" ? ["/c", "start", "", url] : [url], { stdio: "ignore", detached: true }).unref();
  }
  return { url, server, close: () => { watcher.close(); server.close(); } };
}
