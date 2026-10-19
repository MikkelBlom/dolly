// ffmpeg encode presets (research.md §5) and a streaming encoder fed with PNG frames in order.
import { spawn, spawnSync } from "node:child_process";

export type Preset = "draft" | "youtube" | "youtube-hevc" | "archive" | "prores" | "webm-alpha" | "web-av1" | "lossless";

// RGB screenshots → BT.709 limited range. Without explicit matrix flags ffmpeg uses BT.601 for RGB
// input, which shifts brand colours.
const TO_709 = "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int";
const TAGS_709 = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];

export interface PresetSpec { ext: string; args: (fps: number) => string[]; vf?: string; alpha?: boolean; description: string }

export const PRESETS: Record<Preset, PresetSpec> = {
  draft: {
    ext: "mp4", description: "pacing check: NVENC p1, CQ 28",
    vf: `${TO_709},format=yuv420p`,
    args: fps => ["-c:v", "h264_nvenc", "-preset", "p1", "-rc", "vbr", "-cq", "28", "-b:v", "0", "-g", String(fps), ...TAGS_709, "-movflags", "+faststart"],
  },
  youtube: {
    ext: "mp4", description: "YouTube master: H.264 NVENC p7 hq, CQ 16, closed GOP ½ fps, 2 B-frames",
    vf: `${TO_709},format=yuv420p`,
    args: fps => ["-c:v", "h264_nvenc", "-preset", "p7", "-tune", "hq", "-rc", "vbr", "-cq", "16", "-b:v", "0", "-maxrate", "120M", "-bufsize", "240M",
      "-multipass", "fullres", "-bf", "2", "-b_ref_mode", "middle", "-spatial-aq", "1", "-temporal-aq", "1", "-rc-lookahead", "32",
      "-g", String(Math.round(fps / 2)), "-profile:v", "high", ...TAGS_709, "-movflags", "+faststart"],
  },
  "youtube-hevc": {
    ext: "mp4", description: "HEVC Main10 NVENC p7 uhq, CQ 18",
    vf: `${TO_709},format=p010le`,
    args: fps => ["-c:v", "hevc_nvenc", "-preset", "p7", "-tune", "uhq", "-rc", "vbr", "-cq", "18", "-b:v", "0", "-profile:v", "main10",
      "-g", String(Math.round(fps / 2)), "-tag:v", "hvc1", ...TAGS_709, "-movflags", "+faststart"],
  },
  archive: {
    ext: "mp4", description: "x264 slow CRF 14 (CPU)",
    vf: `${TO_709},format=yuv420p`,
    args: () => ["-c:v", "libx264", "-preset", "slow", "-crf", "14", ...TAGS_709, "-movflags", "+faststart"],
  },
  prores: {
    ext: "mov", alpha: true, description: "ProRes 4444 with alpha, for editors",
    vf: "format=yuva444p10le",
    args: () => ["-c:v", "prores_ks", "-profile:v", "4444", "-alpha_bits", "16", "-vendor", "apl0", "-pix_fmt", "yuva444p10le"],
  },
  "webm-alpha": {
    ext: "webm", alpha: true, description: "VP9 with alpha, for browsers",
    vf: "format=yuva420p",
    args: () => ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "20", "-row-mt", "1", "-auto-alt-ref", "0"],
  },
  "web-av1": {
    ext: "mp4", description: "AV1 NVENC for self-hosted embeds",
    vf: `${TO_709},format=yuv420p`,
    args: fps => ["-c:v", "av1_nvenc", "-preset", "p7", "-rc", "vbr", "-cq", "28", "-b:v", "0", "-g", String(fps * 2), ...TAGS_709, "-movflags", "+faststart"],
  },
  lossless: {
    ext: "mkv", description: "FFV1 intra-only lossless RGB (intermediate)",
    args: () => ["-c:v", "ffv1", "-level", "3", "-g", "1", "-slices", "16", "-slicecrc", "1", "-pix_fmt", "bgr0"],
  },
};

export function ffmpegAvailable(): { ok: boolean; version?: string; encoders: string[] } {
  const v = spawnSync("ffmpeg", ["-hide_banner", "-version"], { encoding: "utf8" });
  if (v.status !== 0) return { ok: false, encoders: [] };
  const e = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" });
  const encoders = [...(e.stdout ?? "").matchAll(/^\s*V\S*\s+(\S+)/gm)].map(m => m[1]);
  return { ok: true, version: v.stdout.split("\n")[0], encoders };
}

export interface Encoder {
  write(png: Buffer): Promise<void>;
  end(): Promise<void>;
  /** Wall time ffmpeg spent blocking writes (backpressure), seconds. */
  stats(): { framesIn: number; waitMs: number };
}

/** Start ffmpeg reading PNG frames on stdin. The output is complete when end() resolves. */
export function startEncoder(o: { out: string; fps: number; preset: Preset; width: number; height: number; srcWidth?: number; srcHeight?: number }): Encoder {
  const p = PRESETS[o.preset];
  const filters = [];
  if (o.srcWidth && (o.srcWidth !== o.width || o.srcHeight !== o.height)) filters.push(`scale=${o.width}:${o.height}:flags=lanczos`);
  if (p.vf) filters.push(p.vf);
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-c:v", "png", "-framerate", String(o.fps), "-i", "-",
    ...(filters.length ? ["-vf", filters.join(",")] : []), "-r", String(o.fps), ...p.args(o.fps), o.out];
  const ff = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  ff.stderr.on("data", d => { stderr += d; });
  const done = new Promise<void>((res, rej) => ff.on("close", c => c === 0 ? res() : rej(new Error(`ffmpeg (${o.preset}) exited ${c}: ${stderr.trim().split("\n").slice(-3).join(" | ")}`))));
  done.catch(() => {});
  let framesIn = 0, waitMs = 0;
  return {
    async write(png) {
      framesIn++;
      if (!ff.stdin.write(png)) { const a = performance.now(); await new Promise(r => ff.stdin.once("drain", r)); waitMs += performance.now() - a; }
    },
    async end() { ff.stdin.end(); await done; },
    stats: () => ({ framesIn, waitMs }),
  };
}

/**
 * Mux audio onto a rendered video: tracks placed at their start times, music ducked under VO, two-pass
 * loudness normalisation to -14 LUFS / -1 dBTP (YouTube's reference), AAC 48 kHz 384k.
 */
export async function muxAudio(o: { video: string; out: string; tracks: Array<{ path: string; start?: number; gain?: number; role?: string }>; duration: number; lufs?: number }): Promise<{ measured: Record<string, string> }> {
  if (!o.tracks.length) throw new Error("muxAudio: no tracks");
  const lufs = o.lufs ?? -14;
  const inputs = o.tracks.flatMap(t => ["-i", t.path]);
  const parts: string[] = [];
  o.tracks.forEach((t, i) => {
    const ms = Math.round((t.start ?? 0) * 1000);
    parts.push(`[${i + 1}:a]aresample=48000,adelay=${ms}|${ms},volume=${t.gain ?? 1},apad,atrim=0:${o.duration}[a${i}]`);
  });
  const vo = o.tracks.map((t, i) => t.role === "vo" ? i : -1).filter(i => i >= 0);
  const music = o.tracks.map((t, i) => t.role !== "vo" ? i : -1).filter(i => i >= 0);
  let mixed: string;
  if (vo.length && music.length) {
    parts.push(`${vo.map(i => `[a${i}]`).join("")}amix=inputs=${vo.length}:normalize=0,asplit=2[vo][key]`);
    parts.push(`${music.map(i => `[a${i}]`).join("")}amix=inputs=${music.length}:normalize=0[mus]`);
    parts.push(`[mus][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]`);
    parts.push(`[duck][vo]amix=inputs=2:normalize=0[mix]`);
  } else parts.push(`${o.tracks.map((_, i) => `[a${i}]`).join("")}amix=inputs=${o.tracks.length}:normalize=0[mix]`);
  mixed = parts.join(";");
  // pass 1: measure
  const m = spawnSync("ffmpeg", ["-hide_banner", "-i", o.video, ...inputs, "-filter_complex", `${mixed};[mix]loudnorm=I=${lufs}:TP=-1:LRA=11:print_format=json[o]`, "-map", "[o]", "-f", "null", "-"], { encoding: "utf8" });
  const json = m.stderr.slice(m.stderr.lastIndexOf("{"), m.stderr.lastIndexOf("}") + 1);
  let meas: Record<string, string>;
  try { meas = JSON.parse(json); } catch { throw new Error(`loudnorm measurement failed: ${m.stderr.slice(-400)}`); }
  const ln = `loudnorm=I=${lufs}:TP=-1:LRA=11:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:offset=${meas.target_offset}:linear=true,aresample=48000`;
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", o.video, ...inputs, "-filter_complex", `${mixed};[mix]${ln}[o]`,
    "-map", "0:v", "-map", "[o]", "-c:v", "copy", "-c:a", "aac", "-b:a", "384k", "-ar", "48000", "-shortest", "-movflags", "+faststart", o.out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`audio mux failed: ${r.stderr.slice(-400)}`);
  return { measured: meas };
}
