// 「Vibe 知识大赏」黑金粒子与宋刻双语渲染核心（WebGL UnrealBloom + 2D 衬线美学层 + Type A 渗流相变模拟器）
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const smoother = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const lerp = (a, b, k) => a + (b - a) * k;
export const win = (t, a, b, fi = 0.4, fo = 0.4) => smooth((t - a) / fi) * smooth((b - t) / fo);

export function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const SERIF = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","Georgia",serif';
export const EN_SERIF = '"Georgia","Times New Roman","Songti SC",serif';
export const SANS = '"PingFang SC","Hiragino Sans GB","Heiti SC",sans-serif';
export const MONO = '"JetBrains Mono","SF Mono","Menlo",monospace';

export const PAL = {
  bgCenter: '#16120d',
  bgMid: '#0b0907',
  bgEdge: '#050506',
  goldBright: '#FFF3D1',
  gold: '#F5C16C',
  goldDeep: '#D48B28',
  cyanBright: '#E0F7FA',
  cyan: '#67E8F9',
  coral: '#FB7185',
  ink: '#F5F0E6',
  sub: 'rgba(218, 206, 188, 0.56)',
  muted: 'rgba(205, 190, 165, 0.42)',
  hairline: 'rgba(235, 198, 135, 0.24)',
};

// ============================================================================
// Type A 爆款模板组件：1,000 节点渗流相变网络（Percolation Lattice & Giant Cluster）
// 科学保证：
// - 40×25 = 1,000 颗有机微扰晶格节点
// - 当已点亮节点 N <= 500 (如 12 -> 335 -> 450 -> 487 -> 500) 时：
//   表层金色连通流被阻断在 row=5 (可见深度停滞在 19.0% ~ 22.0%)；
//   而暗处下方 (row=7..24) 早已悄然连成一片含 360+ 节点的巨型潜伏暗网 (Giant Latent Cluster)！
// - 当第 501 个节点 (Bridge Node #501, 位于 row=6, col=20) 点亮时：
//   上下两张大网瞬间合龙，金色闪电沿 BFS 波前在 1.5 秒内贯穿至 100% 底部！
// ============================================================================
let _cachedPercolation = null;

export function getPercolationNetwork() {
  if (_cachedPercolation) return _cachedPercolation;

  const COLS = 40, ROWS = 25, N = COLS * ROWS; // 1000 nodes
  const r = rng(20260901);
  const idxOf = (c, rw) => rw * COLS + c;
  const bridgeIdx = idxOf(20, 6);

  const nodes = new Array(N);
  for (let rw = 0; rw < ROWS; rw++) {
    for (let c = 0; c < COLS; c++) {
      const id = idxOf(c, rw);
      const isBridge = id === bridgeIdx;
      const jx = isBridge ? 0 : (r() - 0.5) * 0.52;
      const jy = isBridge ? 0 : (r() - 0.5) * 0.52;
      const u = (c + 0.5 + jx) / COLS;
      const v = (rw + 0.5 + jy) / ROWS;
      nodes[id] = {
        id,
        c,
        rw,
        u: clamp(u, 0.015, 0.985),
        v: clamp(v, 0.02, 0.98),
        z: (r() - 0.5) * 0.35,
        order: 999,
        zone: 'unlit', // 'upperGold' | 'lowerGiant' | 'isolated' | 'bridge' | 'late'
        cascadeDist: 1,
        onMasterPath: false,
      };
    }
  }

  // 1. 构造主干闪电路径 (Master Percolation Backbone from row 0 -> bridge (20,6) -> row 24)
  const masterCoords = [
    [19, 0], [19, 1], [20, 1], [20, 2], [21, 3], [20, 4], [20, 5],
    [20, 6], // <-- Bridge Node #501!
    [20, 7], [19, 8], [19, 9], [20, 10], [21, 11], [21, 12], [20, 13],
    [19, 14], [19, 15], [20, 16], [21, 17], [20, 18], [20, 19], [21, 20],
    [21, 21], [20, 22], [20, 23], [20, 24],
  ];
  const masterPathIds = masterCoords.map(([c, rw]) => idxOf(c, rw));
  for (const id of masterPathIds) nodes[id].onMasterPath = true;

  // 2. 构造上方表层金网 (Upper Golden Cluster, rows 0..5, 约 112 颗节点，最大深度止步于 row=5 即 21%)
  const upperSet = new Set();
  for (let i = 0; i < 7; i++) upperSet.add(masterPathIds[i]); // row 0..5 on master path
  // 从主干向左右分叉生长表层树枝 (限制在 rw <= 4，只有主干尖端到达 rw = 5)
  const upperQueue = [...upperSet];
  while (upperSet.size < 112 && upperQueue.length > 0) {
    const curId = upperQueue[Math.floor(r() * upperQueue.length)];
    const cur = nodes[curId];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]];
    for (const [dc, dr] of dirs) {
      if (upperSet.size >= 112) break;
      const nc = cur.c + dc, nr = cur.rw + dr;
      if (nc < 2 || nc >= COLS - 2 || nr < 0 || nr > 4) continue;
      if (nr === 4 && Math.abs(nc - 20) > 12 && r() < 0.6) continue;
      const nid = idxOf(nc, nr);
      if (!upperSet.has(nid) && r() < 0.58) {
        upperSet.add(nid);
        upperQueue.push(nid);
      }
    }
    if (r() < 0.25) upperQueue.shift();
  }
  for (const id of upperSet) nodes[id].zone = 'upperGold';

  // 3. 构造暗处巨型潜伏簇 (Lower Giant Latent Cluster, rows 7..24, 约 348 颗节点，早已在暗处连成一片大陆)
  const lowerGiantSet = new Set();
  for (let i = 7; i < masterPathIds.length; i++) lowerGiantSet.add(masterPathIds[i]);
  // 在暗处生长左右两大翼分支并交织回主干
  const wingSeeds = [
    [12, 9], [10, 12], [8, 15], [13, 18], [15, 21],
    [27, 9], [30, 12], [32, 16], [26, 19], [25, 22],
  ];
  for (const [wc, wr] of wingSeeds) {
    // 用折线把翼种连回主干同层节点
    let cc = wc, cr = wr;
    lowerGiantSet.add(idxOf(cc, cr));
    while (cc !== 20) {
      cc += cc < 20 ? 1 : -1;
      if (r() < 0.3 && cr > 8 && cr < 23) cr += r() < 0.5 ? 1 : -1;
      lowerGiantSet.add(idxOf(cc, cr));
    }
  }
  const lowerQueue = [...lowerGiantSet];
  while (lowerGiantSet.size < 348 && lowerQueue.length > 0) {
    const curId = lowerQueue[Math.floor(r() * lowerQueue.length)];
    const cur = nodes[curId];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (const [dc, dr] of dirs) {
      if (lowerGiantSet.size >= 348) break;
      const nc = cur.c + dc, nr = cur.rw + dr;
      if (nc < 1 || nc >= COLS - 1 || nr < 7 || nr >= ROWS) continue;
      // 在 row=7 只允许靠近 bridge (col 18..22) 的节点，强化单点桥接戏剧感
      if (nr === 7 && Math.abs(nc - 20) > 3) continue;
      const nid = idxOf(nc, nr);
      if (!lowerGiantSet.has(nid) && r() < 0.52) {
        lowerGiantSet.add(nid);
        lowerQueue.push(nid);
      }
    }
    if (r() < 0.22) lowerQueue.shift();
  }
  for (const id of lowerGiantSet) nodes[id].zone = 'lowerGiant';

  // 4. 构造 40 颗孤立微尘节点 (在 N <= 500 时点亮，但既不连上表层也不连入暗网，体现“零散的孤岛”)
  const isolatedSet = new Set();
  for (let tries = 0; tries < 2000 && isolatedSet.size < 40; tries++) {
    const c = 1 + Math.floor(r() * (COLS - 2));
    const rw = 5 + Math.floor(r() * (ROWS - 6));
    if (rw === 6) continue; // 保持第 6 行断裂带纯净
    const id = idxOf(c, rw);
    if (upperSet.has(id) || lowerGiantSet.has(id) || isolatedSet.has(id)) continue;
    // 确保与 lowerGiantSet 和 upperSet 不直接四邻接
    let touchesMain = false;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nc = c + dc, nr = rw + dr;
      if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
        const nid = idxOf(nc, nr);
        if (upperSet.has(nid) || lowerGiantSet.has(nid)) touchesMain = true;
      }
    }
    if (!touchesMain) {
      isolatedSet.add(id);
      nodes[id].zone = 'isolated';
    }
  }

  // 校验前 500 颗节点池大小 = 112 + 348 + 40 = 500 颗！
  const first500 = [...upperSet, ...lowerGiantSet, ...isolatedSet];
  // 按自然生长顺序排列 1..500：让表层与深层交替点亮，且第 499、500 颗正好落在桥接点附近
  first500.sort((a, b) => {
    const na = nodes[a], nb = nodes[b];
    // 让主干在桥接点两侧的 (20,5) 和 (20,7) 较早点亮，随时准备合龙
    if (a === idxOf(20, 5)) return -1;
    if (b === idxOf(20, 5)) return 1;
    if (a === idxOf(20, 7)) return -1;
    if (b === idxOf(20, 7)) return 1;
    const sa = (na.zone === 'upperGold' ? na.rw * 0.12 : 0.15) + r() * 0.85;
    const sb = (nb.zone === 'upperGold' ? nb.rw * 0.12 : 0.15) + r() * 0.85;
    return sa - sb;
  });

  // 把 #499 和 #500 固定在桥接点左右侧近邻，营造 499 -> 500 -> 501 倒计时高潮
  for (let i = 0; i < first500.length; i++) {
    nodes[first500[i]].order = i + 1; // 1 .. 500
  }

  // 第 501 颗节点：命运桥接点 (Bridge Node #501)
  nodes[bridgeIdx].zone = 'bridge';
  nodes[bridgeIdx].order = 501;

  // 其余 499 颗节点分配为 502 .. 1000
  const remaining = [];
  for (let id = 0; id < N; id++) {
    if (nodes[id].order === 999) {
      nodes[id].zone = 'late';
      remaining.push(id);
    }
  }
  remaining.sort(() => r() - 0.5);
  for (let i = 0; i < remaining.length; i++) {
    nodes[remaining[i]].order = 502 + i;
  }

  // 5. 构建晶格连边 (Bonds) 与从 Bridge #501 出发的 BFS 闪电传播距离
  const edges = [];
  const adj = Array.from({ length: N }, () => []);
  const addEdge = (a, b, isMaster = false) => {
    if (a === b) return;
    const u = Math.min(a, b), v = Math.max(a, b);
    if (adj[u].includes(v)) return;
    // 禁止除了 #501 以外的任何边跨越 row=5 到 row=7 的隔离带
    const ra = nodes[a].rw, rb = nodes[b].rw;
    if ((ra <= 5 && rb >= 6) || (rb <= 5 && ra >= 6)) {
      if (a !== bridgeIdx && b !== bridgeIdx) return;
    }
    adj[u].push(v);
    adj[v].push(u);
    edges.push({ a: u, b: v, isMaster });
  };

  // 先确保主干闪电路径 100% 连通
  for (let i = 0; i < masterPathIds.length - 1; i++) {
    addEdge(masterPathIds[i], masterPathIds[i + 1], true);
  }

  // 连接网格四邻域与部分对角线
  for (let rw = 0; rw < ROWS; rw++) {
    for (let c = 0; c < COLS; c++) {
      const id = idxOf(c, rw);
      if (c + 1 < COLS) addEdge(id, idxOf(c + 1, rw));
      if (rw + 1 < ROWS) addEdge(id, idxOf(c, rw + 1));
      if (c + 1 < COLS && rw + 1 < ROWS && r() < 0.38) addEdge(id, idxOf(c + 1, rw + 1));
      if (c - 1 >= 0 && rw + 1 < ROWS && r() < 0.38) addEdge(id, idxOf(c - 1, rw + 1));
    }
  }

  // 计算从 Bridge Node #501 出发的 BFS 激波传播距离 cascadeDist (0.0 -> 1.0)
  const dist = new Int32Array(N).fill(-1);
  const q = [bridgeIdx];
  dist[bridgeIdx] = 0;
  let maxD = 1;
  while (q.length > 0) {
    const u = q.shift();
    for (const v of adj[u]) {
      if (nodes[v].order <= 501 && dist[v] === -1) {
        dist[v] = dist[u] + 1;
        if (dist[v] > maxD) maxD = dist[v];
        q.push(v);
      }
    }
  }
  for (let id = 0; id < N; id++) {
    nodes[id].cascadeDist = dist[id] >= 0 ? dist[id] / maxD : (nodes[id].rw / ROWS);
  }

  _cachedPercolation = { COLS, ROWS, N, nodes, edges, bridgeIdx, masterPathIds };
  return _cachedPercolation;
}

export function createStage({ W, H, debug = false }) {
  const k = H / 1080, VW = W / k;
  const canvas3d = document.createElement('canvas'); canvas3d.width = W; canvas3d.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;

  const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out);
  const ctx = out.getContext('2d', { willReadFrequently: true });

  function makeComposer(scene, camera, { strength = 0.85, radius = 0.55, threshold = 0.2 } = {}) {
    const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), strength, radius, threshold);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return { composer, bloom };
  }

  // 预生成 110 颗散焦景深星尘
  const rand = rng(20261119);
  const bokehDust = Array.from({ length: 110 }, () => ({
    x: rand() * 1920,
    y: rand() * 1080,
    r: 1.0 + rand() * 3.8,
    vx: (rand() - 0.35) * 14,
    vy: -4 - rand() * 12,
    phase: rand() * Math.PI * 2,
    isGold: rand() > 0.3,
    alpha: 0.08 + rand() * 0.22,
  }));

  function drawVibeBackdrop(t, { cx = 0.5, cy = 0.44, glowRadius = 0.65, goldTint = 1.0, cyanTint = 0.0 } = {}) {
    ctx.save();
    const g = ctx.createRadialGradient(W * cx, H * cy, 0, W * cx, H * cy, W * glowRadius);
    const r0 = Math.round(lerp(26, 36, goldTint) + cyanTint * 6);
    const g0 = Math.round(lerp(22, 28, goldTint) + cyanTint * 14);
    const b0 = Math.round(lerp(20, 19, goldTint) + cyanTint * 26);
    g.addColorStop(0, `rgb(${r0}, ${g0}, ${b0})`);
    g.addColorStop(0.58, '#110e0b');
    g.addColorStop(1, '#09080b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 柔和环境星云光晕
    const amb = ctx.createRadialGradient(W * cx, H * cy, 0, W * cx, H * cy, W * 0.42);
    amb.addColorStop(0, `rgba(245, 193, 108, ${0.065 * goldTint})`);
    amb.addColorStop(0.6, `rgba(103, 232, 249, ${0.035 * cyanTint})`);
    amb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = amb;
    ctx.fillRect(0, 0, W, H);

    // 漂浮散焦微尘
    for (const d of bokehDust) {
      const px = ((d.x + d.vx * t) % 1920 + 1920) % 1920;
      const py = ((d.y + d.vy * t) % 1080 + 1080) % 1080;
      const pulse = 0.55 + 0.45 * Math.sin(t * 1.4 + d.phase);
      const a = d.alpha * pulse;
      ctx.fillStyle = d.isGold ? `rgba(245, 198, 120, ${a})` : `rgba(125, 220, 250, ${a * 0.85})`;
      ctx.beginPath();
      ctx.arc(px * k, py * k, d.r * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function serifText(s, x, y, size, color, { weight = 600, align = 'center', alpha = 1, spacing = 1.5, italic = false, glow = null, glowBlur = 18 } = {}) {
    if (alpha <= 0.002 || !s) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size * k}px ${SERIF}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    if (spacing) ctx.letterSpacing = (spacing * k) + 'px';
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = glowBlur * k;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 10 * k;
      ctx.shadowOffsetY = 2 * k;
    }
    ctx.fillText(s, x * k, y * k);
    ctx.restore();
  }

  function monoText(s, x, y, size, color, { weight = 500, align = 'left', alpha = 1, spacing = 1.0, glow = null } = {}) {
    if (alpha <= 0.002 || !s) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${weight} ${size * k}px ${MONO}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    if (spacing) ctx.letterSpacing = (spacing * k) + 'px';
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 14 * k;
    }
    ctx.fillText(s, x * k, y * k);
    ctx.restore();
  }

  function hairline(x1, y1, x2, y2, color = PAL.hairline, alpha = 1, width = 1, dash = null) {
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * k;
    if (dash) ctx.setLineDash(dash.map(d => d * k));
    ctx.beginPath();
    ctx.moveTo(x1 * k, y1 * k);
    ctx.lineTo(x2 * k, y2 * k);
    ctx.stroke();
    ctx.restore();
  }

  function glowDot(x, y, r, color = PAL.gold, alpha = 1, bloomR = 18) {
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x * k, y * k, 0, x * k, y * k, bloomR * k);
    g.addColorStop(0, color);
    g.addColorStop(0.35, color.startsWith('#F5') || color.startsWith('#FF') ? 'rgba(245, 193, 108, 0.38)' : 'rgba(103, 232, 249, 0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x * k, y * k, bloomR * k, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x * k, y * k, r * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawElectricArc(x1, y1, x2, y2, t, { color = PAL.gold, alpha = 1, amp = 14, seed = 1 } = {}) {
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const steps = 18;
    const dx = x2 - x1, dy = y2 - y1;
    const nx = -dy / (Math.hypot(dx, dy) || 1), ny = dx / (Math.hypot(dx, dy) || 1);

    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? color : '#FFF9E6';
      ctx.lineWidth = (pass === 0 ? 3.2 : 1.4) * k;
      ctx.shadowColor = color;
      ctx.shadowBlur = (pass === 0 ? 22 : 10) * k;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const env = Math.sin(u * Math.PI);
        const jitter = Math.sin(u * 19 + t * 28 + seed * 3.7) * Math.cos(u * 11 - t * 22 + pass * 1.9);
        const px = x1 + dx * u + nx * jitter * amp * env;
        const py = y1 + dy * u + ny * jitter * amp * env;
        if (i === 0) ctx.moveTo(px * k, py * k);
        else ctx.lineTo(px * k, py * k);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Type A 核心渲染器：绘制 1,000 节点渗流晶格板（对标 60w 赞《渗流相变》高定升级版）
  function drawPercolationSlab(x0, y0, w, h, t, {
    litCount = 335,
    showLatentCyan = false,
    latentAlpha = 0,
    cascadeProg = 0, // 0 = 未越过 #501; 0..1 = #501 触发后的金色雪崩激波进度
    showIntuitionLine = false,
    intuitionPct = 0.487,
    highlightBridge = false,
    alpha = 1,
    showDepthRuler = true,
  } = {}) {
    if (alpha <= 0.002) return;
    const net = getPercolationNetwork();
    const { nodes, edges, bridgeIdx, masterPathIds } = net;
    const nLit = Math.floor(clamp(litCount, 0, 1000));
    const isCascading = nLit >= 501 && cascadeProg > 0.001;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. 曜石黑金晶格容器背景与顶部鎏金水源横梁
    const bg = ctx.createLinearGradient(0, y0 * k, 0, (y0 + h) * k);
    bg.addColorStop(0, 'rgba(34, 27, 19, 0.72)');
    bg.addColorStop(0.5, 'rgba(18, 15, 12, 0.78)');
    bg.addColorStop(1, 'rgba(12, 10, 9, 0.85)');
    ctx.fillStyle = bg;
    ctx.fillRect(x0 * k, y0 * k, w * k, h * k);

    ctx.strokeStyle = 'rgba(235, 198, 135, 0.24)';
    ctx.lineWidth = 1.2 * k;
    ctx.strokeRect(x0 * k, y0 * k, w * k, h * k);

    // 顶部金色能量源发光源带
    const topGlow = ctx.createLinearGradient(0, (y0 - 6) * k, 0, (y0 + 36) * k);
    topGlow.addColorStop(0, 'rgba(255, 240, 195, 0.85)');
    topGlow.addColorStop(0.3, 'rgba(245, 193, 108, 0.32)');
    topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(x0 * k, y0 * k, w * k, 36 * k);
    hairline(x0, y0, x0 + w, y0, PAL.goldBright, alpha * 0.95, 2.6);

    // 底部 100% 触底金池辉光（当 cascadeProg > 0.82 时亮起）
    if (isCascading && cascadeProg > 0.82) {
      const botA = smooth((cascadeProg - 0.82) / 0.18);
      const botGlow = ctx.createLinearGradient(0, (y0 + h - 42) * k, 0, (y0 + h + 6) * k);
      botGlow.addColorStop(0, 'rgba(0, 0, 0, 0)');
      botGlow.addColorStop(0.65, `rgba(245, 193, 108, ${0.38 * botA})`);
      botGlow.addColorStop(1, `rgba(255, 243, 209, ${0.92 * botA})`);
      ctx.fillStyle = botGlow;
      ctx.fillRect(x0 * k, (y0 + h - 42) * k, w * k, 44 * k);
      hairline(x0, y0 + h, x0 + w, y0 + h, PAL.goldBright, alpha * botA, 3.2);
    }

    const pxOf = nd => x0 + nd.u * w;
    const pyOf = nd => y0 + nd.v * h;

    // 判定每颗节点当前的点亮与连通状态
    const getNodeState = nd => {
      if (nd.order > nLit) return 'unlit';
      if (nd.zone === 'upperGold') {
        // 早期按行渐进渗入
        const maxRowAllowed = nLit < 80 ? 2 : nLit < 220 ? 4 : 5;
        return nd.rw <= maxRowAllowed ? 'gold' : 'dimLit';
      }
      if (nd.zone === 'bridge') {
        return isCascading ? 'bridgeGold' : 'unlit';
      }
      if (nd.zone === 'lowerGiant') {
        if (isCascading && cascadeProg >= nd.cascadeDist) return 'gold';
        if (showLatentCyan && latentAlpha > 0.01) return 'latentCyan';
        return 'dimLit';
      }
      if (nd.zone === 'late' && isCascading && cascadeProg >= 0.95) {
        return 'gold';
      }
      return 'dimLit';
    };

    // 2. 绘制底层未激活微裂纹网格 + 已激活连边
    for (const e of edges) {
      const na = nodes[e.a], nb = nodes[e.b];
      const sa = getNodeState(na), sb = getNodeState(nb);
      const x1 = pxOf(na), y1 = pyOf(na), x2 = pxOf(nb), y2 = pyOf(nb);

      const bothGold = (sa === 'gold' || sa === 'bridgeGold') && (sb === 'gold' || sb === 'bridgeGold');
      const bothCyan = sa === 'latentCyan' && sb === 'latentCyan';
      const bothLit = sa !== 'unlit' && sb !== 'unlit';

      if (bothGold) {
        ctx.strokeStyle = e.isMaster && isCascading ? '#FFF8E0' : 'rgba(245, 193, 108, 0.78)';
        ctx.lineWidth = (e.isMaster && isCascading ? 2.8 : 1.55) * k;
        ctx.beginPath();
        ctx.moveTo(x1 * k, y1 * k);
        ctx.lineTo(x2 * k, y2 * k);
        ctx.stroke();
      } else if (bothCyan) {
        ctx.strokeStyle = `rgba(103, 232, 249, ${0.58 * latentAlpha})`;
        ctx.lineWidth = 1.45 * k;
        ctx.beginPath();
        ctx.moveTo(x1 * k, y1 * k);
        ctx.lineTo(x2 * k, y2 * k);
        ctx.stroke();
      } else if (bothLit) {
        ctx.strokeStyle = 'rgba(215, 175, 115, 0.22)';
        ctx.lineWidth = 0.95 * k;
        ctx.beginPath();
        ctx.moveTo(x1 * k, y1 * k);
        ctx.lineTo(x2 * k, y2 * k);
        ctx.stroke();
      } else {
        // 暗处微裂纹底纹
        ctx.strokeStyle = 'rgba(160, 140, 115, 0.075)';
        ctx.lineWidth = 0.7 * k;
        ctx.beginPath();
        ctx.moveTo(x1 * k, y1 * k);
        ctx.lineTo(x2 * k, y2 * k);
        ctx.stroke();
      }
    }

    // 3. 当 #501 贯通后，高亮绘制贯穿全场的金色闪电主干道 (Master Lightning Backbone)
    if (isCascading) {
      ctx.save();
      ctx.strokeStyle = '#FFF9E6';
      ctx.lineWidth = 3.2 * k;
      ctx.shadowColor = PAL.gold;
      ctx.shadowBlur = 18 * k;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < masterPathIds.length; i++) {
        const nd = nodes[masterPathIds[i]];
        if (nd.rw > 6 && cascadeProg < nd.cascadeDist) break;
        const px = pxOf(nd) * k, py = pyOf(nd) * k;
        if (!started) { ctx.moveTo(px, py); started = true; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4. 逐颗绘制 1,000 个节点
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      const st = getNodeState(nd);
      const px = pxOf(nd), py = pyOf(nd);

      if (st === 'unlit') {
        ctx.fillStyle = 'rgba(180, 165, 145, 0.11)';
        ctx.beginPath();
        ctx.arc(px * k, py * k, 1.3 * k, 0, Math.PI * 2);
        ctx.fill();
      } else if (st === 'dimLit') {
        // 已点亮但尚未接通主干的暗处微光节点
        ctx.fillStyle = 'rgba(235, 190, 118, 0.42)';
        ctx.beginPath();
        ctx.arc(px * k, py * k, 2.2 * k, 0, Math.PI * 2);
        ctx.fill();
      } else if (st === 'latentCyan') {
        // S03/S04 透视模式下：暗处早已连成一片的冰青色潜伏簇
        const pulse = 0.75 + 0.25 * Math.sin(t * 3.0 + nd.id * 0.17);
        ctx.fillStyle = `rgba(103, 232, 249, ${0.78 * latentAlpha * pulse})`;
        ctx.beginPath();
        ctx.arc(px * k, py * k, 2.8 * k, 0, Math.PI * 2);
        ctx.fill();
      } else if (st === 'gold' || st === 'bridgeGold') {
        const isFront = isCascading && Math.abs(cascadeProg - nd.cascadeDist) < 0.09 && nd.rw >= 6;
        const rad = st === 'bridgeGold' ? 5.5 : isFront ? 4.2 : (nd.onMasterPath && isCascading ? 3.4 : 2.7);
        if (isFront || st === 'bridgeGold' || (nd.rw === 5 && !isCascading && i % 3 === 0)) {
          glowDot(px, py, rad * 0.7, PAL.goldBright, alpha, st === 'bridgeGold' ? 28 : 14);
        } else {
          ctx.fillStyle = '#FFE8B3';
          ctx.beginPath();
          ctx.arc(px * k, py * k, rad * k, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 5. 高亮 Bridge Node #501 准星与脉冲环
    if (highlightBridge) {
      const bNode = nodes[bridgeIdx];
      const bx = pxOf(bNode), by = pyOf(bNode);
      const pulseR = 14 + 6 * Math.sin(t * 5.2);
      ctx.save();
      ctx.strokeStyle = isCascading ? PAL.goldBright : PAL.coral;
      ctx.lineWidth = 1.6 * k;
      ctx.setLineDash(isCascading ? [] : [4 * k, 3 * k]);
      ctx.beginPath();
      ctx.arc(bx * k, by * k, pulseR * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (isCascading) {
        glowDot(bx, by, 5.2, PAL.goldBright, alpha, 34);
      }
    }

    // 6. 左侧实时渗流深度标尺 (19% 卡死 vs 100% 到底)
    if (showDepthRuler) {
      let reachPct = 0.04;
      if (nLit < 501 || !isCascading) {
        reachPct = clamp(0.05 + 0.14 * smooth(nLit / 320) + 0.02 * smooth((nLit - 320) / 180), 0.05, 0.21);
        if (nLit >= 330 && nLit <= 490) reachPct = 0.19; // 对标名场面 19%
        else if (nLit > 490) reachPct = 0.21;
      } else {
        reachPct = lerp(0.21, 1.0, smoother(cascadeProg));
      }
      const ry = y0 + reachPct * h;
      hairline(x0 - 28, ry, x0 + 10, ry, PAL.gold, alpha, 2.0);
      monoText(`${Math.round(reachPct * 100)}%`, x0 - 34, ry + 5, 14, PAL.gold, {
        align: 'right',
        alpha,
        weight: 600,
        glow: 'rgba(245, 193, 108, 0.45)',
      });
    }

    // 7. 直觉预期虚线 (例如：点亮 48.7% 的点，直觉以为水该渗到 48.7%)
    if (showIntuitionLine) {
      const iy = y0 + intuitionPct * h;
      hairline(x0, iy, x0 + w, iy, 'rgba(103, 232, 249, 0.55)', alpha, 1.4, [6, 5]);
      ctx.save();
      ctx.fillStyle = 'rgba(12, 16, 22, 0.88)';
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.48)';
      ctx.lineWidth = 1 * k;
      ctx.fillRect((x0 + 14) * k, (iy - 14) * k, 152 * k, 26 * k);
      ctx.strokeRect((x0 + 14) * k, (iy - 14) * k, 152 * k, 26 * k);
      ctx.restore();
      serifText(`直觉预期 ${Math.round(intuitionPct * 100)}%`, x0 + 90, iy + 4, 14.5, PAL.cyan, {
        align: 'center',
        alpha,
      });
    }

    ctx.restore();
  }

  // CaMKII 12 瓣金色分子环渲染器（保留自 EP008）
  function drawCaMKIIRing(cx, cy, radius, petals, t, {
    alpha = 1,
    showNumbers = true,
    showHub = true,
    hubText = '',
    hubSub = '',
    rotation = 0,
    scale = 1,
  } = {}) {
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const R = radius * scale;
    const activeCount = petals.filter(p => p.state === 'gold').length;
    const glowRatio = activeCount / 12;
    if (glowRatio > 0) {
      const bgGlow = ctx.createRadialGradient(cx * k, cy * k, 0, cx * k, cy * k, R * 1.75 * k);
      bgGlow.addColorStop(0, `rgba(245, 193, 108, ${0.16 * glowRatio})`);
      bgGlow.addColorStop(0.55, `rgba(212, 139, 40, ${0.06 * glowRatio})`);
      bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bgGlow;
      ctx.beginPath();
      ctx.arc(cx * k, cy * k, R * 1.75 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = `rgba(235, 198, 135, ${0.18 * alpha})`;
    ctx.lineWidth = 1 * k;
    ctx.beginPath();
    ctx.arc(cx * k, cy * k, R * 1.26 * k, 0, Math.PI * 2);
    ctx.stroke();

    if (showHub) {
      ctx.strokeStyle = `rgba(245, 193, 108, ${(0.22 + 0.25 * glowRatio) * alpha})`;
      ctx.lineWidth = 1.4 * k;
      ctx.beginPath();
      ctx.arc(cx * k, cy * k, R * 0.44 * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (hubText) {
      serifText(hubText, cx, cy + (hubSub ? -2 : 8), Math.round(24 * scale), PAL.goldBright, {
        weight: 600,
        align: 'center',
        alpha,
        spacing: 2,
        glow: 'rgba(245, 193, 108, 0.55)',
      });
    }
    if (hubSub) {
      monoText(hubSub, cx, cy + 22 * scale, Math.round(13 * scale), PAL.sub, {
        align: 'center',
        alpha: alpha * 0.85,
      });
    }
    ctx.restore();
  }

  // 左上极简中文幕标（去除英文副标，减少画面文字干扰）
  function drawMicroHeader(tlRaw, absT) {
    const shots = tlRaw && tlRaw.shots;
    if (!shots) return;
    const sh = shots.find(s => absT >= s.start && absT <= s.end);
    if (!sh) return;
    const dt = absT - sh.start;
    const rem = sh.end - absT;
    const a = smooth(dt / 0.6) * smooth(rem / 0.5);
    if (a <= 0.003) return;

    const x0 = 78, y0 = 56;
    glowDot(x0, y0 - 6, 2.2, PAL.gold, a * 0.85, 10);
    serifText(`${sh.chapterNo}   ${sh.chapterCn}`, x0 + 16, y0, 18, PAL.gold, {
      weight: 600,
      align: 'left',
      alpha: a * 0.88,
      spacing: 3.0,
    });
    const lineW = 140 * smooth(dt / 1.1);
    hairline(x0, y0 + 13, x0 + lineW, y0 + 13, 'rgba(245, 193, 108, 0.28)', a, 1);
  }

  // 解析 [gold:关键词] 并绘制大号纯中文宋刻衬线呼吸字幕（54px，无英文副行）
  function parseTokens(raw) {
    const re = /\[(gold|cyan|coral):([^\]]+)\]/g;
    const segs = [];
    let last = 0, m;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) segs.push({ text: raw.slice(last, m.index), color: null });
      segs.push({ text: m[2], color: m[1] });
      last = re.lastIndex;
    }
    if (last < raw.length) segs.push({ text: raw.slice(last), color: null });
    return segs;
  }

  function drawVibeSubtitle(tlRaw, absT) {
    const subs = tlRaw && tlRaw.subtitles;
    if (!subs || !subs.length) return;
    const cue = subs.find(c => absT >= c.start - 0.08 && absT <= c.displayEnd + 0.12);
    if (!cue) return;
    const a = clamp(Math.min(
      smooth((absT - (cue.start - 0.08)) / 0.26),
      smooth(((cue.displayEnd + 0.12) - absT) / 0.28)
    ));
    if (a <= 0.003) return;

    const lift = (1 - smooth((absT - cue.start) / 0.35)) * 8;
    const yCn = 968 + lift;

    ctx.save();
    // 底部柔和暗角遮罩，保证大号字幕清透对比度
    const g = ctx.createLinearGradient(0, (1080 - 220) * k, 0, H);
    g.addColorStop(0, 'rgba(4, 4, 5, 0)');
    g.addColorStop(0.5, `rgba(4, 4, 5, ${0.46 * a})`);
    g.addColorStop(1, `rgba(4, 4, 5, ${0.82 * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, (1080 - 220) * k, W, 220 * k);

    // 测量并分段绘制 56px 中文大号主句 + 关键词单点染色发光
    const segs = parseTokens(cue.text);
    const fontSize = 56;
    ctx.font = `600 ${fontSize * k}px ${SERIF}`;
    ctx.letterSpacing = (2.8 * k) + 'px';
    const widths = segs.map(s => ctx.measureText(s.text).width);
    const totalW = widths.reduce((acc, w) => acc + w, 0);
    let curX = (W - totalW) / 2;

    ctx.globalAlpha = a;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const sw = widths[i];
      let col = PAL.ink;
      let glowCol = 'rgba(0, 0, 0, 0.92)';
      let blur = 14;

      if (seg.color === 'gold') {
        col = PAL.gold;
        glowCol = 'rgba(245, 193, 108, 0.78)';
        blur = 26;
      } else if (seg.color === 'cyan') {
        col = PAL.cyan;
        glowCol = 'rgba(103, 232, 249, 0.75)';
        blur = 26;
      } else if (seg.color === 'coral') {
        col = PAL.coral;
        glowCol = 'rgba(251, 113, 133, 0.75)';
        blur = 26;
      }

      if (seg.color) {
        const kwGlow = ctx.createRadialGradient(
          curX + sw / 2, yCn * k - 16 * k, 0,
          curX + sw / 2, yCn * k - 16 * k, Math.max(sw * 0.85, 46 * k)
        );
        kwGlow.addColorStop(0, seg.color === 'gold' ? 'rgba(245, 193, 108, 0.24)' : seg.color === 'cyan' ? 'rgba(103, 232, 249, 0.22)' : 'rgba(251, 113, 133, 0.22)');
        kwGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = kwGlow;
        ctx.fillRect(curX - 28 * k, (yCn - 62) * k, sw + 56 * k, 82 * k);
      }

      ctx.shadowColor = glowCol;
      ctx.shadowBlur = blur * k;
      ctx.shadowOffsetY = seg.color ? 0 : 2.5 * k;
      ctx.fillStyle = col;
      ctx.fillText(seg.text, curX, yCn * k);
      curX += sw;
    }
    ctx.restore();
  }

  function debugLabel(s) {
    if (!debug) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, 560 * k, 52 * k);
    ctx.restore();
    monoText(s, 16, 36, 24, '#fde047', { weight: 600 });
  }

  function readFrame() {
    const data = ctx.getImageData(0, 0, W, H).data;
    let sum = 0, white = 0, n = 0, mx = 0;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4;
        const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        sum += l; n++;
        if (l >= 235) white++;
        if (l > mx) mx = l;
      }
    }
    return { data, stats: { mean: +(sum / n).toFixed(2), white: +(white / n).toFixed(5), max: Math.round(mx) } };
  }

  return {
    W, H, k, VW, renderer, canvas3d, ctx, makeComposer, debug,
    ui: {
      drawVibeBackdrop,
      serifText,
      monoText,
      hairline,
      glowDot,
      drawElectricArc,
      drawPercolationSlab,
      drawCaMKIIRing,
      drawMicroHeader,
      drawVibeSubtitle,
      debugLabel,
    },
    composite3D() {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(canvas3d, 0, 0);
      ctx.restore();
    },
    readFrame,
  };
}
