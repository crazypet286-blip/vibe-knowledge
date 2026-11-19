// S01 (00:00 - 00:18): 黄金钩子 — 居中 1000 节点暗黑晶格动态点亮 (12 -> 487/1000)，画面极简少字
import * as THREE from 'three';
import { clamp, smooth, smoother, lerp, rng, PAL } from '../lib/core.js';

export default async function (stage) {
  const { W, H, k, VW, ctx, ui } = stage;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  camera.position.set(0, 0.0, 7.5);

  const { composer } = stage.makeComposer(scene, camera, { strength: 0.45, radius: 0.4, threshold: 0.32 });

  const N = 2200;
  const r = rng(9001);
  const basePos = new Float32Array(N * 3);
  const pOrder = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    basePos[i * 3] = (r() - 0.5) * 8.8;
    basePos[i * 3 + 1] = (r() - 0.5) * 5.0;
    basePos[i * 3 + 2] = (r() - 0.5) * 2.6;
    pOrder[i] = r();
  }

  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
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
    size: 0.044,
    map: new THREE.CanvasTexture(spriteCanvas),
    vertexColors: true,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(geom, mat));

  function render(t) {
    let litCount = 12;
    if (t < 3.5) {
      litCount = Math.round(lerp(12, 68, smooth(t / 3.5)));
    } else if (t < 10.5) {
      litCount = Math.round(lerp(68, 317, smoother((t - 3.5) / 7.0)));
    } else if (t < 14.5) {
      litCount = Math.round(lerp(317, 487, smoother((t - 10.5) / 4.0)));
    } else {
      litCount = 487;
    }

    ui.drawVibeBackdrop(t, { cx: 0.5, cy: 0.46, goldTint: 0.92, cyanTint: 0.15 });

    const activeRatio = litCount / 1000;
    for (let i = 0; i < N; i++) {
      const bx = basePos[i * 3], by = basePos[i * 3 + 1], bz = basePos[i * 3 + 2];
      pos[i * 3] = bx + Math.sin(t * 0.45 + i) * 0.08;
      pos[i * 3 + 1] = by + Math.cos(t * 0.38 + i * 0.7) * 0.08;
      pos[i * 3 + 2] = bz;

      const isLit = pOrder[i] < activeRatio * 0.85;
      const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.3);
      if (isLit) {
        col[i * 3] = 0.92 * pulse;
        col[i * 3 + 1] = 0.72 * pulse;
        col[i * 3 + 2] = 0.36 * pulse;
      } else {
        col[i * 3] = 0.14;
        col[i * 3 + 1] = 0.13;
        col[i * 3 + 2] = 0.12;
      }
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    composer.render();
    stage.composite3D();

    const hudA = smooth(t / 0.7) * smooth((17.8 - t) / 0.4);

    // 居中唯一主角：1,000 节点暗黑渗流晶格板，呼吸微浮动
    const floatY = Math.sin(t * 1.1) * 4;
    const sw = 580, sh = 580;
    const sx = (VW - sw) / 2, sy = 205 + floatY;

    // 顶部极简计数器（对标《渗流相变》原片）
    ui.serifText('已点亮', VW / 2, sy - 68, 19, PAL.sub, { align: 'center', alpha: hudA, spacing: 3.0 });
    ui.serifText(`${litCount}`, VW / 2 - 36, sy - 18, 58, PAL.goldBright, {
      weight: 600,
      align: 'right',
      alpha: hudA,
      glow: 'rgba(245, 193, 108, 0.55)',
    });
    ui.serifText('/ 1000', VW / 2 - 20, sy - 20, 26, PAL.muted, {
      weight: 400,
      align: 'left',
      alpha: hudA,
    });

    ui.drawPercolationSlab(sx, sy, sw, sh, t, {
      litCount,
      showLatentCyan: false,
      cascadeProg: 0,
      showIntuitionLine: false,
      alpha: hudA,
      showDepthRuler: true,
    });

    // 仅保留 3 个极简两字微距光点（单词、公式、第317题），随点亮脉冲呼吸
    const tags = [
      { t0: 2.0, u: 0.28, v: 0.36, label: '单词', col: PAL.gold },
      { t0: 4.2, u: 0.72, v: 0.48, label: '公式', col: PAL.cyan },
      { t0: 5.5, u: 0.45, v: 0.68, label: '第 317 题', col: PAL.cyanBright },
    ];
    for (const tg of tags) {
      const ma = smooth((t - tg.t0) / 0.5) * smooth((17.5 - t) / 0.5);
      if (ma <= 0.005) continue;
      const mx = sx + tg.u * sw, my = sy + tg.v * sh;
      ui.glowDot(mx, my, 3.8, tg.col, ma, 18);
      ui.serifText(tg.label, mx + 14, my + 5, 17, tg.col, { align: 'left', alpha: ma * 0.9 });
    }
  }

  return { render };
}
