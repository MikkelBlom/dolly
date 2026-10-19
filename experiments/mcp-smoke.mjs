// Minimal stdio JSON-RPC client: initialize, list tools, call dolly_info and dolly_sheet.
import { spawn } from "node:child_process";
const p = spawn(process.execPath, ["packages/cli/bin/dolly.ts", "mcp"], { stdio: ["pipe", "pipe", "inherit"] });
let buf = "", id = 0; const pending = new Map();
p.stdout.on("data", d => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue; const m = JSON.parse(line); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } });
const call = (method, params) => new Promise(r => { const n = ++id; pending.set(n, r); p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: n, method, params }) + "\n"); });
const init = await call("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
console.log("server:", init.result?.serverInfo, "protocol:", init.result?.protocolVersion, init.error ?? "");
p.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
const tools = await call("tools/list", {});
console.log("tools:", tools.result?.tools?.map(t => t.name).join(", "));
const info = await call("tools/call", { name: "dolly_info", arguments: { project: "examples/price-peek" } });
console.log("info:", info.result?.content?.[0]?.text?.slice(0, 120));
const sheet = await call("tools/call", { name: "dolly_sheet", arguments: { project: "examples/price-peek", cols: 3, rows: 2 } });
console.log("sheet:", sheet.result?.content?.map(c => c.type === "image" ? `image ${c.mimeType} ${Math.round(c.data.length * 0.75 / 1024)} KB` : c.text.slice(0, 80)));
p.kill(); process.exit(0);
