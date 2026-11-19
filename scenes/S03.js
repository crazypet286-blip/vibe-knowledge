// S03 (00:38 - 00:56): 核心主角登场 — 切入暗处 X 光透视：点亮 348 颗冰青色潜伏暗网 + 《渗流相变》大标题
import * as THREE from 'three';
import { clamp, smooth, smoother, lerp, rng, PAL } from '../lib/core.js';

export default async function (stage) {
  const { W, H, k, VW, ctx, ui } = stage;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  const { composer } = stage.makeComposer(scene, camera, { strength: 0.55, radius: 0.45, threshold: 0.25 });

  const N = 1800;
  const r = rng(9003);
  const pAngle = new Float32Array(N);
  const pRad = new Float32Array(N);
  const pY = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pAngle[i] = r() * Math.PI * 2;
    pRad[i] = 1.2 + r() * 3.2;
    pY[i] = (r() - 0.5) * 3.6;
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
    opacity: 0.62,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(geom, mat));

  function render(t) {
    const xrayProg = smoother((t - 3.2) / 3.8);
    const titlePhase = smoother((t - 12.0) / 2.2);

    ui.drawVibeBackdrop(t + 38, {
      cx: 0.5,
      cy: lerp(0.48, 0.38, titlePhase),
      goldTint: lerp(0.75, 1.0, titlePhase),
      cyanTint: lerp(0.2, 0.75, xrayProg) * (1 - titlePhase * 0.4),
    });

    for (let i = 0; i < N; i++) {
      const a = pAngle[i] + t * 0.09;
      const rad = pRad[i];
      pos[i * 3] = Math.cos(a) * rad;
      pos[i * 3 + 1] = pY[i] + Math.sin(t * 0.55 + i) * 0.08;
      pos[i * 3 + 2] = Math.sin(a) * rad * 0.5;

      const isCyan = (i % 2 === 0) && xrayProg > 0.1;
      const fade = 0.35 + 0.35 * Math.sin(t * 1.8 + i);
      col[i * 3] = (isCyan ? 0.35 : 0.95) * fade;
      col[i * 3 + 1] = (isCyan ? 0.88 : 0.74) * fade;
      col[i * 3 + 2] = (isCyan ? 0.98 : 0.38) * fade;
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    composer.render();
    stage.composite3D();

    const hudA = smooth(t / 0.6) * smooth((17.8 - t) / 0.4);
    const floatY = Math.sin(t * 1.1) * 4;

    const sw = lerp(580, 340, titlePhase);
    const sh = lerp(570, 320, titlePhase);
    const sx = (VW - sw) / 2;
    const sy = lerp(205, 145, titlePhase) + floatY;

    if (titlePhase < 0.85) {
      const topCounterA = hudA * (1 - titlePhase * 1.15);
      ui.serifText('487', VW / 2 - 36, sy - 20, 54, PAL.goldBright, {
        weight: 600,
        align: 'right',
        alpha: topCounterA,
      });
      ui.serifText('/ 1000', VW / 2 - 20, sy - 22, 24, PAL.muted, {
        weight: 400,
        align: 'left',
        alpha: topCounterA,
      });
    }

    ui.drawPercolationSlab(sx, sy, sw, sh, t, {
      litCount: 487,
      showLatentCyan: true,
      latentAlpha: xrayProg,
      cascadeProg: 0,
      showIntuitionLine: false,
      highlightBridge: xrayProg > 0.75,
      alpha: hudA,
      showDepthRuler: titlePhase < 0.5,
    });

    // 动态 X 光扫描光束 (t = 3.0 .. 7.4s)
    if (t >= 3.0 && t <= 7.4) {
      const scanU = clamp((t - 3.2) / 3.6);
      const scanY = sy + scanU * sh;
      const scanA = Math.sin(scanU * Math.PI);
      ui.hairline(sx - 24, scanY, sx + sw + 24, scanY, PAL.cyanBright, scanA * 0.92, 2.8);
    }

    // 极简两处短签（表层 19% vs 暗处 348 点）
    const calloutA = smooth((t - 5.2) / 0.7) * (1 - smooth((t - 11.5) / 0.6)) * hudA;
    if (calloutA > 0.005) {
      ui.serifText('暗处已连通：348 点', sx + sw + 34, sy + sh * 0.58, 28, PAL.cyan, {
        align: 'left',
        alpha: calloutA,
        glow: 'rgba(103, 232, 249, 0.45)',
      });
    }

    // 主标题落版：《渗流相变》 (纯中文大字，无英文行)
    if (titlePhase > 0.01) {
      const ta = titlePhase * hudA;
      const ty = 590 + (1 - titlePhase) * 24;

      ui.serifText('渗 流 相 变', VW / 2, ty + 28, 86, PAL.goldBright, {
        weight: 600,
        align: 'center',
        alpha: ta,
        spacing: 16,
        glow: 'rgba(245, 193, 108, 0.72)',
        glowBlur: 30,
      });

      const lineW = 460 * titlePhase;
      ui.hairline(VW / 2 - lineW / 2, ty + 64, VW / 2 + lineW / 2, ty + 64, PAL.gold, ta * 0.55, 1.4);
    }
  }

  return { render };
}
