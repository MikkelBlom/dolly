// Tiny argument parser: positionals, --flag, --key value, --key=value, --no-flag. No dependencies.

export interface Parsed { _: string[]; flags: Record<string, string | boolean> }

export function parseArgs(argv: string[]): Parsed {
  const out: Parsed = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { out._.push(...argv.slice(i + 1)); break; }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) { out.flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const key = a.slice(2);
      if (key.startsWith("no-")) { out.flags[key.slice(3)] = false; continue; }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--") && !BOOLEAN.has(key)) { out.flags[key] = next; i++; }
      else out.flags[key] = true;
    } else if (a.startsWith("-") && a.length === 2 && isNaN(+a)) {
      const key = SHORT[a[1]] ?? a[1];
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("-") && !BOOLEAN.has(key)) { out.flags[key] = next; i++; }
      else out.flags[key] = true;
    } else out._.push(a);
  }
  return out;
}

const SHORT: Record<string, string> = { t: "times", o: "out", w: "workers", j: "json", h: "help" };
const BOOLEAN = new Set(["json", "help", "blur", "cache", "audio", "open", "quiet", "force", "gpu", "strict", "verbose", "all", "mobile", "inspect"]);

export const num = (v: string | boolean | undefined, def?: number): number | undefined => {
  if (v === undefined || v === true || v === false) return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new UsageError(`expected a number, got "${v}"`);
  return n;
};

export const list = (v: string | boolean | undefined): number[] | undefined =>
  typeof v === "string" ? v.split(",").map(x => x.trim()).filter(Boolean).map(x => { const n = Number(x); if (!Number.isFinite(n)) throw new UsageError(`bad time "${x}"`); return n; }) : undefined;

export function size(v: string | boolean | undefined): { width?: number; height?: number } {
  if (typeof v !== "string") return {};
  const m = v.match(/^(\d+)x(\d+)$/);
  if (!m) throw new UsageError(`--size must look like 1920x1080 (got "${v}")`);
  return { width: +m[1], height: +m[2] };
}

export class UsageError extends Error { code = 1; }
