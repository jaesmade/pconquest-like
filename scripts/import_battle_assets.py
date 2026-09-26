"""Import selected CC0 Kenney tiles as named battle assets.

Download the two official ZIP files into a directory and pass that directory as
the argument. Pillow is required. Existing files are left untouched by default.
"""
from __future__ import annotations

import io
import json
import sys
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "assets"
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".tmp_assets"
force = "--force" in sys.argv
packs = {
    "roguelike": {
        "zip": SOURCE / "roguelike.zip",
        "page": "https://kenney.nl/assets/roguelike-rpg-pack",
        "downloadUrl": "https://kenney.nl/media/pages/assets/roguelike-rpg-pack/12c03cd78b-1677697420/kenney_roguelike-rpg-pack.zip",
        "archive": "kenney_roguelike-rpg-pack.zip",
        "version": "1.0 (2015)",
        "creator": "Kenney Vleugels for Kenney, with Lynn Evers",
    },
    "ui": {
        "zip": SOURCE / "ui.zip",
        "page": "https://kenney.nl/assets/ui-pack-pixel-adventure",
        "downloadUrl": "https://kenney.nl/media/pages/assets/ui-pack-pixel-adventure/405ba5278a-1729196257/kenney_ui-pack-pixel-adventure.zip",
        "archive": "kenney_ui-pack-pixel-adventure.zip",
        "version": "2.0 (2024)",
        "creator": "Kenney",
    },
}
terrain = {
    "terrain-plain-16px": (0, 15),
    "terrain-plain-variant-16px": (1, 15),
    "terrain-water-16px": (0, 0),
    "terrain-water-variant-16px": (1, 0),
    "terrain-lava-16px": (0, 19),
    "terrain-lava-variant-16px": (1, 19),
    "terrain-wall-16px": (6, 2),
    "terrain-wall-variant-16px": (6, 3),
    "overlay-cover-16px": (12, 0),
    "overlay-flower-16px": (0, 9),
}
ui = {
    "hud-portrait-ally-32px": 21,
    "hud-portrait-enemy-32px": 20,
    "hud-portrait-target-32px": 22,
    "hud-panel-border-32px": 32,
}
records = []
with zipfile.ZipFile(packs["roguelike"]["zip"]) as archive:
    sheet_file = "Spritesheet/roguelikeSheet_transparent.png"
    sheet = Image.open(io.BytesIO(archive.read(sheet_file))).convert("RGBA")
    for name, (column, row) in terrain.items():
        category = "overlays" if name.startswith("overlay") else "tiles"
        path = PUBLIC / "environment" / category / f"{name}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        if force or not path.exists():
            sheet.crop((column * 17, row * 17, column * 17 + 16, row * 17 + 16)).save(path)
        records.append({
            "id": name, "url": "/" + path.relative_to(ROOT / "public").as_posix(),
            "sourcePack": "roguelike", "sourceFile": sheet_file, "sourceCell": [column, row],
            "pixelSize": [16, 16], "pivot": [0.5, 0.5],
            "transform": "Crop a 16x16 cell at a 17-pixel atlas stride; no recolor",
            "status": "imported CC0; replaceable",
        })
with zipfile.ZipFile(packs["ui"]["zip"]) as archive:
    for name, index in ui.items():
        source = f"Tiles/Large tiles/Thick outline/tile_{index:04d}.png"
        path = PUBLIC / "ui" / "hud" / f"{name}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        if force or not path.exists():
            path.write_bytes(archive.read(source))
        records.append({
            "id": name, "url": "/" + path.relative_to(ROOT / "public").as_posix(),
            "sourcePack": "ui", "sourceFile": source, "pixelSize": [32, 32],
            "pivot": [0.5, 0.5], "transform": "Copy the source PNG without recolor",
            "status": "imported CC0; replaceable",
        })
manifest = {
    "schemaVersion": 1,
    "acquiredOn": "2026-09-26",
    "license": "CC0 1.0; attribution appreciated but not required",
    "packs": {key: {field: value for field, value in pack.items() if field != "zip"} for key, pack in packs.items()},
    "assets": records,
}
target = PUBLIC / "battle-asset-manifest.json"
target.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
preview = Image.new("RGB", (5 * 170, 3 * 150), "#162a31")
draw = ImageDraw.Draw(preview)
for index, record in enumerate(records):
    asset = Image.open(ROOT / "public" / record["url"].lstrip("/")).convert("RGBA")
    scale = 4 if asset.width == 16 else 2
    asset = asset.resize((asset.width * scale, asset.height * scale), Image.Resampling.NEAREST)
    x, y = index % 5 * 170, index // 5 * 150
    draw.rectangle((x + 8, y + 8, x + 161, y + 115), fill="#304347")
    preview.paste(asset, (x + 85 - asset.width // 2, y + 32), asset)
    draw.text((x + 9, y + 120), record["id"].replace("-16px", "").replace("-32px", ""), fill="#e8ead7")
preview.save(ROOT / "docs" / "BATTLE_ASSET_PREVIEW.png")
print(f"Imported {len(records)} named battle assets; manifest: {target}")
