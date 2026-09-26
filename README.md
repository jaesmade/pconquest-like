# Pokémon Tactics Roguelike — playable prototype

This early browser build turns the [design plan](docs/PLAN.md) into a short tactical run. It uses original generic placeholder sprites, not Pokémon artwork. The battle board is Phaser, menus are React, and combat rules and content are TypeScript.

## Run in Docker

```powershell
docker build -t pokemon-tactics:dev .
docker run -d --name pokemon-tactics -p 8080:80 pokemon-tactics:dev
```

Open <http://localhost:8080>. On systems with the Docker Compose plugin, `docker compose up --build -d` uses [compose.yaml](compose.yaml). To stop the direct container: `docker stop pokemon-tactics`.

For local development: `npm install` and `npm run dev`, then open the Vite URL printed in the terminal.

## What is playable

- Choose one of six starters. Two companions join; route recruitment grows the party to six. Select up to three healthy Pokémon for each battle.
- Four encounters on authored square maps, currently 8×8, with elevation, deep water, lava, a boss capture point, and snow, sun, rain, or sandstorm starting weather. Swimmers show a water ripple; flying forms float above a shadow. The renderer and range calculations accept other rectangular map sizes.
- Round-based Action Points: each living Pokémon takes one turn per round, ordered by effective Speed with random ties. At its turn it gains AP equal to its effective Speed rounded down (minimum 1). Movement spends AP for every tile along its route; moves and usable held items have AP costs. It may use one Attack command per turn, including a Status move, while movement and Special remain available with leftover AP. Up to the largest move or item AP cost can carry into its next turn.
- Selecting a move highlights its range and affected area. Reachable enemies show type-effectiveness labels on the grid and matchup details in the action panel before confirmation.
- The supplied 18-type chart, dual-type multiplication, STAB, a 1-in-24 critical chance, abilities, terrain hazards, weather effects, basic statuses, line of sight, and enemy actions.
- Enemy decisions and pathfinding yield between bounded work batches; one enemy action resolves at a time so the board can render its animation before the next action.
- XP goes to the whole party after a win. Eligible Pokémon learn moves and can evolve between encounters. Held items include Leftovers, Sitrus Berry, Assault Vest, X Attack, and Charmander's compatible Mega Stone.
- Browser local storage preserves the current run and the win count after refresh. Saves use a versioned envelope. Earlier mid-battle saves resume at preparation for the same encounter after the attack-limit update.

## Growing the game

The [extension guide](docs/SCALING.md) maps the content files, stable IDs, encounter and map contracts, save migration, and the remaining engine rules that need a new handler when expanded. Abilities and held items live in [abilities.ts](src/content/abilities.ts) and [items.ts](src/content/items.ts). The content catalog checks references at startup. Battle rendering loads when an encounter begins, keeping the initial menus separate from Phaser.

## Placeholder assets

The [animation asset guide](docs/ANIMATION_ASSETS.md) describes filenames, sheet layout, direction rows, frame ranges, all 15 move-specific attack effects, and replacement steps. The runtime reads [animation-manifest.json](public/assets/animations/animation-manifest.json). Named starter sheets are included; other forms use the `placeholder` sheet until their artwork is added. Attack effects are queued on the board so quick enemy turns do not overwrite them.

## Still planned

This is a first implementation pass. Enemy decisions are still basic. The UI does not yet show a full path preview or line-of-sight overlay, animation playback is immediate rather than a locked combat timeline, and route choices and rewards need more variety. See [the design plan](docs/PLAN.md) for the complete intended build and [the UI overhaul plan](docs/UI_OVERHAUL_PLAN.md) for the next interface pass.
