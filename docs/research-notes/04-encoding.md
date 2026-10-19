# 04 — Encoding, colour, alpha, concat and audio

Research date: 2026-10-19. Target machine: Windows 11, RTX 5090 Laptop GPU (Blackwell, 9th-gen NVENC), driver 610, ffmpeg 8.1 (gyan "full" build).
Content: flat UI colours, crisp text, gradients, fast camera pans, real motion blur. Destinations: YouTube (also used for Chrome Web Store promo videos), website embeds, and alpha overlays for editors.

How sure each claim is: **[doc]** means official vendor or ffmpeg documentation. **[measured]** means a third-party measurement with a stated method. **[anecdotal]** means forum or blog claims. **[inference]** means my own reasoning, to be checked locally.

---

## TL;DR for the design doc

1. **Don't stream-copy concat GOP-coded slices.** Render each slice to an **intra-only lossless RGB intermediate**: FFV1 in MKV, or Ut Video. Join those with the concat demuxer, `-c copy`, which is trivially safe for intra-only streams. Then do **one** final encode per deliverable. This sidesteps every B-frame, IDR or timestamp pitfall in section 7, and keeps the RGB→YUV conversion to a single, explicit step.
2. **Do the colour conversion explicitly in swscale. Never leave it to defaults.** ffmpeg treats untagged RGB stills as BT.601 when converting, which gives a visible hue and saturation shift. Use `scale=...:out_color_matrix=bt709:out_range=tv` plus explicit `-colorspace/-color_primaries/-color_trc` tags (section 3).
3. **YouTube master: upload big.** H.264 or HEVC from NVENC at a very high quality target (CQ ≈ 16–18, no bitrate cap) or libx264 CRF ≈ 14–16. YouTube re-encodes everything, so source quality is what you control. Because the renderer is HTML, **render natively at 2160p** (deviceScaleFactor 2) for the YouTube master when render time allows. That is real detail, not an upscale, and it lands in YouTube's 4K bitrate tier and codec path (section 2).
4. **NVENC quality settings on Blackwell:** `-preset p7 -tune hq` for H.264. For HEVC and AV1, `-tune uhq` measured about 12–13% (HEVC) and about 16–19% (AV1) better BD-rate than HQ on Blackwell, at roughly half the throughput. Add `-rc vbr -cq N -b:v 0`, `-multipass fullres`, `-rc-lookahead 32`, `-b_ref_mode middle`, `-spatial-aq 1 -temporal-aq 1`, and `-split_encode_mode disabled` (section 1).
5. **Alpha overlays:** ProRes 4444 via `prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 -vendor apl0` in `.mov` for editors. VP9 `yuva420p` in WebM, with `-auto-alt-ref 0`, for Chrome or Firefox web playback. HEVC-with-alpha is Safari/Apple-only. ffmpeg 8.0 added libx265 alpha encoding, so it can be produced on Windows, but nothing on Windows or Chrome plays it (section 5).
6. **Audio:** two-pass `loudnorm` to I = −14 LUFS, TP = −1 dBTP, `linear=true`, then `aresample=48000`. Encode AAC-LC 48 kHz stereo at 384 kbps. Duck music with `sidechaincompress` keyed from the VO, then `amix` with `normalize=0` (section 8).

---

## 1. NVENC on Blackwell: options, quality and speed

### 1.1 What the hardware supports (RTX 5090 Laptop)

- NVIDIA's support matrix lists **RTX 5090 Laptop: 9th-gen NVENC, 3 NVENC engines, 2 NVDEC, 12 concurrent sessions**. It also lists H.264 and HEVC 4:2:2 and 4:4:4, H.264 and HEVC lossless, 10-bit, B-frames, and AV1 4:2:0 encode all as YES. [doc] https://developer.nvidia.com/video-encode-decode-support-matrix
  - Caveat: the RTX 5080 Laptop, on the same GB203 die family, is listed with 2 engines. The page itself says "codec support may vary by product manufacturer". The count matters only for parallel sessions and split-frame encoding. Verify locally: `ffmpeg -f lavfi -i nullsrc -c:v hevc_nvenc -gpu list -f null -`, plus NVIDIA's `nvidia-smi -q`.
- Video Codec SDK 13.0 adds **H.264 10-bit (High10), H.264 4:2:2, H.264 interlaced, HEVC 4:2:2 on Blackwell**. It requires driver ≥ 570. [doc] https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/read-me/index.html
- 10-bit support by codec: HEVC Main10 since Pascal, AV1 8/10-bit since Ada, and H.264 High10 only on Blackwell. [doc] https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/nvenc-video-encoder-api-prog-guide/index.html
- AV1 on NVENC is **4:2:0 only** (8/10-bit, up to 8192×8192). For 4:4:4 on NVENC use H.264 (`-profile:v high444p`) or HEVC (`-profile:v rext`). [doc] https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/nvenc-application-note/index.html

### 1.2 ffmpeg option reference (hevc_nvenc / av1_nvenc / h264_nvenc in ffmpeg 8.x)

Source for the option tables: ffmpeg's `nvenc_hevc.c` and `nvenc_av1.c`. [doc] https://ffmpeg.org/doxygen/trunk/nvenc__hevc_8c_source.html · https://ffmpeg.org/doxygen/trunk/nvenc__av1_8c_source.html

| Option | Values | Notes for this project |
|---|---|---|
| `-preset` | `p1`…`p7` (also legacy `slow/medium/fast`) | p7 is the slowest and best. Default is p4. |
| `-tune` | `hq` (default), `uhq`, `ll`, `ull`, `lossless` | `uhq` exists for HEVC (`NVENC_HAVE_UHQ_TUNING`) and AV1 (`NVENC_HAVE_AV1_UHQ_TUNING`), not H.264. SDK 12.2 introduced UHQ for HEVC: "combines lookahead level and temporal filtering". https://docs.nvidia.com/video-technologies/video-codec-sdk/12.2/read-me/index.html · https://developer.nvidia.com/blog/improving-video-quality-with-nvidia-video-codec-sdk-12-2-for-hevc/ |
| `-rc` | `constqp`, `vbr`, `cbr` | Use `vbr` with `-cq`. |
| `-cq` | 0–51 (float) | Constant-quality target for VBR. **Set `-b:v 0`**: the nvenc wrapper's default `b=2M` otherwise acts as a bitrate target or cap [inference from the defaults table, which shows `b=2M`]. Add `-maxrate` only if you need a cap. |
| `-qp` | with `-rc constqp` | Fixed QP. No rate adaptation, so AQ and lookahead buy little. Prefer `vbr`+`cq` for finals. |
| `-multipass` | `disabled`, `qres`, `fullres` | Two-pass inside one encode. NVIDIA: full-res first pass gives better statistics, at a speed cost. [doc] SDK guide §3.8.4 |
| `-rc-lookahead` | frames | SDK caps lookahead depth at 32. The wrapper accepts larger values. |
| `-lookahead_level` | `auto`, 0–3 | Higher means better quality, slower, and more VRAM. [doc] SDK 12.2 read-me |
| `-tf_level` | 0, 4 | Temporal filter. HEVC needs ≥ 4 B-frames. NVIDIA reports 4–5% gain on *natural* video. It mostly denoises, so expect little benefit for clean synthetic graphics [inference]. https://ffmpeg.org/pipermail/ffmpeg-cvslog/2024-March/141807.html · https://developer.nvidia.com/blog/nvidia-video-codec-sdk-13-1-zero-copy-transcode-av1-b-frames-and-frame-accurate-seek/ |
| `-bf` | B-frame count | YouTube's spec asks for 2 B-frames (for its ingest compatibility, not visible quality). UHQ forces its own B-frame structure (see 1.3). |
| `-b_ref_mode` | `disabled`, `each`, `middle` (+`hierarchical` on AV1) | NVIDIA: middle mode "improves quality with no performance cost" and is strongly recommended with multiple B-frames. [doc] SDK guide §8.3 |
| `-spatial-aq 1`, `-aq-strength 1–15` (default 8) | | Improves perceived quality in flat regions but usually lowers PSNR. [doc] §8.5. For flat UI this is useful. Watch that it doesn't rob bits from text edges; try strength 4–8. |
| `-temporal-aq 1` | | Improves static, detailed regions, such as text held on screen. Uses CUDA. Causes per-frame bitrate fluctuation, which is fine for VOD. [doc] §8.5 |
| `-split_encode_mode` | `disabled`, `auto`, `forced`, 2, 3, 4 | Splits each frame into horizontal strips across NVENCs. Faster but **degrades quality**. Implicit (auto) mode needs ≥ 2 NVENCs, height ≥ 2112 (HEVC) or ≥ 2048 (AV1), and HQ tuning with P1–P2 only. [doc] SDK guide §8.14. Irrelevant at 1080p. At 4K with p7 it won't auto-engage, but set `disabled` explicitly for finals. |
| `-forced-idr 1` | | Makes `-force_key_frames` keyframes into IDRs. Needed if slices are ever stream-copied. |
| `-highbitdepth 1` | | 10-bit encode from 8-bit input (HEVC/AV1). Alternatively feed `p010le` and set `-profile:v main10`. |
| `-strict_gop`, `-no-scenecut 1` | | `-no-scenecut 1` keeps GOP placement deterministic. |
| `-rgb_mode` | `yuv420`, `yuv444`, `disabled` | NVENC can ingest RGB and convert internally. **Don't rely on it**: the conversion matrix isn't documented in the wrapper. Convert in swscale (section 3) [inference]. |

**Known issue:** an NVIDIA forum report (late 2025, driver 580) says `hevc_nvenc -tune uhq` segfaults at end-of-file and loses the last 10–15 s. ffmpeg devs traced it into the NVIDIA library. https://forums.developer.nvidia.com/t/hevc-nvenc-with-uhq-tuning-profile-in-ffmpeg-segfaults-at-end-of-file/347402 → **Test UHQ on driver 610 with a frame-count check (ffprobe `nb_frames`) before trusting it in the pipeline.**

### 1.3 Quality measurements (2024–2026)

- **Blackwell vs Ada, HEVC (RTX 5090 FE vs RTX 4080 Super), Feb 2025** [measured]: `hevc_nvenc -preset p7 -tune uhq -multipass fullres -rc vbr -rc-lookahead 250 -b_ref_mode middle -temporal-aq 1`, main10/p010le, on a 4K HDR clip. **BD-rate −5.59%** for the 5090. VMAF: 2.4 Mbps 68.2 → 69.9; 8.6 Mbps 90.7 → 91.0; 20 Mbps 96.6 → 96.8. https://codecalamity.com/nvidia-rtx-5090-video-encoding-first-look/
- **Arunruangsirilert & Katto, "Evolution of NVENC Efficiency…", arXiv 2605.01187 (May 2026)**, covering Pascal, Ampere, Ada and RTX 5070 Ti Blackwell [measured]:
  - Blackwell HQ vs Ada HQ: −5.94% BD-rate (HEVC P7).
  - Blackwell **UHQ vs HQ: ≈ −12–13% (HEVC), ≈ −16–19% (AV1)**.
  - UHQ cuts throughput 50–60%: at 4K60, HEVC P7 runs HQ 45 fps vs UHQ 37 fps, and AV1 P7 runs HQ 104 fps vs UHQ 46 fps.
  - UHQ forces 5 B-frames for HEVC and up to 7 for AV1, plus up to 4 references. It can't be overridden. It raises board power by up to 40%.
  - Verdict: good for VOD, bad for real-time.
  - https://arxiv.org/abs/2605.01187 (details via https://www.emergentmind.com/papers/2605.01187)
- **NVENC vs x264/x265 at equal bitrate.** I found **no rigorous 2024–2026 Blackwell-vs-software VMAF study** with a published method.
  - Rigaya publishes ongoing SSIM/VMAF/butteraugli-vs-bitrate charts, including x264, x265, svt-av1, vvenc and NVEnc (updated up to 2026-07). The only RTX 50 card is an RTX 5050, and the data is only in charts. https://rigaya.github.io/vq_results/
  - The best older controlled data is Chips and Cheese (2022, Turing). For slow-preset transcoding, **x264 veryslow beats NVENC, especially above 10 Mbps**, with Turing a strong second. https://chipsandcheese.com/i/138977355/transcoding
  - Unverified blog estimates say NVENC HEVC needs about 15–25% more bits than x265 slow. https://blog.blazingcdn.com/en-us/hardware-vs-software-video-encoding-nvenc-qsv-and-x264 [anecdotal]
  - **Practical reading:** at the high bitrates we use for uploads and masters (≥ 30 Mbps 1080p60), every encoder is near-transparent, and the gap between NVENC p7/UHQ and x264 slow or x265 slow is small relative to what YouTube's re-encode costs. The software encoders still win at *low* bitrates, which matter for small web embeds. [inference]
- **Recommendation:** add a local `libvmaf` comparison on two of our own promo clips to the test plan. Example: `ffmpeg -i enc.mp4 -i ref.mkv -lavfi "[0:v]setpts=PTS-STARTPTS[d];[1:v]setpts=PTS-STARTPTS[r];[d][r]libvmaf=n_threads=16" -f null -` (gyan full builds include libvmaf). Synthetic flat graphics behave very differently from the natural clips used in all published tests.

### 1.4 Speed (1080p, 8-bit 4:2:0, frames/s per NVENC engine, NVIDIA's own table) [doc]

From the NVENC Application Note (SDK 13) https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/nvenc-application-note/index.html:

| Codec | P1 HQ | P3 HQ | P5 HQ | P7 HQ |
|---|---|---|---|---|
| H.264 | 948 | 708 | 317 | 227 |
| HEVC | 1119 | 947 | 521 | 181 |
| AV1 | 957 | 678 | 552 | 401 |

- So even HEVC p7 HQ runs at about 3× real-time for 1080p60 on one engine.
- UHQ roughly halves that (section 1.3). Multipass fullres costs more.
- **Encoding will never be the bottleneck. Frame rendering and capture in Chrome will be.** [inference]
- For comparison, libx264 `-preset slow` at 1080p on a high-end laptop CPU is typically tens of fps. That is fine for a 30–60 s promo but not "free". I have no sourced number; measure locally.

---

## 2. YouTube upload

### 2.1 Official recommended upload settings [doc]

https://support.google.com/youtube/answer/1722171

- **Container:** MP4, "no edit lists", "moov atom at the front of the file (Fast Start)".
- **Audio:**
  - Codec: AAC-LC (also Opus and Eclipsa Audio).
  - Channels: stereo or stereo + 5.1.
  - Sample rate: **48 kHz**.
  - Bitrate: **384 kbps stereo**, 128 kbps mono, 512 kbps 5.1.
- **Video:**
  - H.264, High Profile, progressive.
  - **2 consecutive B-frames**, CABAC.
  - **Closed GOP, GOP = half the frame rate** (that is, `-g 30` at 60 fps).
  - VBR, "no bitrate limit is required".
  - **4:2:0**.
  - Keep the native frame rate.
- **SDR bitrates (Mbps):**

  | Resolution | 24/25/30 fps | 48/50/60 fps |
  |---|---|---|
  | 1080p | 8 | **12** |
  | 1440p | 16 | 24 |
  | 2160p | 35–45 | 53–68 |

- **Colour:** BT.709 for primaries, transfer and matrix. Convert full range to limited range. Avoid the RGB matrix.
- Oddity: the current page also contains the sentence "These features are only available to partners who use YouTube Studio Content Manager". In context it appears to apply to a sub-feature, since the spec is widely treated as general guidance. Not material.

### 2.2 Accepted formats

The YouTube supported-formats page lists MOV, MPEG-1/2/4, MP4, AVI, WMV, FLV, 3GPP, WebM, **DNxHR, ProRes, CineForm, HEVC (H.265)**. [doc] https://support.google.com/youtube/troubleshooter/2888402

- **AV1 is not listed.** It is reported to work in practice [anecdotal], but there is no upside: YouTube re-encodes regardless. **Upload H.264 or HEVC in MP4.**
- ProRes uploads are allowed but huge, which is pointless when a CQ 16 H.264 file is visually transparent.

### 2.3 "Upload high-bitrate", and the 1440p/4K trick in 2026

- YouTube says no bitrate limit is required. The listed rates are recommendations, effectively floors for good results. A cleaner source gives YouTube's transcoder less noise and fewer blocking artefacts to reproduce. [doc + inference]
- The 1440p/4K trick (upload above 1080p to get VP9/AV1 and higher bitrates, including the 1080p rendition) is still widely cited. It is **not documented by YouTube, and the evidence is anecdotal and inconsistent**:
  - A 1440p25 upload was reported still getting H.264.
  - VP9/AV1 allocation also depends on popularity.
  - https://filmdaft.com/how-to-get-better-image-quality-on-your-youtube-videos/ · https://forum.videohelp.com/showthread.php?p=2703554 [anecdotal]
- YouTube itself only notes "To view new 4K uploads in 4K, use a browser or device that supports VP9". [doc]
- **For this project the trick is different in kind.** We are not upscaling; we can **render natively at 3840×2160** (Chrome `deviceScaleFactor: 2` on a 1920×1080 layout). That gives genuinely sharper text and edges, avoids 4:2:0 chroma smear on coloured text at the 1080p rendition, and puts the video in the 2160p bitrate and codec tier. The cost is about 4× render pixels. Recommendation:
  - **Final YouTube master = 2160p60 when render time permits, otherwise 1080p60.**
  - Verify the codec and bitrate actually delivered via "Stats for nerds".

### 2.4 Chrome Web Store / websites

- Chrome Web Store promo videos are YouTube links, so the YouTube master covers them.
- For self-hosted embeds, ship **H.264 8-bit 4:2:0 MP4 with faststart** as the baseline. Optionally add **AV1 (av1_nvenc) or VP9 WebM** as a smaller first `<source>` for modern browsers.

---

## 3. Colour: sRGB screenshots → BT.709 YUV

### 3.1 The pitfall

- When ffmpeg converts an untagged RGB still (PNG frames from Chrome) to YUV, it assumes **BT.601** coefficients unless told otherwise. The ASWF guidelines say ffmpeg assumes an unknown still image format is rec601, so unless you specify otherwise, the conversion causes a color shift. [doc] https://academysoftwarefoundation.github.io/EncodingGuidelines/ColorPreservation.html
- Players then decode the result as BT.709, because HD content is tagged or assumed 709. The result is slightly wrong hues: reds and oranges shift, greens desaturate. Brand colours visibly drift.
- swscale rounding without `accurate_rnd` can also turn white 255,255,255 into 252,254,252. https://trac.ffmpeg.org/ticket/8056
- Using `-pix_fmt` alone after `scale=out_color_matrix=...` has historically been fragile. Put an explicit `format=` *inside* the filter chain. https://trac.ffmpeg.org/ticket/979

### 3.2 Correct conversion (8-bit deliverable)

```
-vf "scale=in_range=pc:in_color_matrix=bt709:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int+bitexact,format=yuv420p"
-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv
```

- 10-bit: `format=yuv420p10le` for x265 or SVT-AV1, or `format=p010le` for NVENC.
- 4:4:4: `format=yuv444p` or `yuv444p10le`.
- `in_color_matrix` is meaningless for RGB input, but ASWF includes it and it is harmless.
- zscale alternative from ASWF (it found swscale very slightly better for pure RGB→YUV): `zscale=m=709:min=709:rangein=full:range=limited`.

### 3.3 Transfer tag: `bt709` vs `iec61966-2-1` (sRGB)

- Chrome screenshots are sRGB. sRGB and BT.709 share **identical primaries**, so `-color_primaries bt709` is correct. The **matrix** must be bt709. Only the **transfer tag** is debatable.
- ASWF's web tests: Chrome on Windows treats a `bt709` TRC as sRGB, meaning it is displayed as authored. Safari treats it as camera BT.709 (≈ gamma 1.95), so it looks slightly different. `iec61966-2-1` was "the most reliable" across browsers. [doc] https://academysoftwarefoundation.github.io/EncodingGuidelines/WebColorPreservation.html
- **Decision:**
  - YouTube master: tag `bt709` (YouTube's stated requirement; it re-encodes anyway).
  - Self-hosted web embeds: tag `-color_trc iec61966-2-1` for best cross-browser fidelity.
  - Matrix and primaries are bt709 in both cases.

### 3.4 Banding on gradients

- Chrome renders to 8-bit RGB PNG, so a gradient already has at most 256 steps per channel. An 8-bit **limited-range** YUV conversion re-quantises luma to 219 levels and chroma to 224, and an encoder at moderate bitrate flattens them further. That produces visible banding on large, slow dark gradients. [inference + ASWF note on limited-range quantisation artefacts]
- **10-bit encoding of 8-bit sources helps**: there is no requantisation loss in the conversion, and the codec's internal precision is higher. https://www.forasoft.com/learn/video-encoding/glossary/terms/10bit [anecdotal/vendor]
- **YouTube:** I found **no evidence that YouTube keeps SDR uploads at 10-bit**. A 2019 report says SDR AV1 was 8-bit; 10-bit is officially discussed only for HDR. https://support.google.com/youtube/answer/7126552 · https://forum.doom9.org/showthread.php?p=1892523
  - Still, a 10-bit upload gives YouTube's transcoder a cleaner source to dither from. Whether that visibly helps is **unverified**; test with a gradient clip.
- **The most robust fix is in the source:** add subtle dither or grain to large gradients in the HTML/CSS layer (Skia typically dithers gradients, but verify), or apply a light ffmpeg `noise=alls=2:allf=t+u` before an 8-bit encode.
  - Grain costs bitrate, and YouTube may smooth it away at low renditions.
  - Treat this as an A/B test item, not a settled answer.

---

## 4. Archival and lossless intermediates

### 4.1 What to keep

1. **Lossless RGB intermediate of the full render** (or the per-slice files plus concat list). This is the true master: you can re-encode any future deliverable from it with no generation loss and no colour decisions baked in.
2. **A high-quality mezzanine** for convenience, for example `libx264 -preset slow -crf 14 -pix_fmt yuv420p` (BT.709 tags), or 10-bit 4:4:4 x265/x264 if storage allows.

### 4.2 Choice of lossless intermediate for per-slice files

Requirements: intra-only (each frame independent, so concat is trivially safe), RGB(A) capable, fast, multithreaded, and readable by the ffmpeg 8.1 build.

| Format | Command fragment | Pros | Cons |
|---|---|---|---|
| **FFV1 v3 in MKV** | `-c:v ffv1 -level 3 -g 1 -slices 16 -slicecrc 1 -context 1 -pix_fmt bgr0` (alpha: `bgra`) | Archival standard (IETF RFC 9043). Intra with `-g 1`. CRC per slice. Supports RGB and RGBA. Good compression on flat graphics. | Slower than Ut Video, though slice threading helps. Editors (Premiere/Resolve) support is spotty. |
| **Ut Video in MKV/AVI** | `-c:v utvideo -pred median -pix_fmt gbrp` (alpha: `gbrap`) | Very fast, always intra, RGB/RGBA. | Larger files: about 1.3 GiB vs FFV1's 0.83 GiB on a 1-minute 1080p24 film clip [anecdotal] https://forum.doom9.org/archive/index.php/t-164188.html |
| **libx264rgb `-qp 0 -preset ultrafast`** (or libx264 yuv444p `-qp 0`) | `-c:v libx264rgb -qp 0 -preset ultrafast -g 1 -pix_fmt bgr0` | Fast, small, widely decodable. | Intra `-g 1` lossless x264 compresses poorly per an x264 dev; with GOPs you're back to concat hazards. No alpha. |
| **Raw NUT/rawvideo** | `-c:v rawvideo -f nut` | Zero CPU. | 1920×1080×3 bytes ×60 fps ≈ **373 MB/s** RGB, ≈ 187 MB/s yuv420p. A 60 s promo is about 22 GB. Only for pipes or temporary RAM-disk use. |

- **Recommendation:**
  - **FFV1 (`-level 3 -g 1 -slices 16 -slicecrc 1`, `bgr0`/`bgra`, `.mkv`) for per-slice files and the archive.**
  - **Ut Video** if profiling shows FFV1 encode is the bottleneck, which is unlikely next to Chrome capture.
- Flat UI graphics compress dramatically better losslessly than film does. Expect per-minute sizes well below the film anecdotes, but **measure on our content**. I found no 1080p60 motion-graphics benchmark.
- Even better: avoid slice files entirely by piping raw frames from the renderer straight into one ffmpeg (`-f rawvideo -pix_fmt bgra -s 1920x1080 -r 60 -i -`), and tee to FFV1 plus final encodes in a single process.

---

## 5. Alpha overlays

### 5.1 ProRes 4444 with alpha (editors: Premiere, Resolve, Final Cut, AE)

ASWF ProRes guide [doc] https://academysoftwarefoundation.github.io/EncodingGuidelines/EncodeProres.html:

- prores_ks profiles: 0 proxy, 1 lt, 2 standard, 3 hq, **4 = 4444**, 5 = 4444xq.
- 4444 is about 300 Mbps at HD 29.97, so roughly 600 Mbps at 1080p60 [inference: scales with frame rate].
- Pixel format `yuva444p10le`. `-alpha_bits 16` is the default (16-bit lossless alpha). `-vendor apl0` makes the file identify as Apple-encoded, which some tools check.
- Tagging example uses bt709 matrix and primaries. ASWF notes that reading prores_ks back to stills needs explicit `scale=in_color_matrix=bt709`.

```
ffmpeg -framerate 60 -i frame_%05d.png \
  -vf "scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuva444p10le" \
  -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 -vendor apl0 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -an overlay.mov
```

ffmpeg 8.1 also added a ProRes Vulkan encoder (https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/Changelog). It is untested here; stick with prores_ks.

### 5.2 VP9 with alpha in WebM (web playback in Chrome, Edge, Firefox)

- Chrome has supported alpha in WebM VP8/VP9 since Chrome 31. https://developer.chrome.com/blog/alpha-transparency-in-chrome-video/
- **MP4 can't carry VP9 alpha in ffmpeg**: the muxer drops it. https://trac.ffmpeg.org/ticket/11045
- `-auto-alt-ref 0` is required for alpha. https://www.hontran.dev/blog/transparent-video-web-hevc-alpha-ffmpeg

```
ffmpeg -framerate 60 -i frame_%05d.png -c:v libvpx-vp9 -pix_fmt yuva420p \
  -crf 24 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -auto-alt-ref 0 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -an overlay.webm
```

### 5.3 HEVC with alpha

- Plays only in Safari and Apple platforms (`-tag:v hvc1`). The usual encoder is macOS `hevc_videotoolbox -alpha_quality 0.9`. https://www.hontran.dev/blog/transparent-video-web-hevc-alpha-ffmpeg
- **ffmpeg 8.0 added "libx265 alpha layer encoding"**, so it is producible on Windows (`-c:v libx265 -pix_fmt yuva420p -tag:v hvc1`). https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/Changelog
- Not playable in Chrome on Windows. Compatibility with Safari's decoder is **unverified**.
- NVENC alpha is excluded from 4:2:2/4:4:4 and split-frame encoding per the SDK, and I found no ffmpeg nvenc alpha option.
- Low priority; only if Safari web overlays are needed. Use the `<source>` ordering trick: hvc1 MP4 first with an explicit `codecs="hvc1"`, then WebM.

### 5.4 Capturing alpha from headless Chrome

- CDP: `Emulation.setDefaultBackgroundColorOverride({ color: { r:0, g:0, b:0, a:0 } })`, then `Page.captureScreenshot({ format: 'png' })`. Pages must not paint an opaque `html`/`body` background.
- Puppeteer's `omitBackground: true` does the same thing. JPEG has no alpha, so PNG only.
- https://chromedevtools.github.io/devtools-protocol/tot/Emulation/ · https://discourse.threejs.org/t/puppeteer-with-threejs-how-can-i-make-the-background-transparent/67414
- The page's own CSS background must be transparent; the override only removes the default white.
- **Motion-blur gotcha [inference, important]:** PNG screenshots are *straight* (unpremultiplied) alpha.
  - If motion blur is built by averaging sub-frame captures, the average must be computed in **premultiplied** space: multiply RGB by A, average, then unpremultiply. Otherwise blurred edges get dark or bright fringes.
  - Check which convention each target editor assumes for ProRes 4444 alpha. Usually it is straight, but it is interpretable per clip.

---

## 6. AV1: av1_nvenc vs libsvtav1

- **Hardware:** Blackwell AV1 UHQ gains about 16–19% BD-rate over HQ, but AV1 P7 UHQ throughput drops to 46 fps at 4K60 (arXiv 2605.01187 above). At 1080p, AV1 P7 HQ runs at about 401 fps per engine (NVIDIA table).
- **SVT-AV1:** Streaming Learning Center finds **preset 6 is the usual starting point, with 2–4 for premium VOD**. The VMAF gap between fast and slow presets is small, while the time gap is very large. https://streaminglearningcenter.com/encoding/svt-av1-vs-libaom.html
- A blog claims Blackwell AV1 UHQ is "within a few percent of SVT-AV1 slow at about 3× throughput". [anecdotal, unverified] https://www.forasoft.com/learn/video-encoding/glossary/terms/nvenc
- **For uploads: not worth it.** YouTube doesn't list AV1 as an upload format, re-encodes regardless, and a high-bitrate H.264 or HEVC master is equally transparent.
- **For self-hosted web embeds: worth it** as the primary `<source>`, with H.264 fallback. AV1 at low bitrate (2–4 Mbps 1080p60) is where codec efficiency shows. Use `libsvtav1 -preset 4 -crf 30-35` for best size, or `av1_nvenc -preset p7 -tune uhq -cq 32` for speed. A/B them with VMAF on our content.

---

## 7. Concatenating per-slice encodes

- **Concat demuxer rules:** "All files must have the same streams (same codecs, same time base, etc.)". Timestamps are shifted so the first file starts at 0, and this happens globally, which "may cause gaps if all streams do not have exactly the same length". `-safe 0` is needed for absolute Windows paths. [doc] https://ffmpeg.org/ffmpeg-formats.html#concat-1
- **Stream-copy pitfalls with GOP codecs:**
  - Frames get reordered at joins, so the last frame of A plays after the first frame of B, with "mmco: unref short failure" errors. https://trac.ffmpeg.org/ticket/9893
  - DTS/PTS ordering problems arise when B-frames span a join. https://lists.ffmpeg.org/pipermail/ffmpeg-user/2024-February/057689.html
  - Open GOP must be closed at cut points. https://ffmpeg.org/pipermail/ffmpeg-user/2024-June/058081.html
- **If GOP-coded slices must be copied anyway**, each slice needs:
  - the identical encoder, profile, level, resolution, pix_fmt, time base (`-video_track_timescale 15360`, or simply `-r 60` everywhere), colour tags and B-frame settings;
  - an **IDR first frame** (`-forced-idr 1 -force_key_frames "expr:eq(n,0)"`, or NVENC's natural first IDR) and a closed GOP;
  - a frame count that is an exact multiple of the frame duration;
  - no audio in slices (mux audio once at the end, because AAC priming per slice creates gaps or clicks).
- Even then, SPS/PPS differences from per-slice rate control (for example level auto-selection) can bite. Pin `-level`. [inference]
- **Recommendation (repeat of TL;DR #1):** lossless intra-only slices (FFV1 `-g 1`), then `ffmpeg -f concat -safe 0 -i slices.txt -c copy full.mkv` (safe for intra-only), then one final encode per deliverable with full-file rate control and lookahead. That beats N independent rate-control runs anyway.

---

## 8. Audio

### 8.1 Loudness target

- YouTube normalises playback to a **−14 LUFS reference** and only turns loud content **down**, never up. This is not officially documented by Google, but it is consistently measured via "Stats for nerds → content loudness". https://www.meterplugs.com/blog/2019/09/18/youtube-changes-loudness-reference-to-14-lufs.html · https://forum.shotcut.org/t/highest-possible-audio-quality-for-youtube/31825/12
- So master to about −14 LUFS integrated. Keep true peak ≤ −1 dBTP, because lossy re-encoding (AAC/Opus) creates inter-sample overs. [anecdotal/industry practice]
- For web autoplay-muted embeds this doesn't matter much; use the same master.

### 8.2 Two-pass loudnorm

Pass 1 (measure):

```
ffmpeg -i mix.wav -af "loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null -
```

Pass 2 (apply, linear, using JSON `input_i`, `input_tp`, `input_lra`, `input_thresh`, `target_offset`):

```
ffmpeg -i mix.wav -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=<input_i>:measured_TP=<input_tp>:measured_LRA=<input_lra>:measured_thresh=<input_thresh>:offset=<target_offset>:linear=true:print_format=summary,aresample=48000" -c:a pcm_s24le mix_norm.wav
```

- loudnorm falls back to **dynamic mode** if the target LRA is smaller than the source's, or if linear gain would push true peak over TP. Check the pass-2 summary for "Normalization Type: Linear". Raising `LRA` (for example to 20) keeps short promos linear.
- loudnorm upsamples internally to 192 kHz, so always `aresample=48000` after it.
- https://dev.to/javidjamae/ffmpeg-loudnorm-filter-ebu-r128-loudness-normalization-guide-15d4 · https://patchwork.ffmpeg.org/patch/10029/
- Parse the JSON in the tool (`lib/`), not by hand.

### 8.3 Ducking music under VO

```
-filter_complex "[1:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[vo][key];
 [0:a]aformat=sample_rates=48000:channel_layouts=stereo[mus];
 [mus][key]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400:makeup=1[duck];
 [duck][vo]amix=inputs=2:duration=longest:normalize=0[mix]"
```

- Input 0 is the music, input 1 the VO. Apply loudnorm to `[mix]` afterwards.
- Use `amix`, not `amerge`. `amerge` stacks channels, which is the cause of a common failure in mailing-list examples. `normalize=0` stops amix from halving levels. https://lists.ffmpeg.org/archives/list/ffmpeg-user@ffmpeg.org/thread/CJH2SEPGGFUCQ3YS4VXB7CKJS5OZAPCN/ · https://ffmpeg.org/pipermail/ffmpeg-user/2018-August/040933.html
- Threshold, ratio, attack and release are starting points to tune by ear. For promo VO, a deterministic alternative is keyframed `volume` envelopes from the timeline (`volume='if(between(t,2.0,6.5),0.3,1)':eval=frame`, with ramps). It is predictable and reviewable, which suits a code-driven tool.

### 8.4 Mux and alignment

- **Encoder:** `-c:a aac -b:a 384k -ar 48000 -ac 2`. The native ffmpeg AAC encoder is fine at 384k; gyan full builds don't include nonfree libfdk_aac.
- **Frame 0 alignment:**
  - Keep audio as PCM until the final mux.
  - Pad or trim to exact video duration: `apad=whole_dur=<frames/60>` plus `atrim=end=<…>`, or `-shortest`.
  - Position VO and SFX with `adelay=<ms>:all=1`, computed from frame numbers (ms = frame × 1000/60).
- **AAC priming (1024 samples ≈ 21 ms):** the MP4 muxer compensates with an **edit list**, but YouTube's spec says "no edit lists". Options:
  - Accept the default edit list (YouTube ingests it fine in practice [inference]).
  - Use `-use_editlist 0`, which shifts audio about 21 ms late, below the ≈ 45 ms lip-sync perceptibility threshold [inference].
  - Pick one and test a clap-sync clip.
- **Container flags:** `-movflags +faststart` (moov at front). Add `-map_metadata -1` to strip encoder clutter if desired.

---

## 9. Recommended presets

All presets assume input is either the concatenated lossless RGB master (`master.mkv`, FFV1 `bgr0`/`bgra`, 60 fps), or an image sequence or pipe with `-framerate 60`. `VF709` denotes:

```
scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int+bitexact
```

### 9.1 `draft` — fast review renders

```
ffmpeg -i master.mkv -i mix_norm.wav
  -vf "VF709,format=yuv420p"
  -c:v h264_nvenc -preset p4 -tune hq -rc vbr -cq 26 -b:v 0 -bf 2 -g 60
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv
  -c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart -shortest draft.mp4
```

Why: about 1000 fps class, so effectively free, and it plays everywhere. It uses the same colour path as finals so drafts show the true colours. CQ 26 is plenty for judging motion and timing. Add `scale=960:-2` for even faster previews.

### 9.2 `final-youtube` — H.264 NVENC (default, most compatible)

```
ffmpeg -i master.mkv -i mix_norm.wav
  -vf "VF709,format=yuv420p"
  -c:v h264_nvenc -preset p7 -tune hq -profile:v high -rc vbr -cq 16 -b:v 0
  -multipass fullres -rc-lookahead 32 -bf 2 -b_ref_mode middle
  -spatial-aq 1 -aq-strength 6 -temporal-aq 1
  -g 30 -forced-idr 1 -no-scenecut 1
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv
  -c:a aac -b:a 384k -ar 48000 -ac 2 -movflags +faststart -shortest youtube_1080p60.mp4
```

Why:
- It matches YouTube's spec literally: H.264 High, 2 B-frames, CABAC (the default for High), GOP = fps/2, closed GOP (NVENC default), 4:2:0, BT.709, AAC-LC 48 kHz 384k, faststart.
- CQ 16 with no cap gives a near-transparent master, likely 20–60 Mbps for motion-blurred pans and far less for static UI. That is well above YouTube's 12 Mbps reference.
- Temporal AQ protects static text; spatial AQ at moderate strength protects flat fills without starving edges.
- `-tune uhq` is unavailable for H.264.
- For the 2160p master, use the same command with a 3840×2160 render and `-cq 18` (bitrates scale up, which YouTube wants at 53–68 Mbps+).

**Software alternative (when render time dominates anyway and you want the last few %):**

```
-c:v libx264 -preset slow -crf 15 -profile:v high -pix_fmt yuv420p -bf 2 -g 30 -keyint_min 30 -sc_threshold 0 -x264-params open-gop=0 -tune animation
```

`-tune animation` suits flat-colour content [inference: it is designed for flat areas and raises deblock and psy settings; A/B it vs no tune].

### 9.3 `final-youtube-hevc` — HEVC 10-bit NVENC UHQ (better quality per bit, cleaner gradients)

```
ffmpeg -i master.mkv -i mix_norm.wav
  -vf "VF709,format=p010le"
  -c:v hevc_nvenc -preset p7 -tune uhq -profile:v main10 -tier high -rc vbr -cq 18 -b:v 0
  -multipass fullres -rc-lookahead 32 -lookahead_level 3 -b_ref_mode middle
  -spatial-aq 1 -aq-strength 6 -temporal-aq 1 -split_encode_mode disabled
  -g 30 -forced-idr 1 -no-scenecut 1 -tag:v hvc1
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv
  -c:a aac -b:a 384k -ar 48000 -ac 2 -movflags +faststart -shortest youtube_hevc10.mp4
```

Why:
- HEVC is an officially accepted upload format, and UHQ is about 12% more efficient than HQ on Blackwell.
- 10-bit avoids requantisation banding in the source YouTube receives (benefit after YouTube's 8-bit transcode is unverified; A/B test with a gradient clip).
- Caveats:
  - UHQ forces its own B-frame structure, so it deviates from the "2 B-frames" H.264 guidance, which is irrelevant for HEVC ingest.
  - Watch the reported UHQ end-of-file crash; validate the frame count.
  - `-tag:v hvc1` lets Apple players open the file.
  - If UHQ misbehaves, fall back to `-tune hq -bf 4 -tf_level 0`.

### 9.4 `web-embed` — small files for websites

- **H.264 baseline (all browsers):** same as 9.2 but `-cq 23 -maxrate 8M -bufsize 16M -g 120`, `-color_trc iec61966-2-1` (best browser fidelity per ASWF), `-b:a 128k`.
- **AV1 primary (modern browsers):**

  ```
  -vf "VF709,format=yuv420p10le" -c:v libsvtav1 -preset 4 -crf 32 -g 240 -svtav1-params tune=0
  ```

  - Or `-c:v av1_nvenc -preset p7 -tune uhq -rc vbr -cq 32 -b:v 0 -highbitdepth 1`.
  - Container: `.mp4` with `+faststart`, or `.webm`.

Why: this is where codec efficiency actually matters, because there is no re-encode downstream.

### 9.5 `archival`

```
# Lossless master (per slice or whole), RGB, intra-only
ffmpeg -framerate 60 -i frame_%05d.png -c:v ffv1 -level 3 -g 1 -slices 16 -slicecrc 1 -context 1 -pix_fmt bgr0 slice_007.mkv
# (alpha projects: -pix_fmt bgra)

# Join
ffmpeg -f concat -safe 0 -i slices.txt -c copy master.mkv

# Convenience mezzanine
ffmpeg -i master.mkv -i mix_norm.wav -vf "VF709,format=yuv420p" -c:v libx264 -preset slow -crf 14 -tune animation \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a flac master_mezz.mkv
```

Why:
- FFV1 v3 is a standardised archival codec. It is bit-exact RGB, so no colour decisions are baked in. Per-slice CRCs detect corruption. `-g 1` makes concat and seeking trivial.
- Keep the PCM or FLAC audio master alongside.
- The mezzanine is a quick-to-share, visually transparent file.

### 9.6 `alpha-overlay`

- **Editors:** the ProRes 4444 command from 5.1 (`prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 -vendor apl0`, `.mov`, `-an` or `-c:a pcm_s24le`).
- **Web (Chrome, Edge, Firefox):** the VP9 `yuva420p` WebM command from 5.2 (`-auto-alt-ref 0`).
- **Safari:** optional libx265 `yuva420p` `hvc1` MP4 (ffmpeg ≥ 8.0). Playback is unverified.
- Source frames: CDP transparent background + PNG, with **premultiplied-space** averaging for motion-blur sub-frames.

---

## 10. Open questions and local tests to run

1. Confirm the NVENC engine count on this laptop (matrix says 3) and that `-tune uhq` works without the end-of-file crash on driver 610 (compare `nb_frames`).
2. VMAF A/B on two of our own clips at upload bitrates: h264_nvenc p7 CQ16 vs libx264 slow CRF15 (± `-tune animation`) vs hevc_nvenc UHQ CQ18.
3. Upload test to an unlisted YouTube video, comparing 1080p60 vs native 2160p60 render, and 8-bit vs 10-bit HEVC on a dark gradient clip. Check codec and bitrate in Stats for nerds.
4. Measure FFV1 vs Ut Video encode fps and MB per minute on a typical 1080p60 promo. Confirm it isn't a bottleneck relative to Chrome capture.
5. Check which alpha convention (straight vs premultiplied) Premiere and Resolve assume for our ProRes 4444 output.
6. AAC edit-list vs `-use_editlist 0`: run a sync test on YouTube.
