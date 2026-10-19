// Odometer: digits that differ roll up from the old string to the new one, right to left. Use roll()
// for numbers and slide() for labels (a per-character roll on text of different lengths misaligns).
import { ensureStyle, escapeHtml } from "../dom.ts";
import { expoOut } from "../easing.ts";
import { clamp } from "../math.ts";

const CSS = `
.dolly-rl{display:inline-block;overflow:hidden;height:var(--dolly-lh,1.75em);vertical-align:top}
.dolly-rl>span{display:block}
.dolly-rl>span>span{display:block;height:var(--dolly-lh,1.75em)}`;

const cell = (c: string) => (c === " " || !c ? "&nbsp;" : escapeHtml(c));

/** HTML for the roll from a to b at progress p (0..1). Set the line height with --dolly-lh. */
export function roll(a: string, b: string, p: number): string {
  ensureStyle("odometer", CSS);
  const n = Math.max(a.length, b.length), A = a.padStart(n, " "), B = b.padStart(n, " ");
  let html = "";
  for (let i = 0; i < n; i++) {
    const ca = A[i] === " " ? "" : A[i], cb = B[i] === " " ? "" : B[i];
    if (ca === cb) { html += cell(cb); continue; }
    const q = expoOut(clamp(p * 1.4 - (n - 1 - i) * 0.05));
    if (q >= 1) { html += cell(cb); continue; }
    html += `<span class="dolly-rl"><span style="transform:translateY(${-q * 50}%)"><span>${cell(ca)}</span><span>${cell(cb)}</span></span></span>`;
  }
  return html;
}

/** Whole-string swap: the old text slides up and out as the new one rises in. */
export function slide(a: string, b: string, p: number): string {
  ensureStyle("odometer", CSS);
  const q = expoOut(clamp(p));
  return q >= 1 ? escapeHtml(b) : `<span class="dolly-rl"><span style="transform:translateY(${-q * 50}%)"><span>${escapeHtml(a)}</span><span>${escapeHtml(b)}</span></span></span>`;
}

/** Set innerHTML only when it changed, so unchanged frames don't rebuild DOM (and keep element identity). */
export function setHtml(el: HTMLElement, html: string): void {
  if ((el as HTMLElement & { __dollyHtml?: string }).__dollyHtml === html) return;
  el.innerHTML = html;
  (el as HTMLElement & { __dollyHtml?: string }).__dollyHtml = html;
}

/** Count a number from a to b with an easing; format() renders it (locale, currency…). */
export function countUp(a: number, b: number, p: number, format: (n: number) => string = n => Math.round(n).toString()): string {
  return format(a + (b - a) * expoOut(clamp(p)));
}
