"""Draw sparse, original rain and snow loops on a coarse pixel grid.

Requires Pillow. Existing exports are preserved unless --force is supplied.
The formats match the battle renderer: 128px tiles at 25 fps, a 64-frame
rain APNG with a still, and a 256-frame snow sheet in row-major order.
"""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "assets" / "animations" / "weather"
GRID = 64
TILE = 128
RAIN_FRAMES = 64
SNOW_FRAMES = 256
FRAME_MS = 40


def positions(count: int, seed: int) -> list[tuple[int, int]]:
    """Spread particles over the tile without a visible regular lattice."""
    rng = random.Random(seed)
    cells = rng.sample(range(25), count)
    return [(int((cell % 5 + rng.uniform(0.15, 0.85)) * GRID / 5),
             int((cell // 5 + rng.uniform(0.15, 0.85)) * GRID / 5))
            for cell in cells]


RAIN = positions(20, 1401)
SNOW = positions(18, 1402)


def mark(image: Image.Image, x: int, y: int, shape: tuple[tuple[int, int], ...],
         color: tuple[int, int, int, int]) -> None:
    for dx, dy in shape:
        image.putpixel(((x + dx) % GRID, (y + dy) % GRID), color)


def rain_frame(frame: int) -> Image.Image:
    image = Image.new("RGBA", (GRID, GRID))
    for x, y in RAIN:
        # A single flat-color, six-pixel-long stepped dash; no splash or trail.
        mark(image, x + frame, y + frame * 2, ((0, 0), (0, 1), (1, 2)),
             (159, 202, 220, 140))
    return image.resize((TILE, TILE), Image.Resampling.NEAREST)


def snow_frame(frame: int) -> Image.Image:
    image = Image.new("RGBA", (GRID, GRID))
    for index, (x, y) in enumerate(SNOW):
        # Plain 2px squares share one gentle drift and one translucent color.
        drift = round(2 * math.sin(math.tau * frame / SNOW_FRAMES))
        fall = frame // (2 if index % 3 == 0 else 4)
        mark(image, x + drift, y + fall, ((0, 0),), (230, 240, 245, 170))
    return image.resize((TILE, TILE), Image.Resampling.NEAREST)


def generate(force: bool) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rain_path = OUTPUT / "weather-rain-simple-128px.png"
    still_path = OUTPUT / "weather-rain-simple-still-128px.png"
    snow_path = OUTPUT / "weather-snow-simple-128px.png"
    if force or not rain_path.exists():
        frames = [rain_frame(frame) for frame in range(RAIN_FRAMES)]
        frames[0].save(rain_path, save_all=True, append_images=frames[1:],
                       duration=FRAME_MS, loop=0, disposal=0, blend=0,
                       optimize=False)
    if force or not still_path.exists():
        rain_frame(0).save(still_path)
    if force or not snow_path.exists():
        sheet = Image.new("RGBA", (TILE * 16, TILE * 16))
        for frame in range(SNOW_FRAMES):
            sheet.paste(snow_frame(frame), ((frame % 16) * TILE, (frame // 16) * TILE))
        sheet.save(snow_path)
    for path in (rain_path, still_path, snow_path):
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Overwrite generated exports")
    generate(parser.parse_args().force)
