// S04 (00:56 - 01:28): 硬核仿真高潮 — 450/1000 -> 499..500 -> 第 501 个点亮了！金色闪电瞬间贯穿全场 (19% -> 100%)
import * as THREE from 'three';
import { clamp, smooth, smoother, lerp, rng, PAL, getPercolationNetwork } from '../lib/core.js';

export default async function (stage) {
  const { W, H, k, VW, ctx, ui } = stage;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  const { composer } = stage.makeComposer(scene, camera, { strength: 0.52, radius: 0.45, threshold: 0.28 });

  const N = 1800;
  const r = rng(9004);
  const pAngle = new Float32Array(N);
  const pRad = new Float32Array(N);
  const pSpeed = new Float32Array(N);
  const pPhase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pAngle[i] = r() * Math.PI * 2;
    pRad[i] = 0.9 + r() * 2.8;
    pSpeed[i] = 0.25 + r() * 0.65;
    pPhase[i] = r();
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
    size: 0.045,
    map: new THREE.CanvasTexture(spriteCanvas),
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(geom, mat));

  const net = getPercolationNetwork();

  function render(t) {
    let litCount = 450;
    if (t < 7.8) {
      litCount = 450;
    } else if (t < 9.4) {
      litCount = Math.round(lerp(450, 499, smoother((t - 7.8) / 1.6)));
    } else if (t < 10.6) {
      litCount = 499;
    } else if (t < 12.2) {
      litCount = 500;
    } else if (t < 20.0) {
      litCount = 501;
    } else {
      litCount = Math.round(lerp(501, 548, smoother((t - 20.0) / 10.0)));
    }

    const cascadeProg = clamp((t - 12.25) / 3.2, 0, 1);
    const isPercolated = t >= 12.2;
    const splitLayout = smoother((t - 16.5) / 1.8);

    ui.drawVibeBackdrop(t + 56, {
      cx: lerp(0.5, 0.36, splitLayout),
      cy: 0.48,
      goldTint: lerp(0.8, 1.15, smoother(cascadeProg)),
      cyanTint: lerp(0.55, 0.15, smoother(cascadeProg)),
    });

    const streamSpeed = 1 + smoother(cascadeProg) * 3.0;
    for (let i = 0; i < N; i++) {
      const u = (pPhase[i] + t * 0.06 * pSpeed[i] * streamSpeed) % 1;
      const a = pAngle[i] + t * 0.1;
      const rad = lerp(1.0, 3.1, u);
      pos[i * 3] = Math.cos(a) * rad;
      pos[i * 3 + 1] = Math.sin(a) * rad + (u - 0.5) * 0.8;
      pos[i * 3 + 2] = (u - 0.5) * 1.2;

      const fade = Math.sin(u * Math.PI) * 0.75;
      const isGold = isPercolated || (i % 3 === 0);
      col[i * 3] = (isGold ? 0.95 : 0.38) * fade;
      col[i * 3 + 1] = (isGold ? 0.74 : 0.88) * fade;
      col[i * 3 + 2] = (isGold ? 0.36 : 0.98) * fade;
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    composer.render();
    stage.composite3D();

    const hudA = smooth(t / 0.6) * smooth((31.8 - t) / 0.4);
    const floatY = Math.sin(t * 1.1) * 3.5;

    // 主渗流晶格板：居中 -> 贯通后左移
    const sw = lerp(580, 500, splitLayout);
    const sh = lerp(570, 540, splitLayout);
    const sx = lerp((VW - sw) / 2, 230, splitLayout);
    const sy = lerp(205, 220, splitLayout) + floatY;

    // 晶格上方极简大号数字计数器
    const countCol = isPercolated ? PAL.goldBright : litCount === 450 ? PAL.coral : PAL.cyanBright;
    ui.serifText(`${litCount}`, sx + sw / 2 - 36, sy - 20, 58, countCol, {
      weight: 600,
      align: 'right',
      alpha: hudA,
      glow: countCol,
      glowBlur: 18,
    });
    ui.serifText('/ 1000', sx + sw / 2 - 20, sy - 22, 26, PAL.muted, {
      weight: 400,
      align: 'left',
      alpha: hudA,
    });

    ui.drawPercolationSlab(sx, sy, sw, sh, t, {
      litCount,
      showLatentCyan: true,
      latentAlpha: 0.92,
      cascadeProg,
      showIntuitionLine: false,
      highlightBridge: true,
      alpha: hudA,
      showDepthRuler: true,
    });

    const bNode = net.nodes[net.bridgeIdx];
    const bx = sx + bNode.u * sw;
    const by = sy + bNode.v * sh;

    // 第 501 个点亮了！双电弧激发 + 激波环 (t = 12.2 .. 17.5s)
    if (t >= 12.2 && t <= 17.5) {
      const dt = t - 12.2;
      const shockU = clamp(dt / 1.4, 0, 1);
      if (shockU < 1) {
        ctx.save();
        ctx.globalAlpha = (1 - shockU) * 0.85 * hudA;
        ctx.strokeStyle = PAL.goldBright;
        ctx.lineWidth = (3.8 * (1 - shockU) + 1) * k;
        ctx.beginPath();
        ctx.arc(bx * k, by * k, (14 + shockU * 160) * k, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const arcA = smooth(dt / 0.2) * (1 - smooth((t - 16.2) / 0.8)) * hudA;
      if (arcA > 0.01) {
        ui.drawElectricArc(bx, sy + 8, bx, by, t, { color: PAL.goldBright, alpha: arcA, amp: 13, seed: 7 });
        ui.drawElectricArc(bx, by, bx, sy + sh * clamp(0.25 + cascadeProg * 0.75, 0.25, 0.98), t, {
          color: PAL.gold,
          alpha: arcA,
          amp: 16,
          seed: 13,
        });
      }
    }

    // 贯通后持续向下流淌的脉冲光球（保持画面动态感）
    if (cascadeProg >= 0.98) {
      const flowU = ((t * 0.55) % 1);
      const idx = Math.min(net.masterPathIds.length - 1, Math.floor(flowU * net.masterPathIds.length));
      const pNode = net.nodes[net.masterPathIds[idx]];
      ui.glowDot(sx + pNode.u * sw, sy + pNode.v * sh, 5.5, PAL.goldBright, hudA, 28);
    }

    // 右侧：极简「50% 门槛阶跃曲线」 (t >= 16.5s)
    if (splitLayout > 0.01) {
      const sideA = splitLayout * hudA;
      const gx = 980, gy = 235 + floatY, gw = 680, gh = 470;

      ui.hairline(gx, gy, gx, gy + gh, 'rgba(235, 198, 135, 0.35)', sideA, 1.5);
      ui.hairline(gx, gy + gh, gx + gw, gy + gh, 'rgba(235, 198, 135, 0.35)', sideA, 1.5);

      ui.monoText('100%', gx - 16, gy + 6, 15, PAL.gold, { align: 'right', alpha: sideA });
      ui.monoText('19%', gx - 16, gy + gh * 0.81 + 5, 15, PAL.coral, { align: 'right', alpha: sideA });
      ui.monoText('0%', gx - 16, gy + gh + 5, 15, PAL.muted, { align: 'right', alpha: sideA });

      ui.monoText('0%', gx, gy + gh + 32, 15, PAL.muted, { align: 'center', alpha: sideA });
      ui.monoText('50%', gx + gw * 0.5, gy + gh + 32, 16, PAL.goldBright, { align: 'center', alpha: sideA });
      ui.monoText('100%', gx + gw, gy + gh + 32, 15, PAL.muted, { align: 'right', alpha: sideA });

      // 青色直觉虚线
      ui.hairline(gx, gy + gh, gx + gw, gy, 'rgba(103, 232, 249, 0.42)', sideA, 1.8, [7, 6]);
      ui.serifText('直觉', gx + gw - 16, gy + 86, 22, PAL.cyan, { align: 'right', alpha: sideA * 0.85 });

      const critX = gx + gw * 0.5;
      ui.hairline(critX, gy, critX, gy + gh, 'rgba(245, 193, 108, 0.32)', sideA, 1.4, [5, 5]);

      // 金色阶跃相变实线
      const plotU = clamp((t - 16.8) / 4.2, 0, 1);
      ctx.save();
      ctx.globalAlpha = sideA;
      ctx.strokeStyle = PAL.goldBright;
      ctx.lineWidth = 4.0 * k;
      ctx.shadowColor = PAL.gold;
      ctx.shadowBlur = 18 * k;
      ctx.beginPath();

      const pts = [
        [0.0, 0.0],
        [0.12, 0.04],
        [0.25, 0.11],
        [0.35, 0.16],
        [0.45, 0.19],
        [0.498, 0.21],
        [0.501, 1.0],
        [1.0, 1.0],
      ];

      let lastX = gx, lastY = gy + gh;
      ctx.moveTo(lastX * k, lastY * k);
      for (let i = 1; i < pts.length; i++) {
        const [u0, v0] = pts[i - 1];
        const [u1, v1] = pts[i];
        if (plotU <= u0) break;
        const segU = clamp((plotU - u0) / (u1 - u0 || 0.001), 0, 1);
        const curU = lerp(u0, u1, segU);
        const curV = lerp(v0, v1, segU);
        lastX = gx + curU * gw;
        lastY = gy + (1 - curV) * gh;
        ctx.lineTo(lastX * k, lastY * k);
      }
      ctx.stroke();
      ctx.restore();

      ui.glowDot(lastX, lastY, 5.2, PAL.goldBright, sideA, 24);

      if (plotU > 0.52) {
        const tagA = smooth((plotU - 0.52) / 0.2) * sideA;
        ui.serifText('第 501 点', critX + 20, gy + 44, 28, PAL.goldBright, {
          align: 'left',
          alpha: tagA,
          glow: 'rgba(245, 193, 108, 0.6)',
        });
      }
    }
  }

  return { render };
}
