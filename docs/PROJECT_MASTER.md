# Project master record

This is the running record of changes to the playable game. Read the linked topic document for full rules, asset specifications, or design intent. The entries below describe work visible in the repository; a dated entry does not by itself mean the feature was playtested. Git history remains the source for exact line-by-line changes.

## How to maintain this record

For every future task that changes code, assets, behavior, or project documentation, add a dated entry at the top of **Recent changes** before finishing the task. State what changed, why, the main files or topic document, and what was checked. Keep entries short but specific enough that another developer can locate the implementation. Update the linked topic document when its behavior or instructions change. Add a new topic document in `docs/` only when an existing one does not cover the subject. Do not describe a plan as implemented until code and assets are present.

## Documentation map

| Subject | Canonical document |
| --- | --- |
| Game scope and rules | [Early build plan](PLAN.md) |
| Route, rewards, recruitment, deployment | [Route overhaul](ROUTE_OVERHAUL.md) |
| Party drafting | [Party builder](PARTY_BUILDER.md) |
| Battle balance | [Balance baseline](BALANCE.md) |
| Gameplay gaps and decisions | [Mechanics audit](GAMEPLAY_MECHANICS_AUDIT.md) |
| Extending content and saved state | [Scaling guide](SCALING.md) |
| Rendering and size limits | [Scalability targets](SCALABILITY_TARGETS.md), [render profile](RENDER_PROFILE.md) |
| UI direction | [UI overhaul plan](UI_OVERHAUL_PLAN.md), [start screen](START_SCREEN_OVERHAUL.md) |
| Environment art | [Isometric assets](ISOMETRIC_ASSETS.md) |
| Unit, move, and ability art workflow | [Asset authoring guide](UNIT_MOVE_ABILITY_ASSETS.md), [animation guide](ANIMATION_ASSETS.md) |
| Sounds and music | [Audio guide](AUDIO_ASSETS.md) |
| Controlled combat sandbox | [Battle Lab](BATTLE_LAB.md) |

## Recent changes

### 2026-09-28 — Reference-matched route UI and four-node branches

- Rebuilt the route screen around the supplied references: a full-screen isometric stone grid, raised layered nodes, cyan links, cyan-glowing choices with amber pointers, a lead-Pokémon marker, coin and party controls, a responsive translucent party overlay, and a compact title return control.
- Expanded seeded route generation from fixed two-node middle columns to two through four nodes, with four-node layouts guaranteed in columns 4 and 7. Save schema v18 remaps v16–v17 progress onto the expanded graph.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, `src/game/route.ts`, `src/persistence/save.ts`, `src/app/App.tsx`. Updated [route behavior](ROUTE_OVERHAUL.md), [UI direction](UI_OVERHAUL_PLAN.md), and the [scaling guide](SCALING.md). Production build completed; 50 generated seeds passed node-count checks; the route and party overlay were reviewed at 1920×1080 and 390×844.

### 2026-09-28 — Isometric route selector tiles

- Changed the route graph presentation to raised diamond tiles with pale stone sides, colored encounter tops, blue connecting paths, and an isometric grid backdrop to follow the supplied reference. Route rules and keyboard selection remain the same.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`. Updated [route behavior](ROUTE_OVERHAUL.md). Local production build completed.

### 2026-09-28 — Four-move loadouts and cross-shaped move menu

- Every current species and form has four distinct starting moves, with five basic moves added to fill type and range gaps. New and recruited Pokémon equip four moves; later level unlocks remain learned and can replace any preparation slot. Selecting an already equipped move swaps its slot. Enemies and Battle Lab use four-move default loadouts, and v17 save migration expands earlier two-slot runs and active battles.
- The Attack menu now places four move buttons above, left, right, and below its central Back button, matching the supplied image. Move descriptions remain in a separate tooltip so hover does not shift the menu.
- Main files: `src/content/moves.ts`, `src/content/species.ts`, `src/game/engine.ts`, `src/ui/PrepareScreen.tsx`, `src/ui/BattleScreen.tsx`, `src/styles/battle-menu.css`, `src/persistence/save.ts`. Updated the [rules](PLAN.md), [UI plan](UI_OVERHAUL_PLAN.md), [Battle Lab](BATTLE_LAB.md), [balance notes](BALANCE.md), and [scaling guide](SCALING.md). Local production build completed; no gameplay test was run.

### 2026-09-28 — Battle menu anchor and hover correction

- Kept the action menu centered above the acting Pokémon whenever viewport space permits. Move descriptions now render in a separate, pointer-transparent tooltip, so hover no longer changes the menu height or moves buttons under the pointer. Attack and movement targeting now show only Back in the menu; their ranges remain visible on the board.
- Main files: `src/ui/BattleScreen.tsx`, `src/styles/battle-menu.css`. Updated the [UI overhaul plan](UI_OVERHAUL_PLAN.md). Local production build completed; no gameplay test was run.

### 2026-09-28 — Floating translucent battle commands

- Removed the contextual menu's outer panel and connector. The command buttons and supporting move information use see-through glass surfaces, and the menu tracks above the active Pokémon or moves below it when the top HUD blocks the space. Narrow screens use the same unit anchor instead of a bottom sheet.
- Main files: `src/ui/BattleScreen.tsx`, `src/styles/battle-menu.css`, `src/styles/battle.css`, `src/styles/battle-actions.css`. Updated the [UI overhaul plan](UI_OVERHAUL_PLAN.md). Local production build completed; no gameplay test was run.

### 2026-09-28 — Glass battle action menu and move choice

- Reworked the contextual battle popup to match the supplied sketch: four main commands, a small move grid with hover/focus descriptions, compact targeting and movement range states, Back and Use Item for Special, and Yes/No confirmation for End. The map still commits attacks and movement by tile click, and existing range/effectiveness overlays remain authoritative.
- Main files: `src/ui/BattleScreen.tsx`, `src/app/App.tsx`, `src/styles/battle-menu.css`, `src/main.tsx`. Updated the [UI overhaul plan](UI_OVERHAUL_PLAN.md), [Battle Lab guide](BATTLE_LAB.md), and [scaling guide](SCALING.md). Local production build completed; no gameplay test was run.

### 2026-09-28 — Master record established

- Added this document as the documentation index and running change record, linked it from `README.md`, and added the update rule to `AGENTS.md` so later changes are recorded here.
- Reviewed the existing docs, working tree, and Git history to backfill the entries below. No gameplay behavior changed for this entry.

### 2026-09-28 — Special-node recruitment at a full roster

- The special encounter now lets the player select a recruit and confirm which owned Pokémon leaves when the roster is at 20. The engine validates the offered species and replacement ID, returns a held item to the bag, transfers the selected party slot, and advances the route. The 18-coin reward remains available.
- Main files: `src/game/engine.ts`, `src/ui/RouteStopScreen.tsx`, `src/app/App.tsx`, `src/styles/route.css`. Updated [route behavior](ROUTE_OVERHAUL.md) and the [mechanics audit](GAMEPLAY_MECHANICS_AUDIT.md). Local production build completed; no gameplay test was run.

### 2026-09-28 — Unit, move, and ability asset authoring guide

- Added [asset authoring instructions](UNIT_MOVE_ABILITY_ASSETS.md) for unit sheet sizes and facings, portraits and shadows, named move effects and sounds, ability trigger sounds, file naming, manifest registration, and replacement checks. Linked it from the README and related asset docs.
- Documentation only; the guide records that ability triggers currently have named sounds and text callouts, while per-ability artwork requires renderer support.

### 2026-09-28 — Assignable placeholders for future moves

- Added six four-frame move effect sheets and matching WAV cues for melee, projectile, area, self, hazard, and weather roles. New moves select role assets automatically or through optional `visualId` and `soundId`; a named manifest entry keyed by the move ID takes priority. Added startup checks for unknown asset IDs.
- Main files: `src/content/moveAssetRoles.ts`, `src/battle/moveVisuals.ts`, `src/battle/Board.tsx`, `src/audio/audio.ts`, the animation and audio manifests, and the placeholder generators. See the [visual preview](MOVE_PLACEHOLDER_PREVIEW.png), [animation guide](ANIMATION_ASSETS.md), and [audio guide](AUDIO_ASSETS.md). Local production build and asset format checks completed.

### 2026-09-28 — Shared interface palette

- Added `src/styles/theme.css` and loaded it after the screen styles to align menu, route, preparation, reward, and battle HUD colors and control treatments. Updated the [UI overhaul plan](UI_OVERHAUL_PLAN.md) and [scaling guide](SCALING.md). This is a styling pass; gameplay rules are unchanged.

## Earlier committed milestones

These are compact backfilled summaries of the existing commit history, ordered newest first. Each hash identifies the exact committed change; the topic documents above describe the current implementation, which may have evolved since that commit.

| Date | Commit | Change |
| --- | --- | --- |
| 2026-09-28 | `7a7580d` | Split the app controller and screens from `main.tsx`; grouped CSS by screen and updated structure docs. |
| 2026-09-28 | `217e0fd` | Added the ten-column route, battle and reward nodes, shop, isometric deployment screen, and save migration. |
| 2026-09-28 | `ed22eac` | Overhauled title and party-selection UI, starting point budget, roster cap, and unit portrait mapping. |
| 2026-09-27 | `f9f7f9b` | Imported shared unit animation and shadow sheets, then aligned shadows with unit clips. |
| 2026-09-27 | `e711c7e` | Added floating damage and healing numbers and timing cues. |
| 2026-09-27 | `17aa670` | Improved tile-click attacks and moves, board targeting, and Battle Lab interaction. |
| 2026-09-27 | `3fe72d3` | Profiled and reduced board rendering work; recorded before/after browser measurements. |
| 2026-09-27 | `0c50dce` | Validated map routes against grounded movement, slope, water, and obstruction rules. |
| 2026-09-27 | `13d4eb3` | Fixed chain and area damage rules, hazard ownership, timed stat stages, and related save state. |
| 2026-09-27 | `3c94942` | Added slopes and solid terrain objects to isometric maps and movement/rendering logic. |
| 2026-09-27 | `c1e9886` | Replaced older combined unit art with separate idle, walk, attack, shoot, charge, sleep, and hurt strips. |
| 2026-09-26 | `93d9b59` | Adjusted the requested stat formulas and save migration for existing runs. |
| 2026-09-26 | `7f055da` | Modeled Mega forms as separate species with compatible stones and migrated saved data. |
| 2026-09-26 | `8104d4c` | Switched the square battle rules to an isometric display and added map dragging and camera controls. |
| 2026-09-26 | `41f5f74` | Added environment and HUD placeholder assets, manifests, and import tooling. |
| 2026-09-26 | `6f391de` | Added item and status icons, ability activation sounds, contextual HUD changes, and UI asset documentation. |
| 2026-09-26 | `e9e0f87` | Corrected audio playback and startup behavior. |
| 2026-09-26 | `07de044` | Added placeholder music and move, item, and shared sound cues with an audio manifest. |
| 2026-09-26 | `1934938` | Bounded visual event playback and recorded browser render profiles. |
| 2026-09-26 | `47926db` | Retuned starter moves, species, encounters, and saves for the revised damage model. |
| 2026-09-26 | `8f7a5d2` | Moved planning documents into `docs/` and recorded UI and scalability plans. |
| 2026-09-26 | `8bcb057` | Added deployment zones and placement selection, move tags, and related save changes. |
| 2026-09-26 | `c79a1a1` | Reduced battle cloning and save payload work; added IndexedDB snapshots and legacy save migration. |
| 2026-09-26 | `6ffaf50` | Split enemy planning into bounded steps and committed one enemy action at a time. |
| 2026-09-26 | `8f51b9a` | Centralized Pokémon-style direct damage calculation in `src/game/damage.ts`. |
| 2026-09-26 | `0b278a4` | Created the first playable React/Phaser battle engine, content catalog, asset manifests, save system, and design plan. |
