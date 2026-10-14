#!/usr/bin/env python3
"""Build the review learnset CSV from Pokemon Stats and pinned PokeAPI data."""

from __future__ import annotations

import argparse
import csv
import tempfile
from collections import defaultdict
from pathlib import Path

import generate_pokemon_reference_csv as reference


COLUMNS = ("Dex No.", "Pokemon", "Learnset (level-learned;move)")


def build(source_dir: Path, stats_path: Path, reference_path: Path, output: Path) -> tuple[int, int, int]:
    stats_rows = reference.read_csv(stats_path)
    reference_rows = reference.read_csv(reference_path)
    reference_by_key = {row["Dex/Form Key"]: row for row in reference_rows}
    if len(reference_by_key) != len(reference_rows):
        raise ValueError("Pokemon Reference.csv contains duplicate Dex/Form Keys.")

    stats_keys = [row["dex no."] for row in stats_rows]
    missing = [key for key in stats_keys if key not in reference_by_key]
    if missing:
        raise ValueError(
            "Pokemon Reference.csv is missing Stats rows: " + ", ".join(missing[:10])
        )
    if len(stats_rows) != len(reference_rows):
        raise ValueError(
            f"Pokemon Stats has {len(stats_rows)} rows but Pokemon Reference has "
            f"{len(reference_rows)}."
        )

    tables = reference.load_tables(source_dir)
    pokemon_rows = {int(row["id"]): row for row in tables["pokemon"]}
    default_pokemon_by_species = {
        int(row["species_id"]): int(row["id"])
        for row in tables["pokemon"]
        if row["is_default"] == "1"
    }
    version_groups = {
        int(row["id"]): row for row in tables["version_groups"]
    }
    group_order = {
        group_id: (int(row["order"]), row["identifier"])
        for group_id, row in version_groups.items()
    }
    level_up_id = next(
        int(row["id"])
        for row in tables["pokemon_move_methods"]
        if row["identifier"] == "level-up"
    )
    move_names = reference.english_names(tables["move_names"], "move_id")

    # Choose one version group per exact PokeAPI Pokemon ID. Positive levels only:
    # level 0 denotes reminder/evolution data, not a level learned.
    moves_by_pokemon_group: dict[int, dict[int, list[tuple[int, int, int, str]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for row in tables["pokemon_moves"]:
        if int(row["pokemon_move_method_id"]) != level_up_id:
            continue
        level = int(row["level"] or 0)
        move_id = int(row["move_id"])
        if level <= 0 or move_id not in move_names:
            continue
        pokemon_id = int(row["pokemon_id"])
        group_id = int(row["version_group_id"])
        order = int(row["order"]) if row.get("order") else 0
        moves_by_pokemon_group[pokemon_id][group_id].append(
            (level, order, move_id, move_names[move_id])
        )

    pokemon_by_key = {
        key: int(row["PokeAPI Pokemon ID"])
        for key, row in reference_by_key.items()
    }
    def events_for(pokemon_id: int) -> tuple[list[tuple[int, int, int, str]], int | None]:
        groups = moves_by_pokemon_group.get(pokemon_id, {})
        if not groups:
            return [], None
        selected_group = max(groups, key=lambda group_id: group_order[group_id][0])
        events = groups[selected_group]
        # Keep distinct (level, move) pairs and retain source order for ties.
        unique = {(level, move_id): (level, order, move_id, name)
                  for level, order, move_id, name in events}
        return sorted(unique.values(), key=lambda event: (
            event[0], event[1] or 2**31, event[3].casefold(), event[2]
        )), selected_group

    rows: list[dict[str, str]] = []
    direct_count = 0
    inherited_count = 0
    empty_count = 0
    selected_group_counts: dict[str, int] = defaultdict(int)
    for source in stats_rows:
        key = source["dex no."]
        pokemon_id = pokemon_by_key[key]
        events, selected_group = events_for(pokemon_id)
        if events:
            direct_count += 1
        else:
            species_id = int(pokemon_rows[pokemon_id]["species_id"])
            default_id = default_pokemon_by_species.get(species_id)
            if default_id is not None and default_id != pokemon_id:
                events, selected_group = events_for(default_id)
                if events:
                    inherited_count += 1
            if not events:
                empty_count += 1

        if selected_group is not None:
            selected_group_counts[version_groups[selected_group]["identifier"]] += 1
        learnset = " | ".join(f"{level};{name}" for level, _order, _id, name in events)
        national_dex, _form = reference.dex_key(key)
        rows.append({
            "Dex No.": str(national_dex),
            "Pokemon": source["Name"],
            "Learnset (level-learned;move)": learnset,
        })

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=COLUMNS, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} Pokemon/form rows to {output}")
    print(f"Direct level-up data: {direct_count}; inherited default form: {inherited_count}; empty source: {empty_count}")
    print("Selected version groups: " + ", ".join(
        f"{name}={count}" for name, count in sorted(selected_group_counts.items())
    ))
    return len(rows), inherited_count, empty_count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, help="Use previously downloaded PokeAPI tables.")
    parser.add_argument("--stats", type=Path, help="Pokemon Stats.csv path.")
    parser.add_argument("--reference", type=Path, help="Pokemon Reference.csv path.")
    parser.add_argument("--output", type=Path, help="CSV destination; defaults to pokefiles/for checking.")
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[1]
    stats_path = (args.stats or repo / "pokefiles" / "Pokemon Stats.csv").resolve()
    reference_path = (args.reference or repo / "pokefiles" / "for checking" / "Pokemon Reference.csv").resolve()
    output = (args.output or repo / "pokefiles" / "for checking" / "Pokemon Learnset.csv").resolve()

    if args.source_dir:
        source_dir = args.source_dir.resolve()
        missing = [name for name in reference.API_TABLES if not (source_dir / name).is_file()]
        if missing:
            raise FileNotFoundError("Missing source tables: " + ", ".join(missing))
        build(source_dir, stats_path, reference_path, output)
    else:
        with tempfile.TemporaryDirectory(prefix="pokemon-learnset-") as temporary:
            source_dir = Path(temporary)
            reference.fetch_tables(source_dir)
            build(source_dir, stats_path, reference_path, output)


if __name__ == "__main__":
    main()
