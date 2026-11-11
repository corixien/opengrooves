#!/usr/bin/env python3
"""Cuts the recorded kit (one long WAV, 3 hits per sound: soft, medium, hard) into
public/samples/<name>-{1,2,3}.flac.

usage: scripts/slice-samples.py <recording.wav> [outdir]

Each cut gets a short fade-in and a longer fade-out against clicks; every sound is
normalised as a group, so the soft/medium/hard ratios of the recording are kept.
Needs numpy and ffmpeg.
"""
import subprocess, sys, tempfile, wave
from pathlib import Path
import numpy as np

SR = 44100
# hit start times (s) of the recording, in recording order, 3 per sound
STARTS = [0, .5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 10, 10.5, 11, 11.5, 12, 12.5,
          13, 14, 15, 16, 17, 19, 20.5, 21.5, 22.5, 23.5, 24.5, 25.5, 26.5, 27.5, 28.5, 29.5, 30.5, 31.5,
          32.5, 34.5, 36.5, 38.5, 39, 39.5]
# sound name per group of 3 starts; None = skip
NAMES = ["kick", "sidestick", "snare", "tomLow", "tomMid", "tomHigh", "hhClosed", "hhHalf", "hhOpen",
         "crash", "ride", "china", "rideBell", "splash", "crash2", "hhPedal"]
END = 40.0
LEAD = 0.002      # start slightly before the grid time
FADE_IN = 0.003
FADE_OUT = 0.12
MAX_LEN = 2.5
TARGET_PEAK = 0.89  # ~ -1 dBFS


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2] if len(sys.argv) > 2 else "public/samples")
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "src.f32"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ac", "2", "-ar", str(SR), "-f", "f32le", str(raw)], check=True)
        x = np.fromfile(raw, dtype="<f4").reshape(-1, 2)
        for g, name in enumerate(NAMES):
            if not name:
                continue
            hits = []
            for k in range(3):
                i = g * 3 + k
                a = max(0, int((STARTS[i] - LEAD) * SR))
                nxt = STARTS[i + 1] if i + 1 < len(STARTS) else END
                b = int(min(nxt - LEAD - 0.002, STARTS[i] + MAX_LEN) * SR)
                s = x[a:b].copy()
                # trim a silent tail (< -60 dBFS) but keep at least 80 ms
                env = np.abs(s).max(1)
                loud = np.nonzero(env > 0.001)[0]
                s = s[: max(int(0.08 * SR), (loud[-1] + int(0.02 * SR)) if len(loud) else 0)]
                n = len(s)
                fi, fo = int(FADE_IN * SR), min(int(FADE_OUT * SR), n // 2)
                s[:fi] *= np.linspace(0, 1, fi)[:, None]
                s[n - fo :] *= np.linspace(1, 0, fo)[:, None] ** 2
                hits.append(s)
            gain = TARGET_PEAK / max(np.abs(h).max() for h in hits)
            for k, h in enumerate(hits, 1):
                pcm = (np.clip(h * gain, -1, 1) * 32767).astype("<i2")
                wav = Path(tmp) / f"{name}-{k}.wav"
                with wave.open(str(wav), "wb") as w:
                    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
                    w.writeframes(pcm.tobytes())
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-compression_level", "8", str(out / f"{name}-{k}.flac")], check=True)
                print(f"{name}-{k}: {len(h) / SR:.2f}s")


if __name__ == "__main__":
    main()
