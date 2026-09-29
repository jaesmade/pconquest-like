# Pokémon Tactics Roguelike — playable prototype

This early browser build turns the [design plan](docs/PLAN.md) into a tactical run. It uses a shared temporary animation set and portrait until species-specific art is added. The battle board is Phaser, menus are React, and combat rules and content are TypeScript.

The [project master record](docs/PROJECT_MASTER.md) indexes the design documents and records completed changes. Future work is logged there.

## Run locally

```powershell
npm install
npm run dev -- --host 127.0.0.1 --port 8080
```

Open <http://localhost:8080>. Drag the battlefield with the mouse to pan; click a tile to interact, use the wheel to zoom, or use the camera controls beside the minimap.

## What is playable

The [Battle Lab](docs/BATTLE_LAB.md) is a small 1v1 arena where you control both sides, choose species, level, held item, weather, and seed, then inspect animation playback and damage ranges without changing the saved run.

- Draft a starting roster with six points. A run can own 20 Pokémon and deploy up to six healthy members. Choose their positions directly on the isometric preparation map.
- Pick a path through a [ten-column cavern route](docs/ROUTE_OVERHAUL.md), ending at a boss in column ten. Normal and elite battles, full-party healing, a coin shop, and a simple recruit-or-coins special encounter use authored square battle maps, currently 8×8. Maps include elevation, deep water, lava, a boss capture point, and varied weather. Swimmers show a water ripple; flying forms float above a shadow.
- Speed-based Action Value turns: each unit starts at AV 0, and the living unit with the lowest next-action time acts next. Its next turn is scheduled at `current AV + 10,000 / effective Speed`; Speed changes rescale its remaining wait, and action advance or delay effects adjust that wait directly. Each turn grants 3 AP, added to unused AP banked from earlier turns in that battle. A Pokémon may move once per turn for 1 AP, up to its Movement tile range, and use one Attack command (including a Status move). Moves and usable held items keep their listed AP costs; Special actions remain available with leftover AP.
- Selecting a move highlights its range and affected area. Reachable enemies show type-effectiveness labels on the grid and matchup details in the action panel before confirmation.
- The supplied 18-type chart, dual-type multiplication, STAB, a 1-in-24 critical chance, abilities, terrain hazards, weather effects, basic statuses, line of sight, and enemy actions.
- Enemy decisions and pathfinding yield between bounded work batches; one enemy action resolves at a time so the board can render its animation before the next action.
- XP goes to the whole party after a win. Eligible Pokémon learn moves and can evolve between encounters. Held items include Leftovers, Sitrus Berry, Assault Vest, X Attack, and Charmander's compatible Mega Stone.
- IndexedDB preserves the current run and the win count after refresh. Save schema v22 migrates earlier round-based battle queues and timer values to the AV timeline while preserving the current actor, and defaults the per-turn movement flag for earlier saves.

## Growing the game

The [extension guide](docs/SCALING.md) maps the content files, stable IDs, encounter and map contracts, save migration, and the remaining engine rules that need a new handler when expanded. The [balance baseline](docs/BALANCE.md) records the current run curve. Abilities and held items live in [abilities.ts](src/content/abilities.ts) and [items.ts](src/content/items.ts). The content catalog checks references at startup. Battle rendering loads when an encounter begins, keeping the initial menus separate from Phaser.

Source layout: [main.tsx](src/main.tsx) loads and mounts the game; [App.tsx](src/app/App.tsx) coordinates run state and battle actions; `src/ui/` contains the individual screens; `src/styles/` groups their CSS in import order. Content definitions, game rules, persistence, audio, and Phaser rendering live in their respective `src/` folders. See the extension guide for where to make each kind of change.

## Placeholder assets

The battlefield now uses a [replaceable isometric tile family](docs/ISOMETRIC_ASSETS.md) and a generated reference-inspired title backdrop. The route uses a separate [generated cavern backdrop](docs/ROUTE_OVERHAUL.md). Its square combat rules remain unchanged; the renderer projects cells, units, paths, and attack effects into the new view. Pokémon sheets remain named placeholders.

The [animation asset guide](docs/ANIMATION_ASSETS.md) describes filenames, sheet layout, direction rows, frame ranges, all 15 move-specific attack effects, and replacement steps. The runtime reads [animation-manifest.json](public/assets/animations/animation-manifest.json). Named starter sheets are included; other forms use the `placeholder` sheet until their artwork is added. Attack effects are queued on the board so quick enemy turns do not overwrite them.

The [unit, move, and ability authoring guide](docs/UNIT_MOVE_ABILITY_ASSETS.md) gives the file naming rules and step-by-step manifest registration for replacement art and sounds.

New moves can use six [assignable visual placeholders](docs/MOVE_PLACEHOLDER_PREVIEW.png) and matching sound cues for melee, projectile, area, self, hazard, and weather effects. Set a move's `visualId` and `soundId`, or let the renderer and audio system choose by move shape. Adding a named sheet or sound keyed by the move ID replaces its placeholder without changing battle rules.

The [audio asset guide](docs/AUDIO_ASSETS.md) lists original placeholder music, move sounds, item sounds, and shared cues, with replacement instructions. The runtime reads [audio-manifest.json](public/assets/audio/audio-manifest.json); the top bar has a persistent Sound On/Off control.

## Still planned

This is a first implementation pass. Enemy decisions are still basic, and special encounters currently offer one simple reward choice. See [the design plan](docs/PLAN.md) for the complete intended build and [the UI overhaul plan](docs/UI_OVERHAUL_PLAN.md) for the next interface pass.
