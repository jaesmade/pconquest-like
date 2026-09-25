"""Generate the replaceable, original pixel placeholders described in ANIMATION_ASSETS.md.

Run with the bundled Python runtime and Pillow. Existing PNGs are preserved unless
--force is passed, so custom artwork cannot be overwritten by an ordinary rerun.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets" / "animations"
FRAME = 32
DIRECTIONS = ("south", "west", "east", "north")
CLIPS = (
    ("idle", 2),
    ("move", 4),
    ("attack", 3),
    ("hurt", 2),
    ("buff", 2),
    ("debuff", 2),
    ("special", 3),
    ("faint", 2),
)
TOTAL_COLUMNS = sum(count for _, count in CLIPS)
FONT = ImageFont.load_default()

UNITS = {
    "bulbasaur": ((91, 174, 112), "B"),
    "squirtle": ((86, 170, 211), "S"),
    "lapras": ((86, 137, 205), "L"),
    "geodude": ((150, 143, 132), "G"),
    "pikachu": ((238, 201, 69), "P"),
    "meowth": ((218, 184, 133), "M"),
    "placeholder": ((181, 115, 190), "?"),
}

EFFECTS = {
    "attack-impact": (255, 246, 198),
    "buff": (255, 222, 80),
    "debuff": (160, 104, 215),
    "heal": (100, 230, 145),
    "mega": (234, 142, 245),
    "status": (108, 206, 236),
}

WEATHER = {
    "sun": (255, 215, 90),
    "rain": (105, 173, 240),
    "snow": (230, 242, 255),
    "sandstorm": (207, 177, 120),
}

ATTACKS = {
    "tackle": (238, 234, 205),
    "ember": (255, 113, 49),
    "vine-whip": (101, 225, 117),
    "water-pulse": (91, 190, 255),
    "thunder-shock": (255, 225, 68),
    "rock-throw": (176, 153, 114),
    "mud-slap": (141, 98, 67),
    "ice-shard": (157, 237, 255),
    "tail-whip": (196, 137, 231),
    "harden": (189, 213, 225),
    "howl": (255, 218, 126),
    "stealth-rock": (198, 180, 148),
    "thunderbolt": (255, 241, 75),
    "sandstorm": (217, 185, 119),
    "sunny-day": (255, 206, 78),
}


def paint_unit_frame(
    color: tuple[int, int, int], label: str, direction: str, clip: str, index: int
) -> Image.Image:
    image = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    dx, dy = 0, 0
    if clip == "idle":
        dy = (0, -1)[index]
    elif clip == "move":
        dx = (0, 1, 0, -1)[index]
        dy = (0, -1, 0, -1)[index]
    elif clip == "attack":
        step = (0, 1, 3)[index]
        if direction == "west":
            dx = -step
        elif direction == "east":
            dx = step
        elif direction == "north":
            dy = -step
        else:
            dy = step
    elif clip == "hurt":
        dx = (0, -1)[index] if direction != "west" else (0, 1)[index]
    elif clip == "special":
        dy = (0, -1, -2)[index]
    elif clip == "faint":
        dy = (2, 4)[index]

    draw.ellipse((7, 27, 25, 30), fill=(15, 19, 25, 75))
    x0, y0, x1, y1 = 7 + dx, 7 + dy, 25 + dx, 25 + dy
    if clip == "faint":
        y0 = 15 + dy
        y1 = 25 + dy
    outline = (35, 39, 50, 255)
    fill = (*color, 255)
    if clip == "hurt" and index == 1:
        fill = (255, 109, 119, 255)
    if clip == "faint" and index == 1:
        fill = (105, 109, 120, 180)

    draw.rounded_rectangle((x0, y0, x1, y1), radius=3, fill=outline)
    draw.rounded_rectangle((x0 + 2, y0 + 2, x1 - 2, y1 - 2), radius=2, fill=fill)
    if clip == "move":
        foot_shift = -2 if index % 2 else 2
        draw.rectangle((x0 + 3, y1 - 1, x0 + 7, y1 + 1 + foot_shift // 2), fill=outline)
        draw.rectangle((x1 - 7, y1 - 1, x1 - 3, y1 + 1 - foot_shift // 2), fill=outline)

    bbox = draw.textbbox((0, 0), label, font=FONT)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    tx = (x0 + x1 - text_width) // 2
    ty = (y0 + y1 - text_height) // 2 - bbox[1]
    draw.text((tx, ty), label, font=FONT, fill=(24, 29, 37, 255))

    arrow = {
        "south": ((16, 31), (12, 27), (20, 27)),
        "west": ((1, 16), (5, 12), (5, 20)),
        "east": ((31, 16), (27, 12), (27, 20)),
        "north": ((16, 1), (12, 5), (20, 5)),
    }[direction]
    draw.polygon(arrow, fill=(255, 255, 255, 230), outline=outline)

    if clip == "attack":
        draw.line((12 + dx, 4 + dy, 19 + dx, 4 + dy), fill=(255, 245, 170, 255), width=2)
    elif clip == "hurt":
        draw.line((3, 8, 6, 11), fill=(255, 85, 88, 255), width=2)
        draw.line((6, 8, 3, 11), fill=(255, 85, 88, 255), width=2)
    elif clip == "buff":
        sparkle = (255, 224, 62, 255)
        draw.rectangle((3 + index, 7, 5 + index, 11), fill=sparkle)
        draw.rectangle((2 + index, 8, 6 + index, 10), fill=sparkle)
        draw.rectangle((27 - index, 17, 29 - index, 21), fill=sparkle)
    elif clip == "debuff":
        draw.polygon(((3 + index, 6), (7 + index, 6), (5 + index, 11)), fill=(167, 107, 228, 255))
        draw.polygon(((25 - index, 3), (29 - index, 3), (27 - index, 8)), fill=(167, 107, 228, 255))
    elif clip == "special":
        draw.rectangle((3 - index % 2, 3, 28 + index % 2, 28), outline=(104, 226, 249, 220), width=1)
    return image


def make_unit_sheet(color: tuple[int, int, int], label: str) -> Image.Image:
    sheet = Image.new("RGBA", (TOTAL_COLUMNS * FRAME, len(DIRECTIONS) * FRAME), (0, 0, 0, 0))
    for row, direction in enumerate(DIRECTIONS):
        column = 0
        for clip, count in CLIPS:
            for index in range(count):
                frame = paint_unit_frame(color, label, direction, clip, index)
                sheet.alpha_composite(frame, (column * FRAME, row * FRAME))
                column += 1
    return sheet


def make_effect_sheet(name: str, color: tuple[int, int, int]) -> Image.Image:
    sheet = Image.new("RGBA", (4 * FRAME, FRAME), (0, 0, 0, 0))
    for index in range(4):
        frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
        draw = ImageDraw.Draw(frame)
        alpha = 255 - index * 48
        ink = (*color, alpha)
        size = 3 + index * 3
        if name in {"attack-impact", "mega", "status"}:
            draw.line((16 - size, 16, 16 + size, 16), fill=ink, width=2)
            draw.line((16, 16 - size, 16, 16 + size), fill=ink, width=2)
            if name == "mega":
                draw.rectangle((16 - size, 16 - size, 16 + size, 16 + size), outline=ink, width=1)
        elif name == "heal":
            draw.rectangle((14, 16 - size, 18, 16 + size), fill=ink)
            draw.rectangle((16 - size, 14, 16 + size, 18), fill=ink)
        elif name == "buff":
            draw.polygon(((16, 6 - index), (10 - index, 17), (22 + index, 17)), fill=ink)
            draw.rectangle((14, 17, 18, 25 + index), fill=ink)
        else:
            draw.polygon(((10 - index, 12), (22 + index, 12), (16, 25 + index)), fill=ink)
            draw.rectangle((14, 5 - index, 18, 12), fill=ink)
        sheet.alpha_composite(frame, (index * FRAME, 0))
    return sheet


def make_weather_sheet(name: str, color: tuple[int, int, int]) -> Image.Image:
    sheet = Image.new("RGBA", (4 * FRAME, FRAME), (0, 0, 0, 0))
    for index in range(4):
        frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
        draw = ImageDraw.Draw(frame)
        ink = (*color, 180)
        if name == "sun":
            draw.ellipse((11, 11, 20, 20), outline=ink, width=2)
            for x0, y0, x1, y1 in ((16, 3, 16, 8), (16, 23, 16, 28), (3, 16, 8, 16), (23, 16, 28, 16)):
                draw.line((x0, y0, x1, y1), fill=ink, width=2)
        elif name == "rain":
            for x in (5, 15, 25):
                y = (index * 5 + x) % 27
                draw.line((x, y, x - 3, y + 5), fill=ink, width=2)
        elif name == "snow":
            for x in (6, 16, 26):
                y = (index * 4 + x) % 28
                draw.rectangle((x, y, x + 2, y + 2), fill=ink)
        else:
            for x in (5, 14, 24):
                y = (index * 3 + x * 2) % 29
                draw.rectangle((x, y, x + 4, y + 1), fill=ink)
        sheet.alpha_composite(frame, (index * FRAME, 0))
    return sheet


def make_attack_sheet(name: str, color: tuple[int, int, int]) -> Image.Image:
    """Four transparent 32px frames; each move has a recognizable silhouette."""
    sheet = Image.new("RGBA", (4 * FRAME, FRAME), (0, 0, 0, 0))
    for index in range(4):
        frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
        draw = ImageDraw.Draw(frame)
        r = 4 + index * 2
        alpha = 255 - index * 37
        ink = (*color, alpha)
        glow = (*color, max(60, alpha // 2))
        if name == "tackle":
            for offset in (-5, 0, 5):
                draw.line((5 + index, 10 + offset, 25 - index, 20 + offset), fill=ink, width=2)
        elif name == "ember":
            draw.ellipse((16-r, 17-r, 16+r, 17+r), fill=ink)
            draw.polygon(((16, 2+index), (10, 17), (21, 17)), fill=glow)
            draw.ellipse((13, 14, 18, 19), fill=(255, 236, 137, alpha))
        elif name == "vine-whip":
            draw.arc((3, 3+index, 28, 28-index), 200, 80, fill=ink, width=4)
            draw.ellipse((22-index, 7, 29-index, 12), fill=glow)
        elif name == "water-pulse":
            draw.ellipse((16-r, 16-r, 16+r, 16+r), outline=ink, width=3)
            draw.ellipse((12, 12, 20, 20), fill=glow)
        elif name in {"thunder-shock", "thunderbolt"}:
            points = ((16, 2), (11-index, 13), (18, 13), (12, 29), (23+index, 12), (17, 12), (21, 2))
            draw.polygon(points, fill=ink)
            if name == "thunderbolt":
                draw.line((4, 5, 9+index, 11), fill=glow, width=2)
                draw.line((26, 21, 29, 27), fill=glow, width=2)
        elif name in {"rock-throw", "stealth-rock"}:
            draw.polygon(((8-index, 21), (11, 9-index), (21, 7), (26+index, 20), (20, 27), (11, 26)), fill=ink)
            draw.line((11, 12, 20, 10), fill=(240, 224, 188, alpha), width=2)
            if name == "stealth-rock":
                draw.polygon(((3, 28), (6, 15-index), (12, 28)), fill=glow)
                draw.polygon(((21, 29), (26, 12-index), (31, 29)), fill=glow)
        elif name == "mud-slap":
            draw.ellipse((16-r, 18-r//2, 16+r, 18+r//2), fill=ink)
            for x, y in ((6, 11), (25, 8), (27, 24)):
                draw.ellipse((x-index, y-index, x+2+index, y+2+index), fill=glow)
        elif name == "ice-shard":
            draw.polygon(((16, 2-index//2), (23+index, 14), (16, 30), (9-index, 14)), fill=ink)
            draw.line((16, 4, 16, 27), fill=(255, 255, 255, alpha), width=2)
        elif name == "tail-whip":
            draw.arc((3-index, 5-index, 29+index, 27+index), 205, 40, fill=ink, width=3)
            draw.polygon(((26, 13), (29, 19), (23, 20)), fill=ink)
        elif name == "harden":
            draw.polygon(((16, 3), (26+index, 7), (25, 21), (16, 29), (7, 21), (6-index, 7)), outline=ink)
            draw.line((16, 7, 16, 24), fill=glow, width=2)
        elif name == "howl":
            for radius in (5+index*2, 10+index*2):
                draw.arc((16-radius, 16-radius, 16+radius, 16+radius), 200, 340, fill=ink, width=2)
        elif name == "sandstorm":
            for y in (8, 15, 22):
                draw.arc((3-index, y-4, 29+index, y+6), 0, 160, fill=ink, width=2)
            draw.point((8+index, 27), fill=ink)
        elif name == "sunny-day":
            draw.ellipse((16-r//2, 16-r//2, 16+r//2, 16+r//2), fill=ink)
            for x0, y0, x1, y1 in ((16,2,16,8),(16,24,16,30),(2,16,8,16),(24,16,30,16),(5,5,10,10),(22,22,27,27)):
                draw.line((x0,y0,x1,y1), fill=glow, width=2)
        sheet.alpha_composite(frame, (index * FRAME, 0))
    return sheet


def save_if_allowed(image: Image.Image, path: Path, force: bool) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not force:
        return "preserved"
    image.save(path, format="PNG", optimize=True)
    return "written"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="overwrite existing placeholder PNGs")
    args = parser.parse_args()
    for name, (color, label) in UNITS.items():
        path = ASSETS / "units" / name / f"{name}-battle-32px.png"
        result = save_if_allowed(make_unit_sheet(color, label), path, args.force)
        print(f"{result}: {path.relative_to(ROOT)}")
    for name, color in EFFECTS.items():
        path = ASSETS / "effects" / f"effect-{name}-32px.png"
        result = save_if_allowed(make_effect_sheet(name, color), path, args.force)
        print(f"{result}: {path.relative_to(ROOT)}")
    for name, color in WEATHER.items():
        path = ASSETS / "weather" / f"weather-{name}-32px.png"
        result = save_if_allowed(make_weather_sheet(name, color), path, args.force)
        print(f"{result}: {path.relative_to(ROOT)}")
    for name, color in ATTACKS.items():
        path = ASSETS / "attacks" / f"attack-{name}-32px.png"
        result = save_if_allowed(make_attack_sheet(name, color), path, args.force)
        print(f"{result}: {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
