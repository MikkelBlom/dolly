// Design tokens. A video adopts a brand by swapping its theme: colours, fonts, radii and shadows become
// CSS custom properties (--c-*, --f-*, --r-*, --s-*) that components read, so nothing hard-codes a
// colour. Fonts are self-hosted files gated before frame 0, so renders never depend on the network.

export interface FontFace { family: string; src: string; weight?: string; style?: string; stretch?: string }

export interface Theme {
  name: string;
  colors: { bg: string; fg: string; accent: string; muted: string; surface: string; ink: string; [k: string]: string };
  fonts: { display: string; body: string; mono?: string; ui?: string; [k: string]: string | undefined };
  /** Font files to load (relative to the project, or absolute URLs). */
  fontFaces?: FontFace[];
  radii: { sm: number; md: number; lg: number; [k: string]: number };
  shadows: { card: string; float: string; [k: string]: string };
  /** Free-form extra tokens exposed as --x-<key>. */
  extra?: Record<string, string | number>;
}

export function defineTheme(t: Theme): Theme { return t; }

/** Theme → CSS text (custom properties on :root plus @font-face rules). */
export function themeCss(t: Theme, base = ""): string {
  const vars: string[] = [];
  for (const [k, v] of Object.entries(t.colors)) vars.push(`--c-${k}:${v}`);
  for (const [k, v] of Object.entries(t.fonts)) if (v) vars.push(`--f-${k}:${v}`);
  for (const [k, v] of Object.entries(t.radii)) vars.push(`--r-${k}:${v}px`);
  for (const [k, v] of Object.entries(t.shadows)) vars.push(`--s-${k}:${v}`);
  for (const [k, v] of Object.entries(t.extra ?? {})) vars.push(`--x-${k}:${v}`);
  const faces = (t.fontFaces ?? []).map(f => {
    const url = /^(https?:|data:|\/)/.test(f.src) ? f.src : base + f.src;
    return `@font-face{font-family:"${f.family}";src:url("${url}");font-weight:${f.weight ?? "400"};font-style:${f.style ?? "normal"};${f.stretch ? `font-stretch:${f.stretch};` : ""}font-display:block}`;
  });
  return `${faces.join("\n")}\n:root{${vars.join(";")}}`;
}

/** A neutral default theme (system fonts) so a new project renders before a brand is applied. */
export const defaultTheme: Theme = {
  name: "default",
  colors: { bg: "#eef1f6", fg: "#14161b", accent: "#3355ff", muted: "#8a90a0", surface: "#ffffff", ink: "#14161b", line: "#dfe2e8" },
  fonts: { display: '"Segoe UI", system-ui, sans-serif', body: '"Segoe UI", system-ui, sans-serif', mono: "Consolas, monospace", ui: '"Segoe UI", system-ui, sans-serif' },
  radii: { sm: 8, md: 14, lg: 22 },
  shadows: {
    card: "0 24px 48px -28px rgba(20,24,40,.35), 0 0 0 1px rgba(20,24,40,.05)",
    float: "0 50px 90px -40px rgba(20,24,40,.5), 0 0 0 1px rgba(20,24,40,.06)",
  },
};

/** WCAG relative luminance of a #rgb/#rrggbb/rgb()/rgba() colour (alpha ignored). */
export function luminance(color: string): number {
  const [r, g, b] = parseColor(color);
  const ch = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG contrast ratio between two colours (1..21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function parseColor(c: string): [number, number, number, number] {
  c = c.trim();
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map(x => x + x).join("");
    const n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`can't parse colour "${c}"`);
}
