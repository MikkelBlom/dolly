// Typing into an input: characters appear one per keystroke and drop in (scale 1.25 → 1); the caret
// blinks only while idle. Returns the typed state so scenes can react (badges that update per key).
import { ensureStyle, escapeHtml } from "../dom.ts";
import { expoOut } from "../easing.ts";
import { clamp, lerp, prog } from "../math.ts";

const CSS = `
.dolly-ch{display:inline-block}
.dolly-caret{display:inline-block;width:2px;height:1.05em;background:var(--c-accent);vertical-align:-.15em;margin-left:2px}`;

export interface TypingOptions {
  /** First keystroke. */
  t0: number;
  /** Seconds per keystroke (0.18–0.25 reads as deliberate typing). */
  gap: number;
  text: string;
  /** Display formatting of the typed text (e.g. thousands separators). */
  format?: (typed: string) => string;
  /** Caret shown while focused. */
  focused?: boolean;
}

export interface TypingState {
  /** Characters typed so far. */
  n: number;
  typed: string;
  /** Time of the latest keystroke (or -Infinity). */
  last: number;
  /** HTML for the characters plus caret. */
  html: string;
}

export function typing(t: number, o: TypingOptions): TypingState {
  ensureStyle("typing", CSS);
  const n = clamp(Math.floor((t - o.t0) / o.gap) + 1, 0, o.text.length);
  const typed = o.text.slice(0, n), last = n ? o.t0 + (n - 1) * o.gap : -Infinity;
  const shown = o.format ? o.format(typed) : typed;
  const chars = [...shown].map((ch, i, all) => {
    const isNew = i === all.length - 1 && t - last < 0.25;
    const q = isNew ? expoOut(prog(t, last, 0.22)) : 1;
    return `<span class="dolly-ch" style="transform:translateY(${(1 - q) * -14}px) scale(${lerp(1.25, 1, q)});opacity:${q}">${escapeHtml(ch)}</span>`;
  }).join("");
  const caret = o.focused && ((t * 1.9) % 1 < 0.55 || t - last < 0.5) ? `<span class="dolly-caret"></span>` : "";
  return { n, typed, last, html: chars + caret };
}
