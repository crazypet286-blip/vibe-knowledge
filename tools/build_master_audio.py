#!/usr/bin/env python3
"""
构建 EP009《临界点：你以为努力是线性的，其实它是渗流》Vibe 知识大赏纯享版音频母带：
- 基底配乐：采用抖音 44.6w 赞《Vibe知识大赏最火的那首BGM》纯净器乐原声（0 TTS 机械配音）
- 物理拟音层（Foley & UI SFX）：帧级同步合成节点点亮微脉冲 (12->487)、19% 平台期低频阻滞音、
  自我怀疑问号泛音、S03 暗网 X 光深海声呐扫描、主标题《渗流相变》鎏金钟声、
  S04 499->500 临界倒计时、第 501 个点双电弧激发与 100% 全局闪电雪崩琶音、
  S05 童年学骑车晚风与三大脑区合龙和弦
- 母带响度：EBU R128 标准化至 -16.0 LUFS (48kHz, Stereo AAC 256kbps)
"""
import glob
import math
import os
import random
import struct
import subprocess
import wave

import shutil
FFMPEG = os.environ.get("FFMPEG_BIN") or ("/Users/ookk/OOKKautocut/data/tools/ffmpeg" if os.path.exists("/Users/ookk/OOKKautocut/data/tools/ffmpeg") else (shutil.which("ffmpeg") or "ffmpeg"))
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
OUT_DIR = os.path.join(BASE_DIR, "06_Audio/Master")
OUT_WAV = os.path.join(OUT_DIR, "sfx_track.wav")
OUT_M4A = os.path.join(OUT_DIR, "master_audio.m4a")
SR = 48000
DURATION = 118.0


def add_tone(buf_l, buf_r, start_s, dur_s, freq, amp=0.16, decay=4.0, pan=0.0, harmonics=(1.0, 0.35, 0.12)):
    i0 = int(start_s * SR)
    n = int(dur_s * SR)
    gl = amp * math.sqrt(0.5 * (1.0 - pan))
    gr = amp * math.sqrt(0.5 * (1.0 + pan))
    for i in range(n):
        idx = i0 + i
        if idx >= len(buf_l):
            break
        t = i / SR
        atk = min(1.0, t / 0.008)
        env = atk * math.exp(-t * decay)
        val = 0.0
        for h_idx, h_amp in enumerate(harmonics, 1):
            val += h_amp * math.sin(2.0 * math.pi * (freq * h_idx) * t)
        buf_l[idx] += val * env * gl
        buf_r[idx] += val * env * gr


def add_sub_drop(buf_l, buf_r, start_s, dur_s=0.9, f0=68.0, f1=26.0, amp=0.30):
    i0 = int(start_s * SR)
    n = int(dur_s * SR)
    phase = 0.0
    for i in range(n):
        idx = i0 + i
        if idx >= len(buf_l):
            break
        t = i / SR
        u = t / dur_s
        freq = f0 * ((f1 / f0) ** u)
        phase += 2.0 * math.pi * freq / SR
        env = min(1.0, t / 0.012) * math.exp(-u * 3.2)
        v = math.sin(phase) * env * amp
        buf_l[idx] += v
        buf_r[idx] += v


def add_breeze_whoosh(buf_l, buf_r, start_s, dur_s=2.4, amp=0.09, pan_start=-0.5, pan_end=0.6):
    i0 = int(start_s * SR)
    n = int(dur_s * SR)
    rng = random.Random(int(start_s * 1000) + 7)
    lp_l, lp_r = 0.0, 0.0
    for i in range(n):
        idx = i0 + i
        if idx >= len(buf_l):
            break
        u = i / n
        env = math.sin(u * math.pi) ** 1.6
        pan = pan_start + (pan_end - pan_start) * u
        white_l = rng.uniform(-1.0, 1.0)
        white_r = rng.uniform(-1.0, 1.0)
        alpha = 0.04 + 0.08 * math.sin(u * math.pi)
        lp_l = (1.0 - alpha) * lp_l + alpha * white_l
        lp_r = (1.0 - alpha) * lp_r + alpha * white_r
        gl = amp * env * math.sqrt(0.5 * (1.0 - pan))
        gr = amp * env * math.sqrt(0.5 * (1.0 + pan))
        buf_l[idx] += lp_l * gl
        buf_r[idx] += lp_r * gr


def add_electric_arc_sfx(buf_l, buf_r, start_s, dur_s=1.2, amp=0.14):
    i0 = int(start_s * SR)
    n = int(dur_s * SR)
    rng = random.Random(int(start_s * 100) + 99)
    for i in range(n):
        idx = i0 + i
        if idx >= len(buf_l):
            break
        t = i / SR
        u = t / dur_s
        env = (math.sin(u * math.pi) ** 0.8) * math.exp(-u * 1.4)
        buzz = math.sin(2 * math.pi * 1280 * t + math.sin(2 * math.pi * 42 * t) * 4.0) * 0.45
        crackle = rng.uniform(-1.0, 1.0) if rng.random() < 0.08 else 0.0
        v = (buzz + crackle * 0.7) * env * amp
        buf_l[idx] += v * 0.95
        buf_r[idx] += v * 1.05


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    total_samples = int(DURATION * SR)
    buf_l = [0.0] * total_samples
    buf_r = [0.0] * total_samples

    # === S01 (0..18s): 12 -> 317 -> 487 节点点亮微脉冲 + 19% 停滞低音 ===
    for idx_t, (ts, fq) in enumerate([
        (1.0, 587.33), (2.4, 659.25), (4.0, 783.99), (5.4, 880.0),
        (7.2, 659.25), (8.4, 987.77), (10.2, 880.0), (11.5, 1046.50)
    ]):
        pan = -0.35 if idx_t % 2 == 0 else 0.35
        add_tone(buf_l, buf_r, ts, 0.45, fq, amp=0.075, decay=8.5, pan=pan)
    # 487/1000 却停在 19% 平台死寂低频 (t=14.6s)
    add_sub_drop(buf_l, buf_r, 14.6, dur_s=1.0, f0=64.0, f1=28.0, amp=0.25)

    # === S02 (18..38s): 线性预期 vs 19% 平台断崖 + 灵魂问号共鸣 ===
    add_tone(buf_l, buf_r, 19.2, 1.2, 659.25, amp=0.09, decay=3.5, pan=0.2)
    add_sub_drop(buf_l, buf_r, 25.0, dur_s=0.9, f0=66.0, f1=30.0, amp=0.24)
    add_sub_drop(buf_l, buf_r, 29.9, dur_s=1.1, f0=60.0, f1=25.0, amp=0.27)
    # “是不是我根本不是这块料？” 温暖问号泛音和弦 (t=33.9s)
    for f, p in [(440.0, -0.25), (523.25, 0.0), (659.25, 0.25), (880.0, 0.1)]:
        add_tone(buf_l, buf_r, 33.9, 2.8, f, amp=0.07, decay=1.6, pan=p)

    # === S03 (38..56s): 暗处潜伏簇 X 光声呐透视 + 《渗流相变》大标题恢弘金钟 ===
    add_breeze_whoosh(buf_l, buf_r, 41.2, dur_s=3.6, amp=0.11, pan_start=-0.5, pan_end=0.5)
    for i, fq in enumerate([523.25, 659.25, 783.99, 987.77, 1174.66, 1318.51]):
        add_tone(buf_l, buf_r, 42.0 + i * 0.42, 1.3, fq, amp=0.075, decay=3.2, pan=(i - 2.5) * 0.18)
    # 主标题《渗流相变》落版金钟 (t=50.2s)
    add_sub_drop(buf_l, buf_r, 50.2, dur_s=1.4, f0=56.0, f1=30.0, amp=0.26)
    for f in (261.63, 392.00, 523.25, 659.25, 1046.50):
        add_tone(buf_l, buf_r, 50.2, 3.6, f, amp=0.075, decay=1.2)

    # === S04 (56..88s): 450/1000 放弃线 -> 499..500 倒计时 -> 第 501 个点亮了！全局闪电雪崩 ===
    add_sub_drop(buf_l, buf_r, 56.8, dur_s=0.8, f0=70.0, f1=34.0, amp=0.22)  # 450/1000 遗憾停步
    # 499 -> 500 临界倒计时清脆脉冲 (t=65.0s, 66.6s)
    add_tone(buf_l, buf_r, 65.0, 0.6, 880.00, amp=0.11, decay=6.0, pan=-0.2)
    add_tone(buf_l, buf_r, 66.6, 0.6, 987.77, amp=0.12, decay=6.0, pan=0.2)

    # 第 501 个点亮了！(t=68.2s, S04 local t=12.2s) —— 双电弧激发 + 16 音阶金色雪崩贯通琶音！
    add_sub_drop(buf_l, buf_r, 68.2, dur_s=1.5, f0=62.0, f1=26.0, amp=0.30)
    add_electric_arc_sfx(buf_l, buf_r, 68.2, dur_s=1.8, amp=0.15)
    cascade_notes = [
        523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51,
        1567.98, 1760.00, 2093.00, 2349.32, 2637.02, 2093.00, 1567.98, 1046.50
    ]
    for i, fq in enumerate(cascade_notes):
        t_n = 68.25 + i * 0.17
        pan = math.sin(i * 0.6) * 0.45
        add_tone(buf_l, buf_r, t_n, 1.2, fq, amp=0.085, decay=3.4, pan=pan)

    # 100% 触底贯通共鸣和弦 (t=71.2s)
    for f in (523.25, 659.25, 783.99, 1046.50, 1567.98):
        add_tone(buf_l, buf_r, 71.2, 3.2, f, amp=0.08, decay=1.4)

    # 右侧阶跃曲线垂直跃升点亮音 (t=74.8s)
    add_tone(buf_l, buf_r, 74.8, 2.0, 1318.51, amp=0.11, decay=2.2, pan=0.35)

    # === S05 (88..108s): 童年学骑车晚风 + 第四天傍晚三大脑区突然合龙 ===
    add_breeze_whoosh(buf_l, buf_r, 88.6, dur_s=3.2, amp=0.10, pan_start=-0.5, pan_end=0.5)
    add_sub_drop(buf_l, buf_r, 93.2, dur_s=0.6, f0=65.0, f1=36.0, amp=0.18)
    # 第四天傍晚：眼睛、手脚和平衡感突然接通！(t=97.3s, S05 local t=9.3s)
    add_electric_arc_sfx(buf_l, buf_r, 97.3, dur_s=1.1, amp=0.11)
    for f in (440.0, 554.37, 659.25, 880.0, 1108.73, 1318.51):
        add_tone(buf_l, buf_r, 97.4, 3.8, f, amp=0.07, decay=1.2)
    add_breeze_whoosh(buf_l, buf_r, 102.5, dur_s=3.5, amp=0.10, pan_start=-0.4, pan_end=0.6)

    # === S06 (108..118s): “快要走到第 501 个点了” 终章温暖金钟 ===
    add_tone(buf_l, buf_r, 113.3, 4.2, 523.25, amp=0.12, decay=1.0, pan=0.0)
    add_tone(buf_l, buf_r, 113.3, 4.2, 783.99, amp=0.08, decay=1.2, pan=0.1)

    with wave.open(OUT_WAV, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        frames = bytearray()
        for l, r in zip(buf_l, buf_r):
            sl = max(-32767, min(32767, int(l * 32767)))
            sr = max(-32767, min(32767, int(r * 32767)))
            frames += struct.pack("<hh", sl, sr)
        wf.writeframes(frames)

    bgm_matches = glob.glob(os.path.join(BASE_DIR, "assets/bgm/*.mp3"))
    if not bgm_matches:
        bgm_matches = glob.glob("/Users/ookk/视频工作流/TikTokDownloader/Volume/Download/*BGM*.mp3")
    bgm_path = bgm_matches[0]
    print("Using viral BGM:", os.path.basename(bgm_path))

    filter_complex = (
        f"[0:a]atrim=0:{DURATION},asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d=1.2,afade=t=out:st={DURATION-3.5}:d=3.5,volume=0.88[bgm];"
        f"[1:a]volume=1.15[sfx];"
        f"[bgm][sfx]amix=inputs=2:duration=first:dropout_transition=0,"
        f"loudnorm=I=-16.0:TP=-1.5:LRA=7.0[outa]"
    )
    cmd = [
        FFMPEG, "-y", "-loglevel", "error",
        "-i", bgm_path,
        "-i", OUT_WAV,
        "-filter_complex", filter_complex,
        "-map", "[outa]",
        "-ar", "48000", "-ac", "2",
        "-c:a", "aac", "-b:a", "256k",
        OUT_M4A,
    ]
    subprocess.run(cmd, check=True)
    print("Master audio generated:", OUT_M4A, f"({os.path.getsize(OUT_M4A)/1024:.1f} KB)")


if __name__ == "__main__":
    main()
