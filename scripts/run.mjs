#!/usr/bin/env node
// Launcher used by the Claude Code plugin (bin/dolly and the MCP server). The plugin is installed as a
// plain copy of this repository without node_modules, so on first run it installs the runtime
// dependencies next to it, then hands over to the CLI. Plain JS so it runs before anything is installed.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const need = ["esbuild", "@modelcontextprotocol/server", "zod"];
if (need.some(m => !fs.existsSync(path.join(root, "node_modules", m)))) {
  process.stderr.write("dolly: installing runtime dependencies (first run)…\n");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const r = spawnSync(npm, ["install", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: root, stdio: ["ignore", "inherit", "inherit"], shell: process.platform === "win32" });
  if (r.status !== 0) { process.stderr.write("dolly: npm install failed; run it yourself in " + root + "\n"); process.exit(6); }
}
const { main } = await import(pathToFileURL(path.join(root, "packages/cli/src/main.ts")).href);
process.exitCode = await main(process.argv.slice(2));
