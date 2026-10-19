// Damped springs as closed-form functions of time (no integration, so any t can be evaluated directly and
// every worker gets the same value). Two parameterisations:
//   - frequency (Hz) + damping ratio zeta: how motion designers think ("1.8 Hz, a little bouncy")
//   - stiffness / mass / damping: how physics libraries (framer-motion, react-spring) are configured
// Both map onto the same solution of x'' + 2ζω x' + ω² x = 0 with x(0) = -1 (i.e. the value 0 → 1).

export interface SpringFreq { freq?: number; zeta?: number; velocity?: number }
export interface SpringPhysics { stiffness: number; mass?: number; damping: number; velocity?: number }
export type SpringParams = SpringFreq | SpringPhysics;

function toFreq(p: SpringParams = {}): { w: number; zeta: number; v0: number } {
  if ("stiffness" in p) {
    const m = p.mass ?? 1;
    const w = Math.sqrt(p.stiffness / m);
    return { w, zeta: p.damping / (2 * Math.sqrt(p.stiffness * m)), v0: p.velocity ?? 0 };
  }
  return { w: 2 * Math.PI * (p.freq ?? 1.8), zeta: p.zeta ?? 0.5, v0: p.velocity ?? 0 };
}

/**
 * Spring progress 0 → 1 at time t (seconds since release). Under-damped (zeta < 1) overshoots and
 * rings; critically damped (zeta = 1) is the fastest without overshoot; over-damped creeps.
 * `velocity` is the initial velocity in units of the full travel per second.
 */
export function spring(t: number, params: SpringParams = {}): number {
  if (t <= 0) return 0;
  const { w, zeta, v0 } = toFreq(params);
  // displacement from target x(t), x(0) = -1, x'(0) = v0
  let x: number;
  if (zeta < 1) {
    const wd = w * Math.sqrt(1 - zeta * zeta);
    const a = -1, b = (v0 + zeta * w * a) / wd;
    x = Math.exp(-zeta * w * t) * (a * Math.cos(wd * t) + b * Math.sin(wd * t));
  } else if (zeta === 1) {
    const a = -1, b = v0 + w * a;
    x = Math.exp(-w * t) * (a + b * t);
  } else {
    const s = w * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * w + s, r2 = -zeta * w - s;
    const c2 = (v0 - r1 * -1) / (r2 - r1), c1 = -1 - c2;
    x = c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  }
  return 1 + x;
}

/** Peak overshoot of an under-damped spring released from rest, as a fraction of the travel. */
export function springOvershoot(params: SpringParams = {}): number {
  const { zeta } = toFreq(params);
  return zeta >= 1 ? 0 : Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta));
}

/**
 * Time after which the spring stays within `tolerance` of its target (envelope bound). Lint uses it to
 * check a spring has settled before a cut, and timelines use it as a spring's effective duration.
 */
export function springSettleTime(params: SpringParams = {}, tolerance = 0.005): number {
  const { w, zeta } = toFreq(params);
  if (zeta < 1) return -Math.log(tolerance * Math.sqrt(1 - zeta * zeta)) / (zeta * w);
  // (over/critically damped) search numerically
  let t = 0;
  for (let i = 0; i < 2000 && Math.abs(1 - spring(t + 0.01, params)) > tolerance; i++) t += 0.01;
  return t;
}

/**
 * Apple-style spring from a perceptual duration and bounce (SwiftUI `.spring(duration:bounce:)`):
 * mass 1, stiffness (2π/d)², bounce 0 = critically damped, 0.15 = snappy, 0.3 = bouncy.
 */
export function appleSpring(duration: number, bounce = 0): SpringPhysics {
  const stiffness = (2 * Math.PI / duration) ** 2;
  const damping = bounce >= 0 ? (1 - bounce) * 4 * Math.PI / duration : 4 * Math.PI / (duration * (1 + bounce));
  return { stiffness, mass: 1, damping };
}
