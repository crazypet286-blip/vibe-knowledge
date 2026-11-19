// S02 (00:18 - 00:38): 直觉的骗局 — 左晶格 (19% vs 直觉 49%) + 右侧极简动态曲线与发光问号 ?
import * as THREE from 'three';
import { clamp, smooth, smoother, lerp, rng, PAL } from '../lib/core.js';

export default async function (stage) {
  const { W, H, k, VW, ctx, ui } = stage;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  camera.position.set(0, 0, 7.6);

  const { composer } = stage.makeComposer(scene, camera, { strength: 0.42, radius: 0.38, threshold: 0.32 });

  const N = 1600;
  const r = rng(9002);
  const base = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    base[i * 3] = (r() - 0.5) * 9.0;
    base[i * 3 + 1] = (r() - 0.5) * 5.0;
    base[i * 3 + 2] = (r() - 0.5) * 2.5;
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
  sg.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 64, 64);

  const mat = new THREE.PointsMaterial({
    size: 0.038,
    map: new THREE.CanvasTexture(spriteCanvas),
    vertexColors: true,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(geom, mat));

  function render(t) {
    ui.drawVibeBackdrop(t + 18, { cx: 0.52, cy: 0.46, goldTint: 0.78, cyanTint: 0.22 });

    for (let i = 0; i < N; i++) {
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.35 + i) * 0.06;
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.cos(t * 0.28 + i) * 0.06;
      pos[i * 3 + 2] = base[i * 3 + 2];
      const c = 0.22 + 0.15 * Math.sin(t * 1.5 + i);
      col[i * 3] = c * 1.1;
      col[i * 3 + 1] = c * 0.85;
      col[i * 3 + 2] = c * 0.65;
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    composer.render();
    stage.composite3D();

    const hudA = smooth(t / 0.6) * smooth((19.8 - t) / 0.4);
    const floatY = Math.sin(t * 1.1) * 3;

    // 左侧：487 / 1000 渗流晶格板
    const sx = 230, sy = 210 + floatY, sw = 500, sh = 550;
    ui.serifText('487', sx + sw / 2 - 36, sy - 20, 52, PAL.goldBright, {
      weight: 600,
      align: 'right',
      alpha: hudA,
      glow: 'rgba(245, 193, 108, 0.5)',
    });
    ui.serifText('/ 1000', sx + sw / 2 - 22, sy - 22, 24, PAL.muted, {
      weight: 400,
      align: 'left',
      alpha: hudA,
    });

    ui.drawPercolationSlab(sx, sy, sw, sh, t, {
      litCount: 487,
      showLatentCyan: false,
      cascadeProg: 0,
      showIntuitionLine: t > 2.0,
      intuitionPct: 0.49,
      alpha: hudA,
      showDepthRuler: true,
    });

    // 右侧：极简动态对比曲线（只有「直觉」与「现实」两条生长线和一个发光问号 ?）
    const cx = 960, cy = 230 + floatY, cw = 700, ch = 480;

    ui.hairline(cx, cy, cx, cy + ch, 'rgba(235, 198, 135, 0.35)', hudA, 1.5);
    ui.hairline(cx, cy + ch, cx + cw, cy + ch, 'rgba(235, 198, 135, 0.35)', hudA, 1.5);

    ui.monoText('100%', cx - 16, cy + 6, 15, PAL.muted, { align: 'right', alpha: hudA });
    ui.monoText('50%', cx - 16, cy + ch * 0.5 + 5, 15, PAL.muted, { align: 'right', alpha: hudA });
    ui.monoText('19%', cx - 16, cy + ch * 0.81 + 5, 15, PAL.coral, { align: 'right', alpha: hudA });
    ui.monoText('0%', cx - 16, cy + ch + 5, 15, PAL.muted, { align: 'right', alpha: hudA });

    // 1. 青色虚线：直觉
    const linProg = smoother((t - 0.6) / 3.5);
    if (linProg > 0.005) {
      const lxEnd = cx + cw * 0.85 * linProg;
      const lyEnd = cy + ch - ch * 0.85 * linProg;
      ui.hairline(cx, cy + ch, lxEnd, lyEnd, PAL.cyan, hudA * 0.82, 2.4, [8, 6]);
      ui.glowDot(lxEnd, lyEnd, 3.8, PAL.cyan, hudA, 14);
      if (linProg > 0.5) {
        ui.serifText('直觉', lxEnd + 16, lyEnd + 6, 24, PAL.cyan, {
          align: 'left',
          alpha: hudA * smooth((linProg - 0.5) / 0.3),
        });
      }
    }

    // 2. 绯红实线：现实 (卡在 19% 平台期)
    const realProg = smoother((t - 4.2) / 6.5);
    if (realProg > 0.005) {
      const maxU = 0.50 * realProg;
      ctx.save();
      ctx.globalAlpha = hudA;
      ctx.strokeStyle = PAL.coral;
      ctx.lineWidth = 3.8 * k;
      ctx.shadowColor = PAL.coral;
      ctx.shadowBlur = 16 * k;
      ctx.beginPath();
      const steps = 60;
      let endPx = cx, endPy = cy + ch;
      for (let i = 0; i <= steps; i++) {
        const u = (i / steps) * maxU;
        const depth = 0.03 + 0.16 * (1 - Math.exp(-u * 11.5));
        const px = cx + u * cw;
        const py = cy + (1 - depth) * ch;
        if (i === 0) ctx.moveTo(px * k, py * k);
        else ctx.lineTo(px * k, py * k);
        endPx = px;
        endPy = py;
      }
      ctx.stroke();
      ctx.restore();

      ui.glowDot(endPx, endPy, 4.8, PAL.coral, hudA, 20);
      if (realProg > 0.6) {
        ui.serifText('现实 (19%)', endPx + 18, endPy + 8, 24, PAL.coral, {
          align: 'left',
          alpha: hudA * smooth((realProg - 0.6) / 0.25),
        });
      }
    }

    // 3. 温暖发光大问号 ?（跟随呼吸上下浮动）
    const doubtA = smooth((t - 13.8) / 0.7) * hudA;
    if (doubtA > 0.005) {
      const qx = cx + cw * 0.50;
      const qy = cy + ch * 0.58 + Math.sin(t * 2.4) * 6;
      ui.hairline(qx, cy + ch * 0.50, qx, cy + ch * 0.81, 'rgba(251, 113, 133, 0.45)', doubtA, 1.8, [5, 5]);
      ui.serifText('?', qx, qy, 88, PAL.goldBright, {
        weight: 600,
        align: 'center',
        alpha: doubtA,
        glow: 'rgba(251, 113, 133, 0.82)',
        glowBlur: 28,
      });
    }
  }

  return { render };
}
