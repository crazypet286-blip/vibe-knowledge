// 场景渲染驱动（本地 HTTP + 本机 Chrome 无头 + FFmpeg 管道，像素不落盘）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PROD = path.resolve(DIR, '..');
const IS_MAC = process.platform === 'darwin';
const FFMPEG = process.env.FFMPEG_BIN || (fs.existsSync('/Users/ookk/OOKKautocut/data/tools/ffmpeg') ? '/Users/ookk/OOKKautocut/data/tools/ffmpeg' : 'ffmpeg');
const FFPROBE = process.env.FFPROBE_BIN || (fs.existsSync('/Users/ookk/OOKKautocut/data/tools/ffprobe') ? '/Users/ookk/OOKKautocut/data/tools/ffprobe' : 'ffprobe');
const CHROME = process.env.CHROME_BIN || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/opt/meta-chromium/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find(p => fs.existsSync(p)) || 'google-chrome';

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const n = argv[i + 1];
  if (n === undefined || n.startsWith('--')) opt[a.slice(2)] = true;
  else { opt[a.slice(2)] = n; i++; }
}
const SCENE = opt.scene;
if (!SCENE) { console.error('需要 --scene，例如 --scene S06'); process.exit(1); }
const H = +(opt.res || 1080), W = Math.round(H * 16 / 9 / 2) * 2, FPS = +(opt.fps || 30);
const MODE = opt.sheet ? 'sheet' : opt.stills ? 'stills' : 'video';
const timelineFile = opt.timeline || 'timeline/timeline.json';
const timeline = JSON.parse(fs.readFileSync(path.resolve(DIR, timelineFile), 'utf8'));
const shotIds = timeline.scenes[SCENE];
if (!shotIds) { console.error('时间轴中没有场景 ' + SCENE); process.exit(1); }
const sceneShots = shotIds.map(id => timeline.shots.find(s => s.id === id));
const sceneDur = sceneShots[sceneShots.length - 1].end - sceneShots[0].start;
const totalFrames = Math.round(sceneDur * FPS);

let frames = null;
if (opt.frames) frames = String(opt.frames).split(',').map(Number);
else if (opt.every) { frames = []; for (let f = 0; f < totalFrames; f += +opt.every) frames.push(f); }

const OUT = MODE === 'video'
  ? path.resolve(opt.out || path.join(PROD, SCENE, `${SCENE}_镜头${shotIds.length > 1 ? shotIds[0] + '-' + shotIds[shotIds.length - 1] : shotIds[0]}_${H}p${FPS}.mp4`))
  : MODE === 'sheet' ? path.resolve(opt.sheet) : path.resolve(opt.stills);
const COLS = +(opt.cols || 6);
const GL = process.env.RENDER_GL || (IS_MAC ? 'gpu' : 'swiftshader');

let peakKiB = 0;
function sampleMem() {
  try {
    const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='], { encoding: 'utf8' }).trim().split('\n').map(s => s.trim().split(/\s+/).map(Number));
    const ids = new Set([process.pid]);
    for (let pass = 0; pass < 10; pass++) for (const [pid, ppid] of rows) if (ids.has(ppid)) ids.add(pid);
    peakKiB = Math.max(peakKiB, rows.filter(r => ids.has(r[0])).reduce((n, r) => n + r[2], 0));
  } catch { }
}

const tmpProfile = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'hiccup-chrome-'));
let chrome, ffmpeg, server, info = null, doneInfo = {};
let gotDone = false, memTimer = null, killTimer = null, stallTimer = null, lastProgress = 0, failDone = null;
const stuck = msg => Object.assign(new Error(msg), { retryable: true });
const RETRY = process.env.RENDER_RETRY === '1';
const STALL_LIMIT = 120;
const perFrame = [], stats = [];
let tStart = 0, tLast = 0, sent = 0;

function startFfmpeg(nIn) {
  const inArgs = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-video_size', `${W}x${H}`, '-framerate', String(FPS), '-i', 'pipe:0'];
  let outArgs;
  if (MODE === 'stills') outArgs = [path.join(OUT, `${SCENE}_f%04d.png`)];
  else if (MODE === 'sheet') {
    const rows = Math.ceil(nIn / COLS);
    outArgs = ['-vf', `tile=${COLS}x${rows}:padding=4:color=0x222c3c`, '-frames:v', '1', OUT];
  } else {
    outArgs = [
      '-threads', '4', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation',
      '-pix_fmt', 'yuv420p', '-g', String(FPS * 2),
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', OUT,
    ];
  }
  return spawn(FFMPEG, [...inArgs, ...outArgs], { stdio: ['pipe', 'ignore', 'inherit'] });
}

const MIME = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const done = new Promise((resolve, reject) => {
  failDone = reject;
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST') {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', async () => {
        const body = Buffer.concat(chunks);
        if (url.pathname === '/info') {
          info = JSON.parse(body);
          lastProgress = performance.now();
          if (!opt.quiet) console.log('WebGL:', info.gpu, '| 帧数', info.frames, '| 场景时长', info.duration.toFixed(2), 's');
          if (info.checks) console.log('几何与文字校验:', JSON.stringify(info.checks));
          tStart = tLast = performance.now();
        } else if (url.pathname === '/frame') {
          if (body.length !== W * H * 4) { reject(new Error('帧尺寸错误 ' + body.length)); res.writeHead(400).end(); return; }
          if (!ffmpeg.stdin.write(body)) await new Promise(r => ffmpeg.stdin.once('drain', r));
          sent++;
          lastProgress = performance.now();
          const now = performance.now();
          perFrame.push((now - tLast) / 1000);
          tLast = now;
          const i = +url.searchParams.get('i');
          stats.push({ i, mean: +url.searchParams.get('mean'), white: +url.searchParams.get('white'), max: +url.searchParams.get('max') });
          if (!opt.quiet && sent % 30 === 0) process.stdout.write(`\r已渲染 ${sent}/${info.frames} 帧`);
        } else if (url.pathname === '/done') {
          gotDone = true;
          try { doneInfo = JSON.parse(body); } catch { }
          resolve();
        } else if (url.pathname === '/error') {
          const m = body.toString();
          reject(/Failed to fetch|NetworkError|ERR_CONNECTION/.test(m) ? stuck('页面送帧请求失败: ' + m.split('\n')[0]) : new Error('页面错误: ' + m));
        }
        res.writeHead(200).end('ok');
      });
      return;
    }
    const f = path.join(DIR, decodeURIComponent(url.pathname));
    if (!f.startsWith(DIR + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(f, (e, b) => {
      if (e) { res.writeHead(404).end(); return; }
      const ext = path.extname(f).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(b);
    });
  });
});

function ffprobe(file) {
  return JSON.parse(execFileSync(FFPROBE, [
    '-v', 'error',
    '-show_entries', 'stream=codec_name,profile,width,height,pix_fmt,color_range,color_space,r_frame_rate,nb_frames,duration,bit_rate:format=duration,size,bit_rate',
    '-count_frames', '-of', 'json', file,
  ], { encoding: 'utf8' }));
}

async function run() {
  if (MODE === 'stills') fs.mkdirSync(OUT, { recursive: true });
  else fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const nIn = frames ? frames.length : totalFrames;
  ffmpeg = startFfmpeg(nIn);
  memTimer = setInterval(sampleMem, 250);
  const q = new URLSearchParams({ scene: SCENE, w: W, h: H, fps: FPS });
  q.set('timeline', timelineFile);
  if (frames) q.set('frames', frames.join(','));
  if (opt.debug || MODE === 'sheet') q.set('debug', '1');
  if (opt.verify) q.set('verify', '1');
  const glFlags = GL === 'swiftshader'
    ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage']
    : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
  const wall0 = performance.now();
  chrome = spawn(CHROME, [
    '--headless=new', `--user-data-dir=${tmpProfile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--mute-audio',
    `--window-size=${W},${H}`, '--force-device-scale-factor=1', ...glFlags, `http://127.0.0.1:${port}/index.html?${q}`,
  ], { stdio: 'ignore' });
  let finished = false;
  chrome.once('exit', (c, sig) => { if (!finished) failDone(stuck(`Chrome 提前退出（code=${c} signal=${sig}）`)); });
  killTimer = setTimeout(() => failDone(stuck('总超时 30 分钟')), 30 * 60 * 1000);
  lastProgress = performance.now();
  stallTimer = setInterval(() => {
    const idle = (performance.now() - lastProgress) / 1000, lim = info ? STALL_LIMIT : 90;
    if (idle > lim) failDone(stuck(info ? `渲染停滞：${lim} 秒内没有新帧（已收 ${sent} 帧）` : `页面 ${lim} 秒内未开始渲染`));
  }, 2000);
  await done;
  finished = true;
  clearInterval(stallTimer);
  const renderLoop = (performance.now() - tStart) / 1000;
  if (MODE === 'sheet') {
    const pad = Math.ceil(nIn / COLS) * COLS - nIn;
    const blank = Buffer.alloc(W * H * 4);
    for (let i = 0; i < pad; i++) ffmpeg.stdin.write(blank);
  }
  ffmpeg.stdin.end();
  const code = await new Promise(r => ffmpeg.on('close', r));
  sampleMem();
  clearInterval(memTimer);
  clearTimeout(killTimer);
  const total = (performance.now() - tStart) / 1000, wall = (performance.now() - wall0) / 1000;
  const chromeExit = new Promise(r => chrome.once('exit', r));
  chrome.kill('SIGTERM');
  await chromeExit;
  server.close();
  if (code !== 0) throw new Error('ffmpeg exit ' + code);

  const flash = stats.filter(s => s.white > 0.2 || s.mean > 150).map(s => s.i);
  const black = stats.filter(s => s.mean < 6).map(s => s.i);
  const peakMean = stats.reduce((m, s) => s.mean > m.mean ? s : m, stats[0]);
  const peakWhite = stats.reduce((m, s) => s.white > m.white ? s : m, stats[0]);
  const lum = {
    frames_checked: stats.length,
    max_mean_luma: peakMean.mean,
    max_mean_frame: peakMean.i,
    max_white_ratio: peakWhite.white,
    max_white_frame: peakWhite.i,
    min_mean_luma: Math.min(...stats.map(s => s.mean)),
    flash_frames: flash,
    black_frames: black,
  };
  if (MODE !== 'video') {
    console.log(`\n${MODE === 'sheet' ? '拼图' : '单帧'}已写入 ${OUT}（${nIn} 帧，${total.toFixed(1)} 秒）`);
    console.log('亮度:', JSON.stringify({ max_mean: lum.max_mean_luma, min_mean: lum.min_mean_luma, flash: flash.length, black: black.length }));
    return;
  }
  const probe = ffprobe(OUT);
  const dec = spawnSync(FFMPEG, ['-v', 'error', '-i', OUT, '-f', 'null', '-'], { encoding: 'utf8' });
  const metrics = {
    scene: SCENE,
    shots: shotIds,
    output: path.relative(PROD, OUT),
    frames: perFrame.length,
    fps: FPS,
    resolution: `${W}x${H}`,
    duration_s: +sceneDur.toFixed(4),
    webgl_renderer: info && info.gpu,
    geometry_checks: info && info.checks,
    captions: doneInfo.captions || null,
    render_loop_seconds: +renderLoop.toFixed(3),
    total_render_encode_seconds: +total.toFixed(3),
    wall_seconds: +wall.toFixed(3),
    peak_process_tree_rss_mib: +(peakKiB / 1024).toFixed(1),
    bytes: fs.statSync(OUT).size,
    decode_errors: dec.stderr.trim() || '无',
    luminance: lum,
    ffprobe: probe,
  };
  const base = OUT.replace(/\.mp4$/, '');
  fs.writeFileSync(base + '_render_metrics.json', JSON.stringify(metrics, null, 2));
  console.log(`\n[完成] ${SCENE} -> ${path.relative(PROD, OUT)} (${perFrame.length}帧, 强闪=${flash.length}, 黑帧=${black.length})`);
}

let failed = false, retryable = false, failMsg = '';
run().catch(e => {
  failed = true;
  retryable = !!(e && e.retryable);
  failMsg = String(e && e.message || e);
  console.error('\n渲染失败（不出片）：' + (e && e.message || e));
  clearInterval(memTimer); clearInterval(stallTimer); clearTimeout(killTimer);
  try { ffmpeg && ffmpeg.kill('SIGKILL'); } catch { }
  try { chrome && chrome.kill('SIGKILL'); } catch { }
  try { server && server.close(); } catch { }
  try { if (MODE === 'video' && fs.existsSync(OUT) && !gotDone) fs.rmSync(OUT); } catch { }
}).finally(() => {
  try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch { }
  if (!failed) return;
  if (retryable && !RETRY) {
    console.error('\n卡住类失败，自动重试一次…');
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: { ...process.env, RENDER_RETRY: '1', RENDER_RETRY_REASON: failMsg },
    });
    if (r.status === 0) process.exit(0);
  }
  process.exit(1);
});
