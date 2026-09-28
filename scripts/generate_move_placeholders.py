"""Generate original, replaceable four-frame move effect placeholders.

Run `py scripts/generate_move_placeholders.py`. Existing sheets are preserved unless
`--force` is passed, so a replacement artist's work is safe on ordinary reruns.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "public/assets/animations/move-placeholders"
PREVIEW = ROOT / "docs/MOVE_PLACEHOLDER_PREVIEW.png"
SIZE = 32
FRAMES = 4
KINDS = ("melee", "projectile", "area", "self", "hazard", "weather")
INK = (18, 28, 37)
LIGHT = (255, 255, 255)
MID = (188, 202, 211)


def color(rgb: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return (*rgb, alpha)


def line(draw: ImageDraw.ImageDraw, points: tuple[int, ...], alpha: int, width: int = 3) -> None:
    draw.line(points, fill=color(INK, alpha), width=width + 2, joint="curve")
    draw.line(points, fill=color(LIGHT, alpha), width=width, joint="curve")


def frame(kind: str, index: int) -> Image.Image:
    image = Image.new("RGBA", (SIZE, SIZE))
    draw = ImageDraw.Draw(image)
    alpha = (210, 255, 235, 165)[index]
    spread = (1, 3, 5, 7)[index]

    if kind == "melee":
        # Two offset diagonal cuts read as a contact strike at battle scale.
        line(draw, (5 + index, 22, 23 + index, 6), alpha, 3)
        line(draw, (7, 28 - index, 28 - index, 10), alpha, 2)
        draw.rectangle((6, 8 + index, 9, 10 + index), fill=color(MID, alpha))
    elif kind == "projectile":
        # The small tail stays on the left while the orb pulses in flight.
        radius = (5, 6, 7, 6)[index]
        draw.ellipse((16 - radius - 2, 16 - radius - 2, 16 + radius + 2, 16 + radius + 2), fill=color(INK, alpha))
        draw.ellipse((16 - radius, 16 - radius, 16 + radius, 16 + radius), fill=color(LIGHT, alpha))
        draw.rectangle((3 + index, 14, 9 + index, 17), fill=color(MID, alpha))
        draw.rectangle((2 + index, 20, 6 + index, 21), fill=color(LIGHT, alpha))
    elif kind == "area":
        # A growing ring marks every affected tile.
        radius = 5 + spread
        draw.ellipse((16 - radius, 16 - radius, 16 + radius, 16 + radius), outline=color(INK, alpha), width=5)
        draw.ellipse((16 - radius, 16 - radius, 16 + radius, 16 + radius), outline=color(LIGHT, alpha), width=3)
        for x, y in ((16, 3), (29, 16), (16, 29), (3, 16)):
            draw.rectangle((x - 1, y - 1, x + 1, y + 1), fill=color(MID, alpha))
    elif kind == "self":
        # A shield aura sits over the caster; the ground point stays centered.
        width = 7 + index
        shield = ((16, 3 + index), (16 + width, 8), (24, 22), (16, 29 - index), (8, 22), (16 - width, 8))
        draw.polygon(shield, outline=color(INK, alpha), width=5)
        draw.polygon(shield, outline=color(LIGHT, alpha), width=3)
        draw.rectangle((14, 12, 17, 20), fill=color(MID, alpha))
        draw.rectangle((11, 15, 20, 17), fill=color(MID, alpha))
    elif kind == "hazard":
        # Three spikes remain rooted on the tile while growing.
        height = 7 + index * 3
        for center, offset in ((7, 3), (16, 0), (25, 4)):
            tip = 27 - height + offset
            spike = ((center - 5, 28), (center, tip), (center + 5, 28))
            draw.polygon(spike, fill=color(INK, alpha))
            draw.polygon(((center - 2, 26), (center, tip + 4), (center + 2, 26)), fill=color(LIGHT, alpha))
    else:  # weather
        # Offset wind bands make a board-wide cue without suggesting a hit target.
        drift = index * 2
        for y, start, end in ((8, 3, 23), (16, 8, 29), (24, 2, 21)):
            line(draw, (max(2, start + drift - 3), y, min(29, end + drift - 3), y), alpha, 2)
        draw.rectangle((25 - index, 5, 27 - index, 7), fill=color(MID, alpha))

    return image


def sheet(kind: str) -> Image.Image:
    image = Image.new("RGBA", (SIZE * FRAMES, SIZE))
    for index in range(FRAMES):
        image.alpha_composite(frame(kind, index), (SIZE * index, 0))
    return image


def contact_sheet(sheets: dict[str, Image.Image]) -> Image.Image:
    scale = 3
    margin = 18
    row_height = SIZE * scale + 28
    canvas = Image.new("RGB", (margin * 2 + SIZE * FRAMES * scale, margin * 2 + row_height * len(KINDS)), (235, 240, 237))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for row, kind in enumerate(KINDS):
        y = margin + row * row_height
        draw.text((margin, y), kind.upper(), fill=INK, font=font)
        scaled = sheets[kind].resize((SIZE * FRAMES * scale, SIZE * scale), Image.Resampling.NEAREST)
        x0, y0 = margin, y + 20
        for fy in range(0, SIZE * scale, 12):
            for fx in range(0, SIZE * FRAMES * scale, 12):
                shade = (206, 218, 219) if (fx // 12 + fy // 12) % 2 else (248, 250, 246)
                draw.rectangle((x0 + fx, y0 + fy, x0 + fx + 11, y0 + fy + 11), fill=shade)
        canvas.paste(scaled, (x0, y0), scaled)
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="overwrite existing placeholder sheets")
    args = parser.parse_args()
    DESTINATION.mkdir(parents=True, exist_ok=True)
    sheets: dict[str, Image.Image] = {}
    for kind in KINDS:
        path = DESTINATION / f"move-placeholder-{kind}-32px.png"
        if not path.exists() or args.force:
            sheet(kind).save(path, format="PNG", optimize=True)
            print(f"written: {path.relative_to(ROOT)}")
        else:
            print(f"preserved: {path.relative_to(ROOT)}")
        sheets[kind] = Image.open(path).convert("RGBA")
    if not PREVIEW.exists() or args.force:
        contact_sheet(sheets).save(PREVIEW, format="PNG", optimize=True)
        print(f"written: {PREVIEW.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
