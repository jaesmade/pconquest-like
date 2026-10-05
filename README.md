# Pokémon Tactics Roguelike — playable prototype

This early browser build turns the [design plan](docs/PLAN.md) into a tactical run. It uses a shared temporary animation set and portrait until species-specific art is added. The battle board is Phaser, menus are React, and combat rules and content are TypeScript.

The [project master record](docs/PROJECT_MASTER.md) indexes the design documents and records completed changes. Future work is logged there.

Read the [detailed game description](docs/GAME_DESCRIPTION.md) for an overview of the run, battle systems, progression, and planned artifacts.

## Run locally

```powershell
npm install
npm run dev -- --host 127.0.0.1 --port 8080
```

Open <http://localhost:8080>. Drag the battlefield with the mouse to pan; click a tile to interact, use the wheel to zoom, or use the camera controls beside the minimap.

Run `npm run build` for the production build, `npm run playthrough` for scripted campaign/Battle Lab checks, `npm run verify:targeting` for exhaustive targeting and planner equivalence, `npm run measure:save` for clone/save/restore timings and fingerprint checks, and `npm run measure:catalog` for startup validation work counts, timings, and terrain-mutation checks. Measurement scope and limitations are in the [optimization audit](docs/SCALABILITY_AUDIT.md); browser fixture instructions are in the [render profile](docs/RENDER_PROFILE.md).

## What is playable

The [Battle Lab](docs/BATTLE_LAB.md) is a small 1v1 arena where you control both sides, choose species, level, held item, weather, and seed, then inspect animation playback and damage ranges without changing the saved run.

- Draft a starting roster with six points. A run can own 20 Pokémon and deploy up to six healthy members. Choose their positions directly on the top-down preparation map.
- Pick a path through a [ten-column cavern route](docs/ROUTE_OVERHAUL.md), ending at a boss in column ten. Five 16×16 normal forests rotate through the campaign, with a dedicated elite lake and an 8×8 boss arena with a raised stone dais, capture seal, ancient trees, and standing stones. Forests have elevation, clear ramps, dirt trails, logs, stumps, varied vegetation, and grounded routes around deep water. Swimmers show a water ripple; flying forms float above a shadow. The route also offers full-party healing, a coin shop, and recruitment events.
- Speed-based Action Value turns: each unit starts at AV 0, and the living unit with the lowest next-action time acts next. Its next turn is scheduled at `current AV + 10,000 / effective Speed`; Speed changes rescale its remaining wait, and action advance or delay effects adjust that wait directly. Each turn grants 3 AP, added to unused AP banked from earlier turns in that battle. A Pokémon may move once per turn for 1 AP, up to its Movement tile range, and use one Attack command (including a Status move). Moves and usable held items keep their listed AP costs; Special actions remain available with leftover AP.
- Selecting a move highlights its range and affected area. Reachable enemies show type-effectiveness labels on the grid and matchup details in the action panel before confirmation.
- [Ranked enemies and level-scaled teams](docs/PLAN.md#proposed-enemy-ranks-and-automatic-latest-four-movesets): 3–8 Normals, Elite teams of 1–3 Elites plus 3–5 Normals, and Boss teams of one Boss plus 0–2 Elites and 2–5 Normals. Elites receive 2× and Bosses 3× combat stats, including Speed, separate from temporary stages. Preparation lists ranks and actual moves; the current level-21 Boss fields eight enemies.
- The supplied 18-type chart, dual-type multiplication, STAB, a 1-in-24 critical chance, abilities, terrain hazards, weather effects, basic statuses, line of sight, and enemy actions.
- Enemy decisions and pathfinding yield between bounded work batches; one enemy action resolves at a time so the board can render its animation before the next action.
- XP goes to deployed participants after a win, including fainted battlers; reserves receive none. New recruits and wild Pokémon start with their latest four level-eligible moves. Owned Pokémon keep chosen slots and manually accept or decline level-up moves; TMs and evolution remain available. Held items include Leftovers, Sitrus Berry, Assault Vest, X Attack, and Charmander's compatible Mega Stone.
- IndexedDB preserves the current run and the win count after refresh. Save schema v27 stores enemy ranks and resumes new battles without rerolling or reapplying stat multipliers. Active older battles restart at preparation; owned progression, chosen/TM moves, route history, and pending level-up choices are retained.

## Growing the game

The [extension guide](docs/SCALING.md) maps the content files, stable IDs, encounter and map contracts, save migration, and the remaining engine rules that need a new handler when expanded. The [balance baseline](docs/BALANCE.md) records the current run curve; the [experience growth plan](docs/EXP_GROWTH_PLAN.md) describes the proposed species-specific XP implementation. Abilities and held items live in [abilities.ts](src/content/abilities.ts) and [items.ts](src/content/items.ts). The content catalog checks references at startup. Battle rendering loads when an encounter begins, keeping the initial menus separate from Phaser.

Source layout: [main.tsx](src/main.tsx) loads and mounts the game; [App.tsx](src/app/App.tsx) coordinates run state and battle actions; `src/ui/` contains the individual screens; `src/styles/` groups their CSS in import order. Content definitions, game rules, persistence, audio, and Phaser rendering live in their respective `src/` folders. See the extension guide for where to make each kind of change.

## Placeholder assets

The battlefield uses a [replaceable top-down tile family](docs/ISOMETRIC_ASSETS.md) with original Mystery Dungeon-inspired forest art, moss, paths, cardinal ledges and shorelines, broadleaf/pine trees, logs, stumps, ferns, and mushrooms. With the development server running, review all seven maps at [`/docs/FOREST_MAP_PREVIEW.html`](docs/FOREST_MAP_PREVIEW.html); run `npm run verify:forest` to check navigation, ramps, collisions, art registration, and campaign selection. The route uses a separate [decorative tile backdrop](docs/ROUTE_OVERHAUL.md). Its square combat rules remain unchanged; the renderer draws square cells, units, paths, and attack effects in a non-isometric top-down view, with allies facing up and enemies facing down. Pokémon sheets remain named placeholders.

The [animation asset guide](docs/ANIMATION_ASSETS.md) describes filenames, sheet layout, direction rows, frame ranges, all 15 move-specific attack effects, and replacement steps. The runtime reads [animation-manifest.json](public/assets/animations/animation-manifest.json). Named starter sheets are included; other forms use the `placeholder` sheet until their artwork is added. Attack effects are queued on the board so quick enemy turns do not overwrite them.

The [unit, move, and ability authoring guide](docs/UNIT_MOVE_ABILITY_ASSETS.md) gives the file naming rules and step-by-step manifest registration for replacement art and sounds.

New moves can use six [assignable visual placeholders](docs/MOVE_PLACEHOLDER_PREVIEW.png) and matching sound cues for melee, projectile, area, self, hazard, and weather effects. Set a move's `visualId` and `soundId`, or let the renderer and audio system choose by move shape. Adding a named sheet or sound keyed by the move ID replaces its placeholder without changing battle rules.

The [audio asset guide](docs/AUDIO_ASSETS.md) lists original placeholder music, move sounds, item sounds, and shared cues, with replacement instructions. The runtime reads [audio-manifest.json](public/assets/audio/audio-manifest.json); the top bar has a persistent Sound On/Off control.

## Still planned

This is a first implementation pass. Enemy decisions are still basic, and special encounters currently offer one simple reward choice. See [the design plan](docs/PLAN.md) for the complete intended build and [the UI overhaul plan](docs/UI_OVERHAUL_PLAN.md) for the next interface pass.
