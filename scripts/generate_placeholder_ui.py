"""Create named, replaceable SVG placeholders for battle UI icons."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "assets" / "ui" / "icons"
ROOT.mkdir(parents=True, exist_ok=True)
ICONS = {
    "item-none": ("#637b7e", "–"),
    "item-leftovers": ("#82bf85", "+"),
    "item-sitrus-berry": ("#d8aa5e", "B"),
    "item-assault-vest": ("#82a6bb", "V"),
    "item-x-attack": ("#e3936b", "X"),
    "item-charizardite-x": ("#ad91d9", "M"),
    "status-burned": ("#ec8d5d", "F"),
    "status-paralyzed": ("#e9d06c", "Z"),
    "status-charged": ("#f4b873", "C"),
    "stage-buff": ("#8ed5a0", "↑"),
    "stage-debuff": ("#dc91a1", "↓"),
}
for name, (color, glyph) in ICONS.items():
    path = ROOT / f"{name}.svg"
    if path.exists():
        continue
    path.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">'
        f'<rect x="2" y="2" width="28" height="28" rx="6" fill="#172e34" stroke="{color}" stroke-width="3"/>'
        f'<text x="16" y="22" text-anchor="middle" font-family="monospace" font-size="19" font-weight="bold" fill="{color}">{glyph}</text>'
        '</svg>', encoding="utf-8")
print(f"Ready: {len(ICONS)} named UI icons in {ROOT}")
