// Small DOM helpers shared by components and scenes (browser only).

/** Set transform and opacity together; fully transparent elements are also hidden so they skip paint. */
export function tf(el: HTMLElement | SVGElement, transform: string, opacity = 1): void {
  el.style.transform = transform;
  el.style.opacity = String(opacity);
  // "" rather than "visible", so a hidden ancestor still hides it
  el.style.visibility = opacity <= 0.001 ? "hidden" : "";
}

/** Show or hide without touching transform. */
export function show(el: HTMLElement, on: boolean): void { el.style.visibility = on ? "" : "hidden"; }

/** Inject a stylesheet once per document (components call this from their setup). */
export function ensureStyle(id: string, css: string): void {
  if (typeof document === "undefined" || document.getElementById(`dolly-style-${id}`)) return;
  const s = document.createElement("style");
  s.id = `dolly-style-${id}`;
  s.textContent = css;
  document.head.append(s);
}

/** Create an element: h("div", { class: "chip", style: "left:10px" }, child, "text"). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | number | undefined> = {}, ...children: Array<Node | string>): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) el.setAttribute(k, String(v));
  for (const c of children) el.append(c);
  return el;
}

/** Parse an HTML string into its first element. */
export function html<T extends HTMLElement = HTMLElement>(s: string): T {
  const t = document.createElement("template");
  t.innerHTML = s.trim();
  return t.content.firstElementChild as T;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

let stageEl: HTMLElement | null = null;
let stageScale = 1;
/** Called by the runtime when the stage is (re)fitted. */
export function setStage(el: HTMLElement, scale: number): void { stageEl = el; stageScale = scale; }
export const stageScaleFactor = (): number => stageScale;

/**
 * Where a point of an element currently is, in stage coordinates (fx, fy are fractions of its box).
 * Measures live layout, so it follows 3D tilts and animating parents: use it to aim a cursor.
 */
export function stagePoint(el: Element, fx = 0.5, fy = 0.5): [number, number] {
  if (!stageEl) throw new Error("stagePoint(): no stage mounted");
  const st = stageEl.getBoundingClientRect(), r = el.getBoundingClientRect();
  return [(r.left - st.left + r.width * fx) / stageScale, (r.top - st.top + r.height * fy) / stageScale];
}

/** An element's box in stage coordinates. */
export function stageRect(el: Element): { x: number; y: number; w: number; h: number } {
  if (!stageEl) throw new Error("stageRect(): no stage mounted");
  const st = stageEl.getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: (r.left - st.left) / stageScale, y: (r.top - st.top) / stageScale, w: r.width / stageScale, h: r.height / stageScale };
}
