#!/usr/bin/env node
/**
 * EP009《临界点：你以为努力是线性的，其实它是渗流》抖音竖版封面渲染器（纯中文大字版，0 英文）
 * 同时输出 9:16 (1080x1920) 信息流全屏封面 与 3:4 (1080x1440) 个人主页双列安全区封面
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.resolve(DIR, '../../07_Output');
const IS_MAC = process.platform === 'darwin';
const FFMPEG = process.env.FFMPEG_BIN || (fs.existsSync('/Users/ookk/OOKKautocut/data/tools/ffmpeg') ? '/Users/ookk/OOKKautocut/data/tools/ffmpeg' : 'ffmpeg');
const CHROME = process.env.CHROME_BIN || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/opt/meta-chromium/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(p => fs.existsSync(p)) || 'google-chrome';

const W = 1080, H = 1920;

const COVER_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#050506;overflow:hidden}</style>
<script type="importmap">
{
  "imports": {
    "three": "/node_modules/three/build/three.module.js",
    "three/addons/": "/node_modules/three/examples/jsm/"
  }
}
</script>
</head>
<body>
<script type="module">
import * as THREE from 'three';
import { createStage, SERIF, PAL, rng, lerp, getPercolationNetwork } from '/lib/core.js';

const p = new URLSearchParams(location.search);
const VARIANT = p.get('variant') || 'climax'; // 'climax' | 'bigtitle'

async function run() {
  await Promise.all([
    \`600 96px \${SERIF}\`,
    \`600 56px \${SERIF}\`,
    \`400 32px \${SERIF}\`,
  ].map(f => document.fonts.load(f)));

  const stage = createStage({ W: ${W}, H: 1080, debug: false });
  const out = document.querySelector('canvas');
  out.width = ${W}; out.height = ${H};
  const ctx = out.getContext('2d', { willReadFrequently: true });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, ${W} / ${H}, 0.1, 100);
  camera.position.set(0, 0, 8.2);
  const { composer } = stage.makeComposer(scene, camera, { strength: 0.52, radius: 0.45, threshold: 0.25 });

  const N = 2200;
  const r = rng(20260909);
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = Math.pow(r(), 0.8);
    pos[i * 3] = (r() - 0.5) * 5.2;
    pos[i * 3 + 1] = lerp(-2.6, 2.5, v);
    pos[i * 3 + 2] = (r() - 0.5) * 2.2;
    const isGold = r() > 0.25;
    const br = 0.28 + 0.65 * Math.pow(r(), 1.4);
    col[i * 3] = (isGold ? 0.96 : 0.42) * br;
    col[i * 3 + 1] = (isGold ? 0.74 : 0.86) * br;
    col[i * 3 + 2] = (isGold ? 0.36 : 0.96) * br;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = 64; spriteCanvas.height = 64;
  const sctx = spriteCanvas.getContext('2d');
  const sg = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  sg.addColorStop(0, 'rgba(255,255,255,1)');
  sg.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 64, 64);

  const mat = new THREE.PointsMaterial({
    size: 0.052,
    map: new THREE.CanvasTexture(spriteCanvas),
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(geom, mat));
  composer.render();

  // 1. 暖曜石深空黑径向背景
  const bg = ctx.createRadialGradient(540, 960, 0, 540, 960, 1060);
  bg.addColorStop(0, '#1e1710');
  bg.addColorStop(0.54, '#100d0a');
  bg.addColorStop(1, '#050506');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ${W}, ${H});

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(stage.canvas3d, 0, 0, ${W}, ${H});
  ctx.restore();

  function text(s, x, y, size, color, { weight = 600, align = 'center', spacing = 2, glow = null, glowBlur = 24 } = {}) {
    ctx.save();
    ctx.font = \`\${weight} \${size}px \${SERIF}\`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = spacing + 'px';
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = glowBlur;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 3;
    }
    ctx.fillText(s, x, y);
    ctx.restore();
  }

  // 在 y ∈ [275, 1645] 3:4 黄金安全区内排布大字标题与 1,000 节点渗流晶格
  if (VARIANT === 'climax') {
    text('你以为努力是线性的', 540, 395, 62, '#F5F0E6', { spacing: 4 });
    text('其实它是「渗流」', 540, 505, 84, '#FFF3D1', { spacing: 6, glow: 'rgba(245, 193, 108, 0.78)', glowBlur: 32 });

    // 居中绘制第 501 点闪电贯通晶格 (x=190, y=640, w=700, h=720)
    text('501 / 1000', 540, 610, 48, '#F5C16C', { spacing: 3, glow: 'rgba(245, 193, 108, 0.55)' });
    stage.ui.drawPercolationSlab(190, 635, 700, 720, 2.0, {
      litCount: 501,
      showLatentCyan: true,
      latentAlpha: 1.0,
      cascadeProg: 0.72,
      showIntuitionLine: false,
      highlightBridge: true,
      alpha: 0.96,
      showDepthRuler: true,
    });

    text('前 500 个点毫无变化，第 501 个点瞬间贯通全场', 540, 1465, 36, '#67E8F9', { spacing: 2, glow: 'rgba(103, 232, 249, 0.45)' });
    text('—— 致每一个正卡在平台期的人 ——', 540, 1545, 30, 'rgba(235, 220, 195, 0.75)', { weight: 400, spacing: 4 });
  } else {
    // 方案 B：主页三列超大字高点击版
    text('努力了那么久', 540, 430, 82, '#F5F0E6', { spacing: 5 });
    text('为什么毫无变化？', 540, 555, 92, '#FB7185', { spacing: 5, glow: 'rgba(251, 113, 133, 0.72)', glowBlur: 32 });

    text('487 / 1000  →  19%', 540, 675, 44, '#67E8F9', { spacing: 3 });
    stage.ui.drawPercolationSlab(220, 705, 640, 650, 1.5, {
      litCount: 487,
      showLatentCyan: true,
      latentAlpha: 0.95,
      cascadeProg: 0,
      showIntuitionLine: true,
      intuitionPct: 0.49,
      highlightBridge: true,
      alpha: 0.95,
      showDepthRuler: true,
    });

    text('你不是不够好，只是快走到「第 501 个点」了', 540, 1485, 38, '#FFF3D1', { spacing: 2, glow: 'rgba(245, 193, 108, 0.65)' });
  }

  const raw = ctx.getImageData(0, 0, ${W}, ${H}).data;
  await fetch('/frame', { method: 'POST', body: raw });
  await fetch('/done', { method: 'POST', body: '{}' });
}
run().catch(e => fetch('/error', { method: 'POST', body: String(e && e.stack || e) }));
</script>
</body>
</html>`;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

async function renderCoverVariant(variant, outBase9x16, outBase3x4) {
  return new Promise((resolve, reject) => {
    const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-cover09-'));
    let rawBuf = null;

    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://localhost');
      if (req.method === 'POST') {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          const body = Buffer.concat(chunks);
          if (u.pathname === '/frame') {
            rawBuf = body;
            res.end('ok');
          } else if (u.pathname === '/done') {
            res.end('ok');
            finish();
          } else if (u.pathname === '/error') {
            res.end('ok');
            reject(new Error(body.toString()));
          }
        });
        return;
      }
      if (u.pathname === '/cover.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(COVER_HTML);
        return;
      }
      const fp = path.resolve(DIR, '.' + decodeURIComponent(u.pathname));
      if (!fs.existsSync(fp)) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });

    let chrome;
    function finish() {
      try { chrome.kill('SIGKILL'); } catch {}
      try { server.close(); } catch {}
      try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch {}

      if (!rawBuf) return reject(new Error('No frame buffer received'));

      execFileSync(FFMPEG, [
        '-y', '-loglevel', 'error',
        '-f', 'rawvideo', '-pix_fmt', 'rgba', '-video_size', `${W}x${H}`,
        '-i', 'pipe:0',
        '-frames:v', '1',
        `${outBase9x16}.png`,
      ], { input: rawBuf });

      execFileSync(FFMPEG, [
        '-y', '-loglevel', 'error',
        '-i', `${outBase9x16}.png`,
        '-q:v', '2',
        `${outBase9x16}.jpg`,
      ]);

      execFileSync(FFMPEG, [
        '-y', '-loglevel', 'error',
        '-i', `${outBase9x16}.png`,
        '-vf', 'crop=1080:1440:0:240',
        '-q:v', '2',
        `${outBase3x4}.jpg`,
      ]);

      console.log(`Generated [${variant}]:\n  9:16 -> ${outBase9x16}.jpg\n  3:4  -> ${outBase3x4}.jpg`);
      resolve();
    }

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const url = `http://127.0.0.1:${port}/cover.html?variant=${variant}`;
      const glFlags = IS_MAC
        ? ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist']
        : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'];
      chrome = spawn(CHROME, [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu-sandbox',
        ...glFlags,
        '--hide-scrollbars',
        `--user-data-dir=${tmpProfile}`,
        '--window-size=1080,1920',
        url,
      ], { stdio: ['ignore', 'ignore', 'ignore'] });
    });
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await renderCoverVariant(
    'climax',
    path.join(OUT_DIR, '抖音竖版封面_A第501点贯通版_9x16_1080x1920'),
    path.join(OUT_DIR, '抖音主页封面_A第501点贯通版_3x4_1080x1440')
  );
  await renderCoverVariant(
    'bigtitle',
    path.join(OUT_DIR, '抖音竖版封面_B大字痛点悬念版_9x16_1080x1920'),
    path.join(OUT_DIR, '抖音主页封面_B大字痛点悬念版_3x4_1080x1440')
  );
}

main().catch(e => { console.error(e); process.exit(1); });
