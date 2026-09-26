"""Generate original, replaceable retro audio placeholders using the Python standard library."""

from __future__ import annotations

import argparse
import json
import math
import random
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "public" / "assets" / "audio"
MANIFEST = AUDIO / "audio-manifest.json"
SAMPLE_RATE = 22050


def midi(note: int) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def triangle(phase: float) -> float:
    return 2 / math.pi * math.asin(math.sin(phase))


def square(phase: float) -> float:
    return 1.0 if math.sin(phase) >= 0 else -1.0


def save_wav(path: Path, samples: list[float], force: bool) -> bool:
    if path.exists() and not force:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    peak = max((abs(sample) for sample in samples), default=1.0)
    scale = min(1.0, 0.58 / peak) if peak else 1.0
    frames = bytearray()
    for sample in samples:
        frames.extend(struct.pack("<h", int(max(-1.0, min(1.0, sample * scale)) * 32767)))
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(frames)
    return True


def effect(name: str, duration: float, start_hz: float, end_hz: float,
           shape: str = "triangle", noise: float = 0.0, pulses: int = 1) -> list[float]:
    rng = random.Random(name)
    count = round(duration * SAMPLE_RATE)
    samples = []
    for i in range(count):
        t = i / SAMPLE_RATE
        progress = t / duration
        sweep_phase = 2 * math.pi * (start_hz * t + (end_hz - start_hz) * t * progress / 2)
        tone = square(sweep_phase) if shape == "square" else triangle(sweep_phase)
        pulse = 0.65 + 0.35 * math.cos(2 * math.pi * pulses * progress)
        envelope = min(1.0, t / 0.006) * (1.0 - progress) ** 1.7
        grain = (rng.random() * 2 - 1) * noise
        samples.append((tone * (1.0 - noise * 0.45) + grain) * envelope * pulse)
    return samples


def song(name: str, bpm: int, melody: list[int], bass: list[int]) -> list[float]:
    rng = random.Random(name)
    beat = 60 / bpm
    duration = 16 * beat
    count = round(duration * SAMPLE_RATE)
    samples = []
    for i in range(count):
        t = i / SAMPLE_RATE
        beat_position = t / beat
        step = min(31, int(beat_position * 2))
        local_step = (beat_position * 2 - step) * beat / 2
        note = melody[step]
        lead = 0.0
        if note:
            lead_env = min(1.0, local_step / 0.008) * math.exp(-4.0 * local_step / (beat / 2))
            lead = square(2 * math.pi * midi(note) * t) * lead_env * 0.12
        beat_index = min(15, int(beat_position))
        local_beat = (beat_position - beat_index) * beat
        bass_note = bass[beat_index // 4]
        bass_env = math.exp(-3.1 * local_beat / beat)
        bass_tone = triangle(2 * math.pi * midi(bass_note) * t) * bass_env * 0.14
        chord_note = bass_note + 12
        chord = triangle(2 * math.pi * midi(chord_note) * t) * 0.025
        kick = math.sin(2 * math.pi * (90 - 45 * min(1, local_beat / 0.12)) * local_beat) * math.exp(-28 * local_beat) * 0.12
        hat_time = (beat_position * 2 % 1) * beat / 2
        hat = (rng.random() * 2 - 1) * math.exp(-95 * hat_time) * 0.035
        fade = min(1.0, t / 0.015, (duration - t) / 0.015)
        samples.append((lead + bass_tone + chord + kick + hat) * max(0, fade))
    return samples


EFFECTS = {
    "moves/move-tackle.wav": (0.24, 180, 80, "triangle", 0.18, 1),
    "moves/move-ember.wav": (0.38, 420, 230, "square", 0.35, 5),
    "moves/move-vine-whip.wav": (0.33, 900, 130, "triangle", 0.32, 2),
    "moves/move-water-pulse.wav": (0.45, 340, 170, "triangle", 0.12, 5),
    "moves/move-thunder-shock.wav": (0.32, 1100, 280, "square", 0.48, 8),
    "moves/move-rock-throw.wav": (0.35, 210, 65, "square", 0.55, 3),
    "moves/move-mud-slap.wav": (0.34, 270, 85, "triangle", 0.42, 2),
    "moves/move-ice-shard.wav": (0.42, 1200, 520, "triangle", 0.09, 4),
    "moves/move-tail-whip.wav": (0.31, 650, 160, "triangle", 0.22, 2),
    "moves/move-harden.wav": (0.48, 310, 680, "triangle", 0.08, 1),
    "moves/move-howl.wav": (0.63, 220, 490, "square", 0.06, 1),
    "moves/move-stealth-rock.wav": (0.56, 340, 95, "square", 0.5, 4),
    "moves/move-thunderbolt.wav": (0.62, 1450, 170, "square", 0.53, 10),
    "moves/move-sandstorm.wav": (0.72, 360, 120, "triangle", 0.73, 5),
    "moves/move-sunny-day.wav": (0.72, 440, 880, "triangle", 0.08, 3),
    "items/item-leftovers.wav": (0.34, 520, 760, "triangle", 0.02, 2),
    "items/item-sitrus-berry.wav": (0.45, 490, 980, "triangle", 0.03, 3),
    "items/item-assault-vest.wav": (0.42, 280, 560, "triangle", 0.1, 2),
    "items/item-x-attack.wav": (0.55, 340, 1080, "square", 0.04, 3),
    "items/item-charizardite-x.wav": (0.85, 220, 1100, "triangle", 0.12, 4),
    "cues/cue-move-fallback.wav": (0.3, 430, 180, "triangle", 0.1, 1),
    "cues/cue-item-fallback.wav": (0.38, 400, 760, "triangle", 0.05, 2),
    "cues/cue-pokemon-enter.wav": (0.42, 330, 660, "triangle", 0.03, 2),
    "cues/cue-pokemon-hit.wav": (0.2, 230, 90, "triangle", 0.28, 1),
    "cues/cue-pokemon-faint.wav": (0.62, 440, 90, "triangle", 0.1, 2),
    "cues/cue-ui-confirm.wav": (0.14, 660, 880, "triangle", 0.0, 1),
}

SONGS = {
    "music/bgm-menu-loop.wav": (100,
        [64, 67, 69, 72, 71, 69, 67, 64, 62, 64, 67, 71, 69, 67, 64, 0,
         64, 67, 69, 72, 74, 72, 71, 69, 67, 69, 71, 67, 64, 62, 64, 0],
        [45, 41, 43, 40]),
    "music/bgm-route-loop.wav": (106,
        [67, 69, 71, 74, 71, 69, 67, 0, 69, 71, 74, 76, 74, 71, 69, 0,
         67, 69, 71, 74, 76, 74, 71, 69, 67, 64, 67, 69, 67, 64, 62, 0],
        [43, 40, 45, 38]),
    "music/bgm-battle-loop.wav": (124,
        [69, 69, 72, 76, 74, 72, 69, 67, 69, 72, 76, 79, 76, 74, 72, 0,
         69, 72, 76, 81, 79, 76, 74, 72, 76, 74, 72, 69, 67, 69, 72, 0],
        [45, 43, 41, 40]),
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Overwrite previously generated or replacement audio")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    listed = {url.removeprefix("/assets/audio/") for category in ("music", "moves", "items", "cues")
              for url in manifest[category].values()}
    expected = set(EFFECTS) | set(SONGS)
    if listed != expected:
        raise SystemExit(f"Manifest mismatch: missing {expected - listed}; extra {listed - expected}")
    created = 0
    for relative, settings in EFFECTS.items():
        created += save_wav(AUDIO / relative, effect(relative, *settings), args.force)
    for relative, settings in SONGS.items():
        created += save_wav(AUDIO / relative, song(relative, *settings), args.force)
    print(f"Created {created} placeholder WAV files; preserved {len(expected) - created} existing files.")


if __name__ == "__main__":
    main()
