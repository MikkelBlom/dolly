// Price Peek: product logic, beat timings and the styles every scene shares.
import { ensureStyle } from "@dolly/core";

// Same EUR-based rates and Danish formatting as the extension, so every number on screen is real.
export const R: Record<string, number> = { EUR: 1, DKK: 7.4748, KRW: 1499.01, USD: 1.1253, GBP: 0.84385, JPY: 177.82, CNY: 7.524, CHF: 0.9272, THB: 37.602 };
const dk = (n: number, d = 0) => n.toLocaleString("da-DK", { minimumFractionDigits: d, maximumFractionDigits: d });
const FMT: Record<string, { pre?: string; suf?: string }> = { DKK: { suf: " kr." }, EUR: { pre: "€" }, USD: { pre: "$" }, GBP: { pre: "£" } };
export function money(v: number, c = "DKK"): string {
  const f = FMT[c]; let num: string, sc = "";
  if (v >= 1e9) { num = dk(v / 1e9, 1); sc = " mia."; } else if (v >= 1e8) { num = dk(v / 1e6, 0); sc = " mio."; }
  else if (v >= 1e6) { num = dk(v / 1e6, 1); sc = " mio."; } else if (v >= 10) num = dk(Math.round(v)); else num = dk(v, 2);
  return f.pre ? `${f.pre}${num}${sc}` : `${num}${sc}${f.suf}`;
}
export const conv = (v: number, from: string, to = "DKK"): string => money(v / R[from] * R[to], to);

// Beat grid: 120 BPM, one beat = 0.5 s.
export const T_REEL = [7.25, 9.25, 11.25, 13.25];
export const REEL_X = 2190, REEL_Y0 = 330, REEL_GAP = 250;
export const T_D = { popIn: 13.55, cursorIn: 14.3, atSel: 15.0, open: 15.1, glide: 15.65, pick: 16.3, cursorOut: 17.4 };
export const T_E = { dolly: 19.0, zoom: 24.15, zoomEnd: 25.35 };
export const T_F = { logo: 25.5, name: 25.8, tag: 26.35 };

export function sharedStyles(): void {
  ensureStyle("price-peek", `
#dolly-stage{font-variant-numeric:tabular-nums}
.pp-h{position:absolute;margin:0;font:800 76px/0.98 var(--f-display);letter-spacing:-.035em;color:var(--c-fg)}
.pp-abs{position:absolute}
.pp-mark{position:absolute;left:80px;bottom:56px;display:flex;align-items:center;gap:12px;font:700 24px var(--f-display);letter-spacing:-.01em}
.pp-mark i{display:inline-block;background:var(--c-ink);color:#fff;font:700 15px/1.75 var(--f-ui);font-style:normal;padding:0 .55em;border-radius:7px 7px 7px 1px}
.dolly-badge{letter-spacing:0}
.dolly-chip .city{display:block;margin-top:8px;font:600 15px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--c-muted)}
.dolly-chip .p{white-space:nowrap;position:relative;display:inline-block;margin-top:10px;font:700 44px/1.1 var(--f-price);letter-spacing:-.02em}
.dolly-chip .p .dolly-badge{top:-30px;right:-34px}
.pp-item{position:absolute;transform-origin:0 50%}
.pp-item .w,.pp-yen .w{position:relative;display:inline-block;font:700 92px/1.05 var(--f-price);letter-spacing:-.03em;white-space:nowrap}
.pp-item .w .dolly-badge,.pp-yen .w .dolly-badge{top:-34px;right:-46px;font-size:28px}
.pp-yen .w .dolly-badge{transform-origin:50% 100%}
.pp-item .note{display:block;margin-top:14px;font:600 16px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--c-muted)}
.pp-yen{position:absolute;transform-origin:0 50%;white-space:nowrap}
`);
}
