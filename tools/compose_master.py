#!/usr/bin/env python3
"""
合成 EP009《临界点：你以为努力是线性的，其实它是渗流》1080p30 终版成片、SRT 字幕、全片抽帧总览图与质检报告
"""
import json
import os
import re
import subprocess

import shutil
FFMPEG = os.environ.get("FFMPEG_BIN") or ("/Users/ookk/OOKKautocut/data/tools/ffmpeg" if os.path.exists("/Users/ookk/OOKKautocut/data/tools/ffmpeg") else (shutil.which("ffmpeg") or "ffmpeg"))
FFPROBE = os.environ.get("FFPROBE_BIN") or ("/Users/ookk/OOKKautocut/data/tools/ffprobe" if os.path.exists("/Users/ookk/OOKKautocut/data/tools/ffprobe") else (shutil.which("ffprobe") or "ffprobe"))
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
PROD = os.path.join(BASE, "05_Production")
ENGINE = os.path.join(PROD, "engine")
AUDIO = os.path.join(BASE, "06_Audio/Master/master_audio.m4a")
OUT_DIR = os.path.join(BASE, "07_Output")
OUT_MP4 = os.path.join(OUT_DIR, "临界点_你以为努力是线性的其实它是渗流_1080p30_Vibe纯享版.mp4")
OUT_SRT = os.path.join(OUT_DIR, "临界点_你以为努力是线性的其实它是渗流_1080p30_Vibe纯享版.srt")
OUT_SHEET = os.path.join(OUT_DIR, "全片抽帧总览.jpg")
OUT_QC = os.path.join(OUT_DIR, "全片质检报告.json")


def fmt_srt_time(sec):
    ms = int(round((sec - int(sec)) * 1000))
    s = int(sec) % 60
    m = (int(sec) // 60) % 60
    h = int(sec) // 3600
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def strip_tags(s):
    return re.sub(r"\[(?:gold|cyan|coral):([^\]]+)\]", r"\1", s)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(ENGINE, "timeline/timeline.json"), "r", encoding="utf-8") as f:
        tl = json.load(f)

    # 1. 生成纯中文 SRT 字幕文件（无英文副行）
    srt_lines = []
    for idx, cue in enumerate(tl["subtitles"], 1):
        t0 = fmt_srt_time(cue["start"])
        t1 = fmt_srt_time(cue["displayEnd"])
        cn = strip_tags(cue["text"])
        srt_lines.append(f"{idx}\n{t0} --> {t1}\n{cn}\n")
    with open(OUT_SRT, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_lines))
    print("Generated SRT:", OUT_SRT)

    # 2. 拼接 S01..S06 无损分镜视频并混流音频母带
    concat_file = os.path.join(OUT_DIR, "scene_concat_list.txt")
    scene_files = []
    for sc in ["S01", "S02", "S03", "S04", "S05", "S06"]:
        shot_id = tl["scenes"][sc][0]
        mp4 = os.path.join(PROD, sc, f"{sc}_镜头{shot_id}_1080p30.mp4")
        if not os.path.exists(mp4):
            raise FileNotFoundError(f"Missing scene video: {mp4}")
        scene_files.append(mp4)

    with open(concat_file, "w", encoding="utf-8") as f:
        for p in scene_files:
            f.write(f"file '{p}'\n")

    cmd_mux = [
        FFMPEG, "-y", "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", concat_file,
        "-i", AUDIO,
        "-c:v", "copy",
        "-c:a", "copy",
        "-shortest",
        "-movflags", "+faststart",
        OUT_MP4,
    ]
    subprocess.run(cmd_mux, check=True)
    print("Master MP4 composed:", OUT_MP4, f"({os.path.getsize(OUT_MP4)/(1024*1024):.2f} MB)")

    # 3. 生成全片 4x4 抽帧总览图 (16 frames across 118s)
    fps = 16.0 / 118.0
    cmd_sheet = [
        FFMPEG, "-y", "-loglevel", "error",
        "-i", OUT_MP4,
        "-vf", f"fps={fps:.5f},scale=480:-1,tile=4x4:padding=4:color=0x16120d",
        "-frames:v", "1", "-q:v", "2",
        OUT_SHEET,
    ]
    subprocess.run(cmd_sheet, check=True)
    print("Generated Overview Sheet:", OUT_SHEET)

    # 4. 校验成片流信息并输出质检报告
    probe_out = subprocess.check_output([
        FFPROBE, "-v", "error",
        "-show_entries", "stream=codec_name,width,height,r_frame_rate,nb_frames,duration:format=duration,size,bit_rate",
        "-of", "json", OUT_MP4,
    ], text=True)
    probe_data = json.loads(probe_out)
    with open(OUT_QC, "w", encoding="utf-8") as f:
        json.dump(probe_data, f, ensure_ascii=False, indent=2)
    print("Saved QC report:", OUT_QC)


if __name__ == "__main__":
    main()
