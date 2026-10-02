#!/usr/bin/env python3
"""Build a form-level Pokemon reference CSV from project files and pinned PokeAPI data."""

from __future__ import annotations

import argparse
import csv
import json
import re
import tempfile
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.request import Request, urlopen

POKEAPI_COMMIT = "89289e314ae20a34e8159a34a5fe646e656d6149"
POKEAPI_CSV_URL = (
    "https://raw.githubusercontent.com/PokeAPI/pokeapi/"
    f"{POKEAPI_COMMIT}/data/v2/csv/"
)
API_TABLES = (
    "abilities.csv", "evolution_triggers.csv", "generations.csv", "growth_rates.csv", "items.csv",
    "locations.csv", "move_names.csv", "pokemon.csv", "pokemon_abilities.csv",
    "pokemon_evolution.csv", "pokemon_form_generations.csv", "pokemon_forms.csv",
    "pokemon_move_methods.csv", "pokemon_moves.csv", "pokemon_species.csv",
    "region_names.csv", "regions.csv", "types.csv", "version_groups.csv",
)
COLUMNS = (
    "National Dex No.", "Dex/Form Key", "PokeAPI Pokemon ID", "Name", "Form",
    "Form Category", "Origin Region", "Form Region", "HP", "Attack", "Defense",
    "Special Attack", "Special Defense", "Speed", "Type 1", "Type 2",
    "Evolution Target(s)", "Evolution Level(s)", "Evolution Method(s)",
    "Evolution Conditions (all recorded versions)", "Ability Options",
    "Ability Data Status", "Learnset Moves (all recorded versions)",
    "Learnset Rules (methods/levels merged across versions)", "Learnset Data Status",
    "Available TMs (project TM list)", "TM Compatibility Source Version Group",
    "TM Compatibility Data Status", "Data Notes", "exp gain",
)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def normalize(value: str) -> str:
    value = "".join(
        char for char in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(char)
    )
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def dex_key(value: str) -> tuple[int, str]:
    match = re.match(r"\s*0*(\d+)(?:\s*\(([^)]+)\))?", value)
    if not match:
        raise ValueError(f"Cannot parse National Dex/form key: {value!r}")
    return int(match.group(1)), (match.group(2) or "").strip()


def as_int(value: str | None) -> int | None:
    return int(value) if value not in (None, "") else None


def is_true(value: str | None) -> bool:
    return value == "1"


def json_text(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def english_names(rows: list[dict[str, str]], key: str) -> dict[int, str]:
    return {
        int(row[key]): row["name"]
        for row in rows
        if row["local_language_id"] == "9"
    }


def humanize(identifier: str) -> str:
    return " ".join(part.capitalize() for part in identifier.replace("_", "-").split("-"))


def get_form_region(form: str) -> str:
    tokens = set(re.split(r"[^a-z0-9]+", form.casefold()))
    for token, region in (
        ("alola", "Alola"), ("galar", "Galar"),
        ("hisui", "Hisui"), ("paldea", "Paldea"),
    ):
        if token in tokens:
            return region
    return ""


def form_category(form: str, metadata: dict[str, str] | None) -> str:
    if not form:
        return "Default"
    normalized = normalize(form)
    if (metadata and is_true(metadata.get("is_mega"))) or "mega" in normalized:
        return "Mega"
    if "gmax" in normalized or "gigantamax" in normalized:
        return "Gigantamax"
    if get_form_region(form):
        return "Regional"
    if metadata and is_true(metadata.get("is_battle_only")):
        return "Battle-only"
    if normalized in {"male", "female"}:
        return "Gender"
    return "Alternate"


def load_tables(directory: Path) -> dict[str, list[dict[str, str]]]:
    return {name[:-4]: read_csv(directory / name) for name in API_TABLES}


def fetch_tables(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for name in API_TABLES:
        target = directory / name
        if target.exists() and target.stat().st_size:
            continue
        request = Request(
            POKEAPI_CSV_URL + name,
            headers={"User-Agent": "Pokemon Conquestlike reference CSV generator"},
        )
        with urlopen(request, timeout=90) as response:
            target.write_bytes(response.read())


def build(source_dir: Path, output: Path) -> tuple[int, int, int]:
    repo = Path(__file__).resolve().parents[1]
    stats_rows = read_csv(repo / "pokefiles" / "Pokemon Stats.csv")
    tm_rows = read_csv(repo / "pokefiles" / "TM.csv")
    ability_rows = read_csv(repo / "pokefiles" / "Abilities.csv")
    tables = load_tables(source_dir)

    pokemon = tables["pokemon"]
    species = tables["pokemon_species"]
    version_groups = tables["version_groups"]
    pokemon_by_id = {int(row["id"]): row for row in pokemon}
    species_by_id = {int(row["id"]): row for row in species}
    growth_rate_names = {
        int(row["id"]): {
            "medium": "Medium Fast",
            "medium-slow": "Medium Slow",
        }.get(row["identifier"], humanize(row["identifier"]))
        for row in tables["growth_rates"]
    }
    pokemon_by_species: dict[int, list[dict[str, str]]] = defaultdict(list)
    default_pokemon_by_species: dict[int, int] = {}
    for row in pokemon:
        sid = int(row["species_id"])
        pokemon_by_species[sid].append(row)
        if is_true(row["is_default"]):
            default_pokemon_by_species[sid] = int(row["id"])

    by_identifier = {normalize(row["identifier"]): row for row in pokemon}
    pokemon_id_by_source: dict[int, int] = {}
    source_by_pokemon_id: dict[int, dict[str, str]] = {}
    for index, row in enumerate(stats_rows):
        dex, _ = dex_key(row["dex no."])
        match = by_identifier.get(normalize(row["Name"]))
        if match is None or int(match["species_id"]) != dex:
            candidates = [
                item for item in pokemon_by_species.get(dex, [])
                if normalize(item["identifier"]) == normalize(row["Name"])
            ]
            if len(candidates) != 1:
                raise ValueError(
                    f"Cannot uniquely map source row {index + 2}: "
                    f"{row['dex no.']} / {row['Name']}"
                )
            match = candidates[0]
        pokemon_id = int(match["id"])
        if pokemon_id in source_by_pokemon_id:
            raise ValueError(f"Duplicate source mapping to PokeAPI Pokemon ID {pokemon_id}.")
        pokemon_id_by_source[index] = pokemon_id
        source_by_pokemon_id[pokemon_id] = row
    if len(source_by_pokemon_id) != len(pokemon):
        missing = sorted(set(pokemon_by_id) - set(source_by_pokemon_id))
        raise ValueError(
            f"Stats source maps {len(source_by_pokemon_id)} of {len(pokemon)} PokeAPI rows; "
            f"unmatched IDs: {missing[:12]}"
        )

    form_rows_by_pokemon: dict[int, list[dict[str, str]]] = defaultdict(list)
    form_by_id: dict[int, dict[str, str]] = {}
    for row in tables["pokemon_forms"]:
        form_rows_by_pokemon[int(row["pokemon_id"])].append(row)
        form_by_id[int(row["id"])] = row
    form_by_pokemon: dict[int, dict[str, str]] = {}
    for pokemon_id, pokemon_row in pokemon_by_id.items():
        candidates = form_rows_by_pokemon.get(pokemon_id, [])
        exact = [row for row in candidates
                 if normalize(row["identifier"]) == normalize(pokemon_row["identifier"])]
        defaults = [row for row in candidates if is_true(row["is_default"])]
        selected = exact or defaults or candidates
        if selected:
            form_by_pokemon[pokemon_id] = selected[0]

    def pokemon_name(pokemon_id: int | None) -> str:
        if pokemon_id is None:
            return ""
        if pokemon_id in source_by_pokemon_id:
            return source_by_pokemon_id[pokemon_id]["Name"]
        row = pokemon_by_id.get(pokemon_id)
        return humanize(row["identifier"]) if row else str(pokemon_id)

    def species_default_name(species_id: int) -> str:
        return pokemon_name(default_pokemon_by_species.get(species_id))

    regions = {int(row["id"]): row["identifier"] for row in tables["regions"]}
    region_names = english_names(tables["region_names"], "region_id")
    generations = {int(row["id"]): row for row in tables["generations"]}
    origin_region: dict[int, str] = {}
    for sid, row in species_by_id.items():
        generation = generations.get(int(row["generation_id"]))
        if generation:
            rid = int(generation["main_region_id"])
            origin_region[sid] = region_names.get(rid, humanize(regions.get(rid, "unknown")))

    # Per-form possible abilities, preserving slot and hidden-ability data.
    ability_identifiers = {
        int(row["id"]): row["identifier"] for row in tables["abilities"]
    }
    ability_names = {normalize(row["Name"]): row["Name"] for row in ability_rows}
    abilities_by_pokemon: dict[int, list[dict[str, object]]] = defaultdict(list)
    for row in tables["pokemon_abilities"]:
        identifier = ability_identifiers.get(int(row["ability_id"]), "")
        abilities_by_pokemon[int(row["pokemon_id"])].append({
            "name": ability_names.get(normalize(identifier), humanize(identifier)),
            "slot": int(row["slot"]),
            "hidden": is_true(row["is_hidden"]),
        })
    for options in abilities_by_pokemon.values():
        options.sort(key=lambda item: (item["slot"], item["hidden"]))

    move_names = english_names(tables["move_names"], "move_id")
    method_names = {
        int(row["id"]): row["identifier"] for row in tables["pokemon_move_methods"]
    }
    method_ids = {name: method_id for method_id, name in method_names.items()}
    group_by_id = {int(row["id"]): row for row in version_groups}
    group_order = {
        int(row["id"]): (int(row["order"]), row["identifier"])
        for row in version_groups
    }
    learnsets: dict[int, dict[tuple[int, int, int, int | None], set[int]]] = defaultdict(
        lambda: defaultdict(set)
    )
    recorded_groups_by_pokemon: dict[int, set[int]] = defaultdict(set)
    machine_moves_by_group: dict[tuple[int, int], set[int]] = defaultdict(set)
    machine_compatibility_groups: set[int] = set()
    sv_id = next(
        (int(row["id"]) for row in version_groups
         if row["identifier"] == "scarlet-violet"),
        None,
    )
    if sv_id is None:
        raise ValueError("Pinned PokeAPI data is missing Scarlet/Violet.")
    swsh_id = next(
        (int(row["id"]) for row in version_groups
         if row["identifier"] == "sword-shield"),
        None,
    )
    sv_order = group_order[sv_id][0]
    machine_id = method_ids.get("machine")
    for row in tables["pokemon_moves"]:
        pid = int(row["pokemon_id"])
        move_id = int(row["move_id"])
        method_id = int(row["pokemon_move_method_id"])
        group_id = int(row["version_group_id"])
        level = as_int(row["level"])
        mastery = as_int(row.get("mastery"))
        learnsets[pid][(move_id, method_id, level or 0, mastery)].add(group_id)
        recorded_groups_by_pokemon[pid].add(group_id)
        if method_id == machine_id:
            machine_compatibility_groups.add(group_id)
            machine_moves_by_group[(pid, group_id)].add(move_id)
    older_group_ids = sorted(
        (group_id for group_id, (order, _identifier) in group_order.items()
         if order < sv_order and group_id != swsh_id
         and group_id in machine_compatibility_groups),
        key=lambda group_id: group_order[group_id][0],
        reverse=True,
    )

    move_id_by_name = {normalize(name): mid for mid, name in move_names.items()}
    tms: list[tuple[str, str, int]] = []
    unmatched_tms = []
    for row in tm_rows:
        move_id = move_id_by_name.get(normalize(row["Name"]))
        if move_id is None:
            unmatched_tms.append(row["Name"])
        else:
            tms.append((row["TM No"], row["Name"], move_id))
    if unmatched_tms:
        raise ValueError("Unmatched project TM names: " + ", ".join(unmatched_tms))
    if len(tms) != len(tm_rows):
        raise ValueError("TM source numbers are not unique.")
    tms.sort(key=lambda item: int(re.search(r"\d+", item[0]).group(0)))

    form_generations: dict[int, list[int]] = defaultdict(list)
    for row in tables["pokemon_form_generations"]:
        form_generations[int(row["pokemon_form_id"])].append(int(row["generation_id"]))
    generation_for_form = {
        form_id: min(generations) for form_id, generations in form_generations.items()
    }

    trigger_names = {
        int(row["id"]): row["identifier"] for row in tables["evolution_triggers"]
    }
    item_names = {int(row["id"]): row["identifier"] for row in tables["items"]}
    location_names = {int(row["id"]): row["identifier"] for row in tables["locations"]}
    type_names = {int(row["id"]): row["identifier"] for row in tables["types"]}
    children_by_parent: dict[int, list[int]] = defaultdict(list)
    for row in species:
        if row["evolves_from_species_id"]:
            children_by_parent[int(row["evolves_from_species_id"])].append(int(row["id"]))
    evolution_by_child: dict[int, list[dict[str, str]]] = defaultdict(list)
    for row in tables["pokemon_evolution"]:
        evolution_by_child[int(row["evolved_species_id"])].append(row)

    def lookup(mapping: dict[int, str], value: str) -> str:
        number = as_int(value)
        return mapping.get(number, str(number)) if number is not None else ""

    def form_name(form_id_value: str) -> str:
        form_id = as_int(form_id_value)
        form = form_by_id.get(form_id) if form_id is not None else None
        return pokemon_name(int(form["pokemon_id"])) if form else ""

    def conditions(row: dict[str, str]) -> dict[str, object]:
        result: dict[str, object] = {}
        simple_ints = (
            ("minimum_level", "minimum_level"),
            ("minimum_happiness", "minimum_happiness"),
            ("minimum_beauty", "minimum_beauty"),
            ("minimum_affection", "minimum_affection"),
            ("minimum_move_count", "minimum_move_count"),
            ("minimum_steps", "minimum_steps"),
            ("minimum_damage_taken", "minimum_damage_taken"),
        )
        for source, target in simple_ints:
            if row[source] not in ("", "0"):
                result[target] = int(row[source])
        for source, target in (("trigger_item_id", "item"), ("held_item_id", "held_item")):
            if row[source]:
                result[target] = lookup(item_names, row[source])
        if row["gender_id"]:
            result["gender"] = {"1": "female", "2": "male"}.get(
                row["gender_id"], row["gender_id"]
            )
        if row["location_id"]:
            result["location"] = humanize(lookup(location_names, row["location_id"]))
        if row["time_of_day"]:
            result["time_of_day"] = row["time_of_day"]
        if row["known_move_id"]:
            result["known_move"] = move_names.get(int(row["known_move_id"]), row["known_move_id"])
        if row["known_move_type_id"]:
            result["known_move_type"] = humanize(lookup(type_names, row["known_move_type_id"]))
        if row["relative_physical_stats"]:
            result["relative_attack_defense"] = {
                "-1": "attack_below_defense", "0": "attack_equal_defense",
                "1": "attack_above_defense",
            }.get(row["relative_physical_stats"], row["relative_physical_stats"])
        if row["party_species_id"]:
            result["party_species"] = species_default_name(int(row["party_species_id"]))
        if row["party_type_id"]:
            result["party_type"] = humanize(lookup(type_names, row["party_type_id"]))
        if row["trade_species_id"]:
            result["trade_for_species"] = species_default_name(int(row["trade_species_id"]))
        for source in (
            "needs_overworld_rain", "turn_upside_down", "needs_multiplayer",
            "near_special_rock",
        ):
            if is_true(row[source]):
                result[source] = True
        if row["region_id"]:
            rid = int(row["region_id"])
            result["region"] = region_names.get(rid, humanize(regions.get(rid, str(rid))))
        if row["required_pokemon_form_id"]:
            result["required_form"] = form_name(row["required_pokemon_form_id"])
        if row["evolved_pokemon_form_id"]:
            result["result_form"] = form_name(row["evolved_pokemon_form_id"])
        if row["used_move_id"]:
            result["used_move"] = move_names.get(int(row["used_move_id"]), row["used_move_id"])
        if row["nature_bitmask"]:
            result["nature_bitmask"] = int(row["nature_bitmask"])
        if row["condition_expression"]:
            result["condition_expression"] = row["condition_expression"]
        if row["percentage_chance"]:
            result["percentage_chance"] = float(row["percentage_chance"])
        return result

    def method_summary(trigger: str, detail: dict[str, object]) -> str:
        label = {
            "level-up": "Level up", "use-item": "Use an item", "trade": "Trade",
            "shed": "Level up with an open party slot and a spare Pokeball",
            "spin": "Spin", "tower-of-darkness": "Tower of Darkness",
            "tower-of-waters": "Tower of Waters", "three-critical-hits": "Land three critical hits",
            "take-damage": "Take damage", "recoil-damage": "Take recoil damage",
            "other": "Special condition",
        }.get(trigger, humanize(trigger))
        requirements = []
        labels = (
            ("minimum_level", lambda v: f"level >= {v}"),
            ("item", lambda v: f"use {humanize(str(v))}"),
            ("held_item", lambda v: f"hold {humanize(str(v))}"),
            ("time_of_day", lambda v: str(v)),
            ("location", lambda v: f"at {v}"),
            ("minimum_happiness", lambda v: f"happiness >= {v}"),
            ("minimum_beauty", lambda v: f"beauty >= {v}"),
            ("minimum_affection", lambda v: f"affection >= {v}"),
            ("gender", lambda v: str(v)),
            ("known_move", lambda v: f"knows {v}"),
            ("region", lambda v: f"in {v}"),
            ("required_form", lambda v: f"form: {v}"),
            ("condition_expression", lambda v: str(v)),
        )
        for key, format_value in labels:
            if key in detail:
                requirements.append(format_value(detail[key]))
        return label + (" (" + ", ".join(requirements) + ")" if requirements else "")

    def evolution_events(pid: int) -> list[dict[str, object]]:
        pokemon_row = pokemon_by_id[pid]
        sid = int(pokemon_row["species_id"])
        current_form = form_by_pokemon.get(pid)
        current_form_id = int(current_form["id"]) if current_form else None
        current_is_default = current_form is None or is_true(current_form.get("is_default"))
        source_form = dex_key(source_by_pokemon_id[pid]["dex no."])[1]
        source_category = form_category(source_form, current_form)
        current_gen = generation_for_form.get(current_form_id)
        if current_gen is None:
            current_gen = int(species_by_id[sid]["generation_id"])
        result_by_signature: dict[str, dict[str, object]] = {}

        for child_id in children_by_parent.get(sid, []):
            records = evolution_by_child.get(child_id, [])
            matched = []
            for row in records:
                required_form = as_int(row["required_pokemon_form_id"])
                if required_form is not None and required_form != current_form_id:
                    continue
                group_id = as_int(row["version_group_id"])
                result_form_id = as_int(row["evolved_pokemon_form_id"])
                result_gen = (
                    generation_for_form.get(result_form_id)
                    if result_form_id is not None
                    else int(species_by_id[child_id]["generation_id"])
                )
                if group_id in group_by_id and not current_is_default:
                    group_gen = int(group_by_id[group_id]["generation_id"])
                    if group_gen < max(current_gen, result_gen or 1):
                        continue
                matched.append(row)

            if not matched and current_form_id is not None:
                default_pid = default_pokemon_by_species.get(sid)
                default_form = form_by_pokemon.get(default_pid) if default_pid else None
                default_form_id = int(default_form["id"]) if default_form else None
                if default_form_id != current_form_id and source_category in {
                    "Mega", "Gigantamax", "Battle-only", "Regional", "Alternate", "Gender"
                }:
                    for row in records:
                        required_form = as_int(row["required_pokemon_form_id"])
                        if required_form not in (None, default_form_id):
                            continue
                        group_id = as_int(row["version_group_id"])
                        if group_id in group_by_id and int(group_by_id[group_id]["generation_id"]) < current_gen:
                            continue
                        matched.append(row)

            if not matched and not records:
                default_pid = default_pokemon_by_species.get(child_id)
                target = pokemon_name(default_pid) or str(child_id)
                event = {"target": target, "trigger": "unknown", "conditions": {}, "versions": []}
                result_by_signature[json_text(event)] = event
                continue

            for row in matched:
                result_form_id = as_int(row["evolved_pokemon_form_id"])
                result_form = form_by_id.get(result_form_id) if result_form_id else None
                target_pid = int(result_form["pokemon_id"]) if result_form else default_pokemon_by_species.get(child_id)
                target = pokemon_name(target_pid) or species_default_name(child_id)
                trigger = trigger_names.get(int(row["evolution_trigger_id"]), "unknown")
                detail = conditions(row)
                group_id = as_int(row["version_group_id"])
                versions = [group_by_id[group_id]["identifier"]] if group_id in group_by_id else []
                payload = {"target": target, "trigger": trigger, "conditions": detail}
                signature = json_text(payload)
                event = result_by_signature.setdefault(signature, {**payload, "versions": []})
                for version in versions:
                    if version not in event["versions"]:
                        event["versions"].append(version)

        def order_version(name: str) -> int:
            return next((order for order, identifier in group_order.values() if identifier == name), 999)
        events = list(result_by_signature.values())
        for event in events:
            event["versions"].sort(key=order_version)
        events.sort(key=lambda event: (
            str(event["target"]).casefold(), str(event["trigger"]), json_text(event["conditions"])
        ))
        return events

    def effective_learnset_id(pid: int) -> tuple[int, str]:
        if learnsets.get(pid):
            return pid, "Direct PokeAPI records"
        local = source_by_pokemon_id[pid]
        category = form_category(dex_key(local["dex no."])[1], form_by_pokemon.get(pid))
        if category in {"Mega", "Gigantamax", "Battle-only"}:
            base_id = default_pokemon_by_species.get(int(pokemon_by_id[pid]["species_id"]))
            if base_id is not None and learnsets.get(base_id):
                return base_id, f"Inherited from default form (Pokemon ID {base_id})"
        return pid, "No learnset records in PokeAPI snapshot"

    def effective_tms(pid: int) -> tuple[set[int], str, str]:
        preferred_groups = [
            group_id for group_id in (sv_id, swsh_id)
            if group_id is not None and group_id in machine_compatibility_groups
        ]
        preferred_groups.extend(older_group_ids)
        available_groups = recorded_groups_by_pokemon.get(pid, set())
        for group_id in preferred_groups:
            if group_id in available_groups:
                source_group = group_by_id[group_id]["identifier"]
                return (
                    machine_moves_by_group.get((pid, group_id), set()),
                    source_group,
                    f"Direct {source_group} version-group records",
                )

        local = source_by_pokemon_id[pid]
        category = form_category(dex_key(local["dex no."])[1], form_by_pokemon.get(pid))
        if category in {"Mega", "Gigantamax", "Battle-only"}:
            base_id = default_pokemon_by_species.get(int(pokemon_by_id[pid]["species_id"]))
            if base_id is not None and base_id != pid:
                base_moves, source_group, base_status = effective_tms(base_id)
                if source_group:
                    return (
                        base_moves,
                        source_group,
                        f"Inherited from default form (Pokemon ID {base_id}); {base_status}",
                    )
        return set(), "", "No eligible version-group records for this form"

    rows: list[dict[str, object]] = []
    max_learnset_length = 0
    for index, source in enumerate(stats_rows):
        pid = pokemon_id_by_source[index]
        pokemon_row = pokemon_by_id[pid]
        sid = int(pokemon_row["species_id"])
        dex, form = dex_key(source["dex no."])
        metadata = form_by_pokemon.get(pid)
        category = form_category(form, metadata)
        types = [value.strip() for value in source["Type"].split("/") if value.strip()]
        ability_options = abilities_by_pokemon.get(pid, [])
        ability_status = (
            "Direct PokeAPI ability records" if ability_options
            else "No ability records in PokeAPI snapshot"
        )

        learnset_pid, learnset_status = effective_learnset_id(pid)
        combined: dict[tuple[int, int], dict[str, set[int]]] = defaultdict(
            lambda: {"levels": set(), "mastery": set()}
        )
        for (move_id, method_id, level, mastery), _version_ids in learnsets.get(
            learnset_pid, {}
        ).items():
            if level:
                combined[(move_id, method_id)]["levels"].add(level)
            if mastery is not None:
                combined[(move_id, method_id)]["mastery"].add(mastery)
        events = []
        for (move_id, method_id), details in combined.items():
            event = {
                "move": move_names.get(move_id, f"Move {move_id}"),
                "method": method_names.get(method_id, str(method_id)),
                "levels": sorted(details["levels"]),
            }
            if details["mastery"]:
                event["mastery"] = sorted(details["mastery"])
            events.append(event)
        events.sort(key=lambda event: (
            event["move"].casefold(), event["method"], event["levels"],
            event.get("mastery", []),
        ))
        move_names_cell = "; ".join(sorted(
            {event["move"] for event in events}, key=str.casefold
        ))
        learnset_json = json_text(events)
        max_learnset_length = max(max_learnset_length, len(learnset_json))

        tm_move_ids, tm_source_group, tm_status = effective_tms(pid)
        available_tms = [
            f"{number} {name}" for number, name, move_id in tms if move_id in tm_move_ids
        ]
        if tm_source_group and not available_tms:
            tm_status += "; no matching entries from the project TM.csv list"

        evolutions = evolution_events(pid)
        targets = list(dict.fromkeys(event["target"] for event in evolutions))
        species_id = int(pokemon_row["species_id"])
        if not targets and source["Evolves:"] and not children_by_parent.get(species_id):
            targets = [value.strip() for value in source["Evolves:"].split(";") if value.strip()]
        level_by_target: dict[str, set[int]] = defaultdict(set)
        method_summaries = []
        for event in evolutions:
            detail = event["conditions"]
            if "minimum_level" in detail:
                level_by_target[event["target"]].add(detail["minimum_level"])
            method_summaries.append(
                f"{event['target']}: {method_summary(event['trigger'], detail)}"
            )
        level_text = "; ".join(
            f"{target}: {', '.join(str(n) for n in sorted(levels))}"
            for target, levels in sorted(level_by_target.items(), key=lambda item: item[0].casefold())
        )
        notes = []
        if source["Evolves:"] and not evolutions and children_by_parent.get(sid):
            notes.append(
                "The source stat row names a species-level evolution, but PokeAPI has no form-specific evolution rule."
            )
        if not ability_options:
            notes.append("Ability assignment is absent from this PokeAPI snapshot.")
        if learnset_status.startswith("Inherited"):
            notes.append("The transformed form uses its default form's recorded learnset.")
        elif learnset_status.startswith("No learnset"):
            notes.append("No learnset records are present in this PokeAPI snapshot.")
        if tm_status.startswith("Inherited"):
            notes.append(f"TM compatibility uses the default form's {tm_source_group} record.")
        elif not tm_source_group:
            notes.append("No eligible version-group TM compatibility record is present for this form.")
        elif tm_source_group != "scarlet-violet":
            notes.append(f"TM compatibility falls back to the {tm_source_group} version group.")
        if tm_source_group and not available_tms:
            notes.append("No move from the selected source game's TM records matches the project's TM.csv list.")
        growth_rate_id = as_int(species_by_id[sid]["growth_rate_id"])
        if growth_rate_id not in growth_rate_names:
            raise ValueError(f"Missing experience growth rate for PokeAPI species ID {sid}.")

        rows.append({
            "National Dex No.": dex,
            "Dex/Form Key": source["dex no."],
            "PokeAPI Pokemon ID": pid,
            "Name": source["Name"],
            "Form": form or "Default",
            "Form Category": category,
            "Origin Region": origin_region.get(sid, ""),
            "Form Region": get_form_region(form),
            "HP": int(source["Hp"]),
            "Attack": int(source["Attack"]),
            "Defense": int(source["Defense"]),
            "Special Attack": int(source["Sp. Att"]),
            "Special Defense": int(source["Sp. Def"]),
            "Speed": int(source["Speed"]),
            "Type 1": types[0] if types else "",
            "Type 2": types[1] if len(types) > 1 else "",
            "Evolution Target(s)": "; ".join(targets),
            "Evolution Level(s)": level_text,
            "Evolution Method(s)": "; ".join(dict.fromkeys(method_summaries)),
            "Evolution Conditions (all recorded versions)": json_text(evolutions),
            "Ability Options": json_text(ability_options),
            "Ability Data Status": ability_status,
            "Learnset Moves (all recorded versions)": move_names_cell,
            "Learnset Rules (methods/levels merged across versions)": learnset_json,
            "Learnset Data Status": learnset_status,
            "Available TMs (project TM list)": "; ".join(available_tms),
            "TM Compatibility Source Version Group": tm_source_group,
            "TM Compatibility Data Status": tm_status,
            "Data Notes": " ".join(notes),
            "exp gain": growth_rate_names[growth_rate_id],
        })

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=COLUMNS, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(rows)
    no_abilities = sum(row["Ability Options"] == "[]" for row in rows)
    return len(rows), no_abilities, max_learnset_length


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, help="Use previously downloaded PokeAPI tables.")
    parser.add_argument("--output", type=Path, help="CSV destination; defaults to pokefiles/output.")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    output = (args.output or repo / "pokefiles" / "output" / "Pokemon Reference.csv").resolve()

    if args.source_dir:
        source_dir = args.source_dir.resolve()
        missing = [name for name in API_TABLES if not (source_dir / name).is_file()]
        if missing:
            raise FileNotFoundError("Missing source tables: " + ", ".join(missing))
        result = build(source_dir, output)
    else:
        with tempfile.TemporaryDirectory(prefix="pokemon-reference-") as temporary:
            source_dir = Path(temporary)
            fetch_tables(source_dir)
            result = build(source_dir, output)

    rows, no_abilities, max_learnset_length = result
    print(f"Wrote {rows} Pokemon/form rows to {output}")
    print(f"Rows without ability data: {no_abilities}")
    print(f"Largest learnset JSON cell: {max_learnset_length} characters")


if __name__ == "__main__":
    main()
