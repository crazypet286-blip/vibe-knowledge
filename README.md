# Vibe Knowledge — Pure-Code Deterministic Video Rendering

Short animated explainer videos about knowledge topics, rendered **100% in code** — no AI video generation, no diffusion models, no cloud GPU, no face-lock.

Demo — finished episode, rendered with this exact pipeline:
**"Braess's Paradox: How can building one more road make traffic worse for everyone?"**
118 seconds, 1920×1080 @ 30fps, Chinese subtitles baked in, zero garble:
https://muse.ai/files/1456842060840801/2243389289549285/uq8zarb0w2nkif62bsljm5x1/_______________________1080p30_Vibe___.mp4

![Full-film frame overview](docs/overview.jpg)

## Why pure code

Diffusion video garbles Chinese text and numbers and flickers frame to frame.
Code rendering is exact: every pixel, number and subtitle is deterministic,
so a data story like "65 min → 80 min, +23%" renders correctly every time.

## Pipeline

- **Three.js WebGL** 3D particles + UnrealBloom, **HTML5 Canvas 2D** for
  geometry and physics (percolation lattice, traffic flow, chat bubbles)
- **Headless Chrome** renders frame-by-frame at 1920×1080 @ 30fps
  (2 min = 3540 frames), piped to **FFmpeg**
- **Audio:** Python per-frame synthesized foley (heartbeat, whooshes,
  arpeggios) locked to subtitle cues, mixed with BGM, master normalized
  to -16 LUFS — sample-accurate, frame N always maps to the same millisecond
- **Distribution:** Douyin / Xiaohongshu / WeChat Channels, vertical 9:16
  cuts from the same 1080p master

## Run it

```bash
npm install
# sheet test: 20 frames of scene S06 at 540p
node render.mjs --scene S06 --res 540 --every 15 --sheet 09_QC/S06_test.png
# full scene at 1080p30
node render.mjs --scene S06
```

Requires Google Chrome (set `CHROME_BIN` if it is not on PATH).

## Layout

- `scenes/S01.js..S06.js` — one file per scene, Canvas 2D + Three.js
- `timeline/timeline.json` — the single source of truth: scene timings,
  subtitles, render settings
- `tools/` — `build_master_audio.py` (foley + BGM mix),
  `compose_master.py` (concat scenes + mux audio + SRT)
- `lib/` — shared render core
- `render.mjs`, `index.html` — headless-Chrome frame renderer

A new episode means editing only `timeline/timeline.json` and
`scenes/S01.js..S06.js`. Everything else stays untouched.

## Episodes

- EP009 《临界点：你以为努力是线性的，其实它是渗流》 (this repo's scenes)
- 《布雷斯悖论：多修一条路，怎么反而所有人都更堵了？》 — 4000 cars,
  65 min → 80 min, +23% (demo link above)
- 《幽灵堵车》 (Sugiyama et al. 2008, 22 cars / 230 m ring) — rendering
- 《那天晚上，没人想去唱歌。为什么最后全去了？》 (Abilene paradox) — rendering

## License

MIT
