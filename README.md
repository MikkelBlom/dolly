# dolly

Code-driven motion graphics for product promos, launch films and feature explainers, rendered as fast as the machine allows. Built for AI coding agents first: every command has `--json` output and returns images (stills, contact sheets) the agent can look at.

Every scene is a pure function of time, `render(t)`. Frames can therefore be rendered in parallel, cached, seeked and checked for determinism.

> **Status:** early. Phase 1 (research and capture benchmarks) is done; the engine is being built. See [`docs/research.md`](docs/research.md) and [`docs/benchmarks.md`](docs/benchmarks.md).

## Ideas in brief
- **One browser process per worker.** Chromium tabs share a compositor and serialise.
- **Motion blur averaged by the browser's compositor.** N copies of the scene at sub-frame times are blended as a tree of 50/50 `plus-lighter` layers and captured once: 19× faster than separate captures at 32 samples.
- **Adaptive sample counts** from scene-graph velocity: 1 sample when calm, up to 32 on whip-pans.
- **NVENC encoding**, a frame cache keyed on scene inputs, and a motion-grammar linter.

## Licence
[Apache-2.0](LICENSE).
