// S06 (01:48 - 01:58): 余韵收尾 — 100% 贯通鎏金晶格动态呼吸 + 极简互动问句（无英文、无长文字）
import * as THREE from 'three';
import { clamp, smooth, smoother, lerp, rng, PAL, getPercolationNetwork } from '../lib/core.js';

export default async function (stage) {
  const { W, H, k, VW, ctx, ui } = stage;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  camera.position.set(0, 0, 7.4);

  const { composer } = stage.makeComposer(scene, camera, { strength: 0.5, radius: 0.45, threshold: 0.25 });

  const N = 1600;
  const r = rng(9006);
  const base = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = r() * Math.PI * 2;
    const rad = 0.6 + r() * 3.8;
    base[i * 3] = Math.cos(a) * rad * 1.4;
    base[i * 3 + 1] = Math.sin(a) * rad * 0.9;
    base[i * 3 + 2] = (r() - 0.5) * 2.0;
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

  const net = getPercolationNetwork();

  function render(t) {
    const fadeOut = smooth((9.85 - t) / 0.55);
    const hudA = smooth(t / 0.7) * fadeOut;
    const floatY = Math.sin(t * 1.2) * 4;

    ui.drawVibeBackdrop(t + 108, { cx: 0.5, cy: 0.46, goldTint: 1.0, cyanTint: 0.2 });

    for (let i = 0; i < N; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const rot = t * 0.05;
      pos[i * 3] = bx * Math.cos(rot) - by * Math.sin(rot);
      pos[i * 3 + 1] = bx * Math.sin(rot) + by * Math.cos(rot);
      pos[i * 3 + 2] = bz;

      const pulse = (0.45 + 0.45 * Math.sin(t * 1.8 + i)) * fadeOut;
      col[i * 3] = 0.96 * pulse;
      col[i * 3 + 1] = 0.75 * pulse;
      col[i * 3 + 2] = 0.38 * pulse;
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    composer.render();
    stage.composite3D();

    // 居中动态呼吸的 100% 贯通鎏金渗流晶格图腾
    const sx = 720, sy = 230 + floatY, sw = 480, sh = 480;
    ui.serifText('501 / 1000', VW / 2, sy - 26, 46, PAL.goldBright, {
      weight: 600,
      align: 'center',
      alpha: hudA,
      glow: 'rgba(245, 193, 108, 0.55)',
    });

    ui.drawPercolationSlab(sx, sy, sw, sh, t, {
      litCount: 501,
      showLatentCyan: true,
      latentAlpha: 1,
      cascadeProg: 1.0,
      showIntuitionLine: false,
      highlightBridge: true,
      alpha: hudA * 0.95,
      showDepthRuler: true,
    });

    // 主干道持续流动的金色能量光球
    const flowU = (t * 0.45) % 1;
    const idx = Math.min(net.masterPathIds.length - 1, Math.floor(flowU * net.masterPathIds.length));
    const pNode = net.nodes[net.masterPathIds[idx]];
    ui.glowDot(sx + pNode.u * sw, sy + pNode.v * sh, 5.5, PAL.goldBright, hudA, 28);
  }

  return { render };
}
