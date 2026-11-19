// 页面入口：按 URL 参数加载场景模块，逐帧渲染并送回本地渲染驱动
import { createStage, SERIF, SANS } from './core.js';
import { sceneTimeline } from './timeline.js';

const p = new URLSearchParams(location.search);
const W = +p.get('w') || 1920, H = +p.get('h') || 1080, FPS = +p.get('fps') || 30, SCENE = p.get('scene');
const post = (path, body) => fetch(path, { method: 'POST', body });

async function main() {
  if (!SCENE) throw new Error('缺少 scene 参数');
  await Promise.all([
    `600 42px ${SERIF}`,
    `400 32px ${SERIF}`,
    `500 24px ${SANS}`,
  ].map(f => document.fonts.load(f)));
  const tlRaw = await (await fetch(p.get('timeline') || 'timeline/timeline.json')).json();
  const tl = sceneTimeline(tlRaw, SCENE);
  const stage = createStage({ W, H, debug: p.has('debug') });
  const mod = await import(`../scenes/${SCENE}.js`);
  const sc = await mod.default(stage, tl, { verify: p.has('verify'), raw: tlRaw });
  const total = Math.round(tl.duration * FPS);
  const frames = p.get('frames') ? p.get('frames').split(',').map(Number) : [...Array(total).keys()];
  const gl = stage.renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  await post('/info', JSON.stringify({
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
    frames: frames.length,
    total,
    duration: tl.duration,
    absStart: tl.absStart,
    shots: tl.shots.map(s => [s.id, s.absStart, s.dur]),
    checks: sc.checks || null,
  }));
  for (const f of frames) {
    const t = f / FPS;
    sc.render(t);
    const absT = tl.absStart + t;
    stage.ui.drawMicroHeader(tlRaw, absT);
    stage.ui.drawVibeSubtitle(tlRaw, absT);
    const cur = tl.current(t);
    stage.ui.debugLabel(`${SCENE} f${f} t=${t.toFixed(2)}s 镜头${cur.id} ${((t - cur.start) / cur.dur * 100).toFixed(0)}%`);
    const { data, stats } = stage.readFrame();
    await post(`/frame?i=${f}&mean=${stats.mean}&white=${stats.white}&max=${stats.max}`, data);
  }
  await post('/done', JSON.stringify({ captions: null }));
}
main().catch(e => post('/error', String(e && e.stack || e)));
