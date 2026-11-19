// S05 (01:28 - 01:48): 情绪暴击与生命升华 — 眼睛、平衡、手脚三大 3D 星团动态合龙与星光大道（极简三字标签）
import * as THREE from 'three';
import { clamp, smooth, smoother, lerp, rng, PAL } from '../lib/core.js';

export default async function (stage) {
  const { W, H, k, VW, ctx, ui } = stage;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  camera.position.set(0, 0.05, 7.6);

  const { composer } = stage.makeComposer(scene, camera, { strength: 0.54, radius: 0.45, threshold: 0.26 });

  const N = 3400;
  const r = rng(9005);
  const home = new Float32Array(N * 3);
  const clusterId = new Uint8Array(N);
  const phase = new Float32Array(N);

  const centers = [
    [-1.45, 0.55, 0.0], // 0: 眼睛
    [0.0, 1.28, 0.15],  // 1: 平衡
    [1.45, 0.55, 0.0],  // 2: 手脚
  ];

  for (let i = 0; i < N; i++) {
    phase[i] = r();
    if (i < 2350) {
      const cid = i % 3;
      clusterId[i] = cid;
      const [cx, cy, cz] = centers[cid];
      const theta = r() * Math.PI * 2;
      const phi = Math.acos(2 * r() - 1);
      const rad = 0.62 * Math.pow(r(), 0.42);
      home[i * 3] = cx + rad * Math.sin(phi) * Math.cos(theta);
      home[i * 3 + 1] = cy + rad * Math.cos(phi) * 0.85;
      home[i * 3 + 2] = cz + rad * Math.sin(phi) * Math.sin(theta);
    } else {
      clusterId[i] = 3;
      const u = r();
      const spread = lerp(0.18, 3.8, u);
      home[i * 3] = (r() - 0.5) * spread * 2.3;
      home[i * 3 + 1] = lerp(-0.35, -1.85, u) + (r() - 0.5) * 0.08;
      home[i * 3 + 2] = lerp(-1.5, 1.8, u);
    }
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
    size: 0.046,
    map: new THREE.CanvasTexture(spriteCanvas),
    vertexColors: true,
    transparent: true,
    opacity: 0.70,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(geom, mat));

  function render(t) {
    const connectProg = smoother((t - 9.2) / 2.2);
    const wobble = (1 - connectProg) * Math.sin(t * 5.2) * 0.15;

    ui.drawVibeBackdrop(t + 88, {
      cx: 0.5,
      cy: 0.44,
      goldTint: lerp(0.75, 1.15, connectProg),
      cyanTint: lerp(0.55, 0.25, connectProg),
    });

    for (let i = 0; i < N; i++) {
      const cid = clusterId[i];
      const hx = home[i * 3], hy = home[i * 3 + 1], hz = home[i * 3 + 2];
      const p = phase[i];

      if (cid < 3) {
        const pull = connectProg * 0.18;
        const cx = centers[cid][0], cy = centers[cid][1];
        const jx = (1 - connectProg) * Math.sin(t * 3.8 + cid * 2.1) * 0.09;
        const jy = (1 - connectProg) * Math.cos(t * 4.2 + cid * 1.7) * 0.08;

        pos[i * 3] = lerp(hx, hx - cx * pull, 1) + jx + wobble * (cid === 1 ? 1.2 : -0.6);
        pos[i * 3 + 1] = lerp(hy, hy - (cy - 0.8) * pull, 1) + jy;
        pos[i * 3 + 2] = hz + Math.sin(t * 1.6 + p * 10) * 0.06;

        const pulse = 0.65 + 0.35 * Math.sin(t * 2.6 + p * 12);
        const isGold = connectProg > p * 0.85;
        if (isGold) {
          col[i * 3] = 0.98 * pulse;
          col[i * 3 + 1] = 0.76 * pulse;
          col[i * 3 + 2] = 0.38 * pulse;
        } else {
          col[i * 3] = (cid === 1 ? 0.85 : 0.38) * pulse * 0.75;
          col[i * 3 + 1] = (cid === 1 ? 0.45 : 0.86) * pulse * 0.75;
          col[i * 3 + 2] = (cid === 1 ? 0.52 : 0.96) * pulse * 0.75;
        }
      } else {
        const flow = (p + t * (0.05 + connectProg * 0.14)) % 1;
        const spread = lerp(0.16, 4.0, flow);
        pos[i * 3] = (hx / 3.6) * spread + (1 - connectProg) * Math.sin(flow * 10 + t * 4) * 0.20;
        pos[i * 3 + 1] = lerp(-0.28, -1.85, flow);
        pos[i * 3 + 2] = lerp(-1.4, 1.6, flow);

        const roadA = Math.sin(flow * Math.PI) * (0.30 + 0.65 * connectProg);
        col[i * 3] = 0.95 * roadA;
        col[i * 3 + 1] = 0.74 * roadA;
        col[i * 3 + 2] = 0.38 * roadA;
      }
    }

    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    composer.render();
    stage.composite3D();

    const hudA = smooth(t / 0.7) * smooth((19.8 - t) / 0.4);

    const pLeft = [585 + wobble * 120, 415];
    const pTop = [960 + wobble * 180, 245];
    const pRight = [1335 - wobble * 120, 415];
    const pHub = [960, 385];

    if (connectProg < 0.95) {
      const disA = (1 - connectProg) * hudA;
      ui.hairline(pLeft[0], pLeft[1], pTop[0], pTop[1], 'rgba(251, 113, 133, 0.35)', disA, 1.5, [6, 6]);
      ui.hairline(pTop[0], pTop[1], pRight[0], pRight[1], 'rgba(251, 113, 133, 0.35)', disA, 1.5, [6, 6]);
      ui.hairline(pLeft[0], pLeft[1], pRight[0], pRight[1], 'rgba(251, 113, 133, 0.35)', disA, 1.5, [6, 6]);
    }

    if (connectProg > 0.02) {
      const conA = connectProg * hudA;
      ui.drawElectricArc(pLeft[0], pLeft[1], pTop[0], pTop[1], t, { color: PAL.goldBright, alpha: conA, amp: 12, seed: 1 });
      ui.drawElectricArc(pTop[0], pTop[1], pRight[0], pRight[1], t, { color: PAL.goldBright, alpha: conA, amp: 12, seed: 2 });
      ui.drawElectricArc(pLeft[0], pLeft[1], pRight[0], pRight[1], t, { color: PAL.gold, alpha: conA * 0.85, amp: 10, seed: 3 });

      ui.hairline(pLeft[0], pLeft[1], pHub[0], pHub[1], PAL.goldBright, conA * 0.8, 2.2);
      ui.hairline(pTop[0], pTop[1], pHub[0], pHub[1], PAL.goldBright, conA * 0.8, 2.2);
      ui.hairline(pRight[0], pRight[1], pHub[0], pHub[1], PAL.goldBright, conA * 0.8, 2.2);
      ui.glowDot(pHub[0], pHub[1], 6.0, PAL.goldBright, conA, 34);
    }

    // 极简两字标签（对标《渗流相变》原片：眼睛、平衡、手脚）
    const nodeCol = connectProg > 0.5 ? PAL.goldBright : PAL.cyan;
    ui.glowDot(pLeft[0], pLeft[1], 4.8, nodeCol, hudA, 22);
    ui.serifText('眼睛', pLeft[0] - 32, pLeft[1] + 8, 28, PAL.ink, { align: 'right', alpha: hudA });

    ui.glowDot(pTop[0], pTop[1], 5.0, connectProg > 0.5 ? PAL.goldBright : PAL.coral, hudA, 24);
    ui.serifText('平衡', pTop[0], pTop[1] - 32, 28, PAL.ink, { align: 'center', alpha: hudA });

    ui.glowDot(pRight[0], pRight[1], 4.8, nodeCol, hudA, 22);
    ui.serifText('手脚', pRight[0] + 32, pRight[1] + 8, 28, PAL.ink, { align: 'left', alpha: hudA });

    // 地平线动态骑行轨迹波（前三天摇晃失衡 -> 第四天化作笔直金色地平线）
    const roadY = 635;
    ctx.save();
    ctx.globalAlpha = hudA;
    ctx.strokeStyle = connectProg > 0.5 ? PAL.goldBright : PAL.coral;
    ctx.lineWidth = (2.8 + connectProg * 1.4) * k;
    ctx.shadowColor = connectProg > 0.5 ? PAL.gold : PAL.coral;
    ctx.shadowBlur = 18 * k;
    ctx.beginPath();
    const rSteps = 90;
    for (let i = 0; i <= rSteps; i++) {
      const u = i / rSteps;
      const rx = 200 + u * 1520;
      const shake = (1 - connectProg) * Math.sin(u * 26 + t * 6.5) * (14 + 28 * Math.sin(u * Math.PI));
      const ry = roadY + shake;
      if (i === 0) ctx.moveTo(rx * k, ry * k);
      else ctx.lineTo(rx * k, ry * k);
    }
    ctx.stroke();
    ctx.restore();
  }

  return { render };
}
