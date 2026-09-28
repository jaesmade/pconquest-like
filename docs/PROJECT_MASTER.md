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

### 2026-09-28 — Scripted gameplay playthrough

- Added a repeatable local smoke playthrough (`npm run playthrough`) because the previous move-effect refactor had only been compiled. With a fixed battle seed and a three-Pokémon party, it completed draft, route choice, preparation, a six-round first-battle win, XP and coin rewards, and return to column two in 69 committed actions. Battle Lab checks also passed for Sandstorm, Harden, Water Pulse displacement, Rock Throw cover, Ember Burn, Thunder Shock chaining into a Ground-type immunity, and enemy weather selection without redundant recasting.
- Main files: `scripts/playthrough-smoke-entry.ts`, `scripts/playthrough-smoke.mjs`, `package.json`; usage and scope are in [Battle Lab](BATTLE_LAB.md). The script passed locally. It exercises game rules directly; rendered UI, animation timing, and later route columns were not checked because browser visual access remains unavailable after the prior account usage-limit approval rejection.

### 2026-09-28 — Shared move-effect handlers

- Moved the six cast and hit effect families from engine branches into typed handlers with validation, resolution, preview, and AI scoring hooks. Catalog checks, enemy Status choices, damage-move tie breaking, and hover details now use those hooks. The engine keeps AP, direct damage, seeded RNG, and explicit cast-then-hit execution order.
- Main files: `src/game/moveEffects.ts`, `src/game/engine.ts`, `src/game/enemyPlanner.ts`, `src/content/catalog.ts`, `src/ui/BattleScreen.tsx`; the contract is in [scaling guide](SCALING.md) and the finding is updated in [scalability audit](SCALABILITY_AUDIT.md). The local production build completed; no gameplay test or browser playthrough was run.

### 2026-09-28 — Optimization audit and deployment preview reuse

- Reviewed the current bundle, documented 32×32 render profile, battle redraws, save scheduling, route overlays, and preparation UI. The measured battle hotspot already has a target-preview cache; a renderer rewrite has no current evidence. Memoized static deployment SVG terrain and map geometry, indexed occupants by tile, and omitted empty actor groups so placement edits do less repeated work without changing placement rules.
- Main file: `src/ui/DeploymentBoard.tsx`; findings and remaining measurement priorities are in [scalability audit](SCALABILITY_AUDIT.md) and [scaling guide](SCALING.md). The local production build completed and `git diff --check` passed. No new browser frame measurement was taken; visual browser access remains unavailable after the account usage-limit approval rejection.

### 2026-09-28 — Shared palette and clearer XP rewards

- Brought title options, route HUD, shop/special stops, preparation, battle HUD, and result panels closer to the same navy, paper, raspberry, and gold palette. Shop/special and result now share the route tile floor. Reworked the growth screen with a reward summary, clearer per-Pokémon XP cards and progress, level-up cues, milestone messages, and reduced-motion-aware animation; battle reward rules are unchanged.
- Main files: `src/styles/theme.css`, `src/styles/menus.css`, `src/styles/route.css`, `src/styles/route-overlays.css`, `src/ui/RouteStopScreen.tsx`, `src/ui/ResultScreen.tsx`, `src/ui/IntermissionScreen.tsx`, [UI progress](UI_OVERHAUL_PLAN.md), [route guide](ROUTE_OVERHAUL.md), and [start screen guide](START_SCREEN_OVERHAUL.md). The local production build completed and `git diff --check` passed. Browser visual review remains unavailable following automatic approval review's account usage limit.

### 2026-09-28 — Route-linked deployment and XP screens

- Restyled battle preparation and post-battle growth to match the route selector's translucent overlay treatment. Preparation keeps the live isometric placement board and adds a Back action to return to route choice; growth now shows each Pokémon's portrait, level, awarded XP, progress, and HP in cards, with other rewards below.
- Main files: `src/ui/PrepareScreen.tsx`, `src/ui/IntermissionScreen.tsx`, `src/ui/RouteScreen.tsx`, `src/app/App.tsx`, `src/game/engine.ts`, `src/styles/route-overlays.css`, [route behavior](ROUTE_OVERHAUL.md), and [UI progress](UI_OVERHAUL_PLAN.md). The local production build completed. Browser visual review remained unavailable because automatic approval review reported the account usage limit.

### 2026-09-28 — Aligned, draggable route graph

- Aligned the start tile and first battle with the route's center row, widened columns and rows, and expanded the horizontal map through the boss. Added mouse and touch drag scrolling with a movement threshold so dragging an available node does not select it.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, [route behavior](ROUTE_OVERHAUL.md), and [UI progress](UI_OVERHAUL_PLAN.md). The local production build completed; browser review remained blocked by automatic approval review because the account usage limit was reached. No gameplay test was run.

### 2026-09-28 — Tile-only route floor

- Replaced the route selector's decorative ruined-stone backdrop with a repeating isometric limestone tile asset. The route graph, raised encounter tokens, avatar, and HUD remain in their existing positions; only the floor art changes.
- Main files: `public/assets/backgrounds/route-tiles.svg`, `src/styles/route.css`, [route art guide](ROUTE_OVERHAUL.md), and [UI progress](UI_OVERHAUL_PLAN.md). Local production build completed. Browser review was blocked by automatic approval review when the account usage limit was reached.

### 2026-09-28 — Raised route token detail pass

- Refined the isometric route tokens with shaded stone sides, inset borders, stronger grain, a detailed sword, a bright four-point elite emblem, and a pink-haired route avatar to follow the supplied image more closely. Removed the leftover rule that grayed out locked future nodes. Route generation and selection rules are unchanged.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, `public/assets/ui/route-trainer-placeholder.svg`, and [route art guide](ROUTE_OVERHAUL.md). The local production build completed and the route was visually inspected in a 1280×720 browser viewport. No gameplay test was run.

### 2026-09-28 — Removed project-local game development skill pack

- Removed all 74 locally installed skills from `gamedev-skills/awesome-gamedev-agent-skills`, deleted the tracked `skills-lock.json`, and removed the unused `.agents/` ignore rule. Project guidance remains in `AGENTS.md` and `docs/`; game code and assets were not changed by this removal.
- Main files: `skills-lock.json` (deleted), `.gitignore`, and [scaling guide](SCALING.md). Checked that every lock entry belonged to the same source and that `.agents` and the lock file no longer exist. No build was needed for this tooling-only change.

### 2026-09-28 — Stone-ruins route selector reference pass

- Replaced the washed cavern route backdrop with original pale isometric ruins art, added a transparent pixel explorer marker, and enlarged and textured the colored raised node tiles. The route now uses blue links, amber choice pointers, a left coin/Party HUD, and a small upper-right back button without a large banner over the map. Kept the ten-column graph and legal-node rules; adjusted SVG framing and scroll positioning so the active tile and next choice remain visible on narrow screens.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, `public/assets/backgrounds/route-ruins-pixel.png`, `public/assets/ui/route-trainer-placeholder.svg`. Updated [route art and behavior](ROUTE_OVERHAUL.md) and [UI progress](UI_OVERHAUL_PLAN.md). Local production build completed; visually reviewed the route at 1920×1080 and 390×844 in the local browser. No gameplay test was run.

### 2026-09-28 — Route-only party management

- Moved four-move loadout editing, held-item assignment, and eligible evolution into each Pokémon's expandable card in the route party panel. Removed loadout editing from battle preparation and evolution actions from the post-battle growth report; preparation now focuses on deployment. The engine rejects evolution outside the route phase.
- Main files: `src/ui/RouteScreen.tsx`, `src/ui/PrepareScreen.tsx`, `src/ui/IntermissionScreen.tsx`, `src/app/App.tsx`, `src/game/engine.ts`, `src/styles/route.css`. Updated [route behavior](ROUTE_OVERHAUL.md), [game rules](PLAN.md), and [UI progress](UI_OVERHAUL_PLAN.md). Local production build completed; no gameplay test was run.

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
