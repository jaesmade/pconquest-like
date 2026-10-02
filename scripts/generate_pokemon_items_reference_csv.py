#!/usr/bin/env python3
"""Export every Pokefile item and the current runtime item definitions."""

from __future__ import annotations

import argparse
import csv
import re
import unicodedata
from collections import Counter
from pathlib import Path

COLUMNS = (
    "Reference ID",
    "Item",
    "Category",
    "Source Row",
    "Source Description",
    "Source Description Status",
    "Proposed Game Implementation",
    "Runtime Support Status",
    "Current Runtime Effect",
    "Data Notes",
)


def normalize(value: str) -> str:
    value = "".join(
        char
        for char in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(char)
    )
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def read_source(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def runtime_definitions(path: Path) -> dict[str, str]:
    source = path.read_text(encoding="utf-8")
    start_marker = "export const ITEM_DEFINITIONS = {"
    end_marker = "\n} as const satisfies Record"
    start = source.find(start_marker)
    end = source.find(end_marker, start)
    if start < 0 or end < 0:
        raise ValueError(f"Cannot locate ITEM_DEFINITIONS in {path}")
    body = source[start + len(start_marker):end]
    starts = list(re.finditer(
        r"^  (?P<key>'[^']+'|[A-Za-z][A-Za-z0-9_]*):\s*\{",
        body,
        re.MULTILINE,
    ))
    definitions: dict[str, str] = {}
    for index, match in enumerate(starts):
        stop = starts[index + 1].start() if index + 1 < len(starts) else len(body)
        entry = body[match.end():stop]
        description = re.search(r"\bdescription:\s*'((?:\\.|[^'\\])*)'", entry)
        if not description:
            raise ValueError(f"Missing runtime description for {match.group('key')}")
        key = match.group("key").strip("'")
        value = description.group(1).replace("\\'", "'").replace("\\\\", "\\")
        definitions[key] = value
    if not definitions:
        raise ValueError(f"No runtime item definitions found in {path}")
    return definitions


def row_notes(
    name: str,
    description: str,
    duplicate_counts: Counter[str],
    *,
    runtime_only: bool = False,
) -> str:
    notes: list[str] = []
    if runtime_only:
        notes.append("Runtime catalog entry absent from Items.csv.")
    if not description and not runtime_only:
        notes.append("Source description is blank; no effect text is supplied by this source.")
    if duplicate_counts[normalize(name)] > 1:
        notes.append("Repeated item name; source row preserves this entry's context.")
    return " ".join(notes)


def build(source_path: Path, runtime_path: Path, output_path: Path) -> tuple[int, int, int, int]:
    source_rows = read_source(source_path)
    runtime = runtime_definitions(runtime_path)
    counts = Counter(normalize(row["Item"]) for row in source_rows)
    seen_runtime: set[str] = set()
    output_rows: list[dict[str, str]] = []

    for source_row_number, row in enumerate(source_rows, start=2):
        name = row["Item"].strip()
        description = row["Description"].strip()
        runtime_effect = runtime.get(name, "")
        if runtime_effect:
            seen_runtime.add(name)
        output_rows.append({
            "Reference ID": f"pokefile-item-{source_row_number:04d}",
            "Item": name,
            "Category": row["Category"].strip(),
            "Source Row": str(source_row_number),
            "Source Description": description,
            "Source Description Status": "Provided" if description else "Missing",
            "Proposed Game Implementation": row["Game Implementation"].strip(),
            "Runtime Support Status": "Implemented" if runtime_effect else "Reference only",
            "Current Runtime Effect": runtime_effect,
            "Data Notes": row_notes(name, description, counts),
        })

    source_names = {row["Item"] for row in source_rows}
    for name, description in runtime.items():
        if name in seen_runtime or name in source_names:
            continue
        output_rows.append({
            "Reference ID": f"runtime-only-{normalize(name)}",
            "Item": name,
            "Category": "Runtime only",
            "Source Row": "",
            "Source Description": "",
            "Source Description Status": "Runtime-only entry",
            "Proposed Game Implementation": "",
            "Runtime Support Status": "Implemented",
            "Current Runtime Effect": description,
            "Data Notes": row_notes(name, "", counts, runtime_only=True),
        })

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(output_rows)

    source_missing = sum(not row["Description"].strip() for row in source_rows)
    implemented = sum(row["Runtime Support Status"] == "Implemented" for row in output_rows)
    return len(source_rows), len(output_rows), source_missing, implemented


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--items", type=Path,
        help="Source Items.csv (defaults to this repository's Pokefile).",
    )
    parser.add_argument(
        "--runtime", type=Path,
        help="Runtime items.ts (defaults to this repository's catalog).",
    )
    parser.add_argument(
        "--output", type=Path,
        help="Output CSV (defaults to pokefiles/output/Pokemon Items Reference.csv).",
    )
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    source = args.items or repo / "pokefiles" / "Items.csv"
    runtime = args.runtime or repo / "src" / "content" / "items.ts"
    output = args.output or repo / "pokefiles" / "output" / "Pokemon Items Reference.csv"
    source_count, output_count, missing_count, implemented_count = build(source, runtime, output)
    print(
        f"Wrote {output_count} entries from {source_count} source rows; "
        f"{missing_count} source descriptions are blank; "
        f"{implemented_count} entries have runtime definitions."
    )


if __name__ == "__main__":
    main()
