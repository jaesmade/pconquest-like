# Project master record

This is the running record of changes to the playable game. Read the linked topic document for full rules, asset specifications, or design intent. The entries below describe work visible in the repository; a dated entry does not by itself mean the feature was playtested. Git history remains the source for exact line-by-line changes.

## How to maintain this record

For every future task that changes code, assets, behavior, or project documentation, add a dated entry at the top of **Recent changes** before finishing the task. State what changed, why, the main files or topic document, and what was checked. Keep entries short but specific enough that another developer can locate the implementation. Update the linked topic document when its behavior or instructions change. Add a new topic document in `docs/` only when an existing one does not cover the subject. Do not describe a plan as implemented until code and assets are present.

## Documentation map

| Subject | Canonical document |
| --- | --- |
| Game scope and rules | [Early build plan](PLAN.md) |
| Route, rewards, recruitment, deployment | [Route overhaul](ROUTE_OVERHAUL.md), [node and event authoring](ROUTE_NODE_EVENTS.md) |
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

### 2026-09-29 — Refined route node plaques

- Reshaped the route nodes into smaller, shallower diamond plaques with muted bevels and compact emblems; softened the connecting paths so branches and tiles sit more naturally on the map floor. Updated the route art guide.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, and [route overhaul](ROUTE_OVERHAUL.md). Visually checked the running local route screen; `npm run build` and `git diff --check` passed.

### 2026-09-29 — Stabilized the route pyramid marker

- Removed the spinning projection and replaced it with fixed, clearly layered pyramid facets; kept the gentle vertical bob. This avoids the route marker changing shape or breaking during rotation.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, and [route overhaul](ROUTE_OVERHAUL.md). `npm run build` and `git diff --check` passed; verified the static pyramid and bobbing marker in the locally running route screen.

### 2026-09-29 — Animated pyramid route marker

- Replaced the route-selection avatar with a downward-pointing SVG pyramid above the current route position. It spins around its vertical axis and bobs up and down; reduced-motion settings turn off both animations. Updated the route art guide to describe the current marker.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, and [route overhaul](ROUTE_OVERHAUL.md). `npm run build` and `git diff --check` passed; viewed the spinning and bobbing marker on the running local route screen.

### 2026-09-29 — Added volume to the route pyramid marker

- Reworked the route marker as a perspective-projected square-base pyramid with separate top and visible side facets. Its face geometry updates as it rotates, keeping it visibly three-dimensional and pointed down instead of flattening edge-on like a 2D sprite. Updated the route art guide.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, and [route overhaul](ROUTE_OVERHAUL.md). `npm run build` and `git diff --check` passed; verified the changing top and side facets in the locally running route screen.

### 2026-09-29 — Fixed AP gain and once-per-turn Move command

- Replaced the prior Movement-based AP gain with a fixed 3 AP per Pokémon turn. AP still banks between turns. Each Pokémon may issue one Move command per turn for a flat 1 AP, within its Movement tile range, and one Attack command; the enemy planner follows the same limit. Added and migrated the per-turn Move flag with save schema v22. Updated the gameplay rules, UI guidance, scaling and balance notes, and scripted playthrough coverage.
- Main files: `src/game/{engine,grid,enemyPlanner,types}.ts`, `src/persistence/save.ts`, `src/ui/BattleScreen.tsx`, and `scripts/playthrough-smoke-entry.ts`; related docs: [early build plan](PLAN.md), [balance baseline](BALANCE.md), [Battle Lab](BATTLE_LAB.md), [scaling guide](SCALING.md), [UI direction](UI_OVERHAUL_PLAN.md), and [README](../README.md). `npm run build`, `npm run playthrough`, and `git diff --check` passed. The playthrough checked 100/125/200 SPD intervals and proportional Speed rescheduling, fixed 3 AP gain, 1 AP multi-tile movement, blocked repeat Move and Attack commands, AP banking, and the campaign/effect smoke cases. The production build retains its advisory about the 1.41 MB battle chunk.

### 2026-09-29 — Continuous Speed and Action Value timeline

- Replaced round-by-round Speed sorting with per-unit next-action AV scheduling: turns use `10,000 / effective Speed`, waiting AV rescales when Speed changes, and move effects can advance or delay the next action of waiting or acting units. AP still comes from Movement. Timed effects and periodic damage now follow 2,000-AV cycles; save schema v21 migrates earlier active battles and timer values. Updated the battle HUD and relevant rules, balance, UI, Battle Lab, and scaling guidance.
- Main files: `src/game/{actionValue,engine,moveEffects,types}.ts`, `src/persistence/save.ts`, `src/ui/BattleScreen.tsx`, `src/styles/battle.css`, and [early build plan](PLAN.md), [balance baseline](BALANCE.md), [scaling guide](SCALING.md), [Battle Lab](BATTLE_LAB.md), and [UI direction](UI_OVERHAUL_PLAN.md). Reviewed scheduler, migration, and Speed/AP references and checked the scoped diff; no automated test or gameplay playthrough was run.

### 2026-09-29 — Movement-based action point gain

- Changed each Pokémon's AP gain at turn start to `max(1, floor(Movement))`. Speed still controls turn order, while Movement now controls both AP gain and the tile limit per Move command. Updated the battle rules, balance baseline, scaling guidance, and ability cue wording to match.
- Main files: `src/game/engine.ts` and [early build plan](PLAN.md), [balance baseline](BALANCE.md), [scaling guide](SCALING.md), and [audio guide](AUDIO_ASSETS.md). Checked all AP and Speed references for stale wording and reviewed the scoped diff; no gameplay playthrough was run.

### 2026-09-29 — Analyze and trim the Phaser battle bundle

- Added an opt-in production bundle treemap (`npm run analyze`). The report showed Phaser dominated the lazy battle chunk, so the Vite resolver now uses Phaser's supplied build without Matter Physics, which the board does not use. The chunk fell from 1.53 MB / 355 KB gzip to 1.41 MB / 320 KB gzip; the 500 KB uncompressed-size warning remains. Updated the scalability audit with the result and the next tuning boundary.
- Main files: `vite.config.ts`, `package.json`, `package-lock.json`, and [scalability audit](SCALABILITY_AUDIT.md). `npm run analyze`, `npm run build`, and `git diff --check` passed. No gameplay playthrough was run.

### 2026-09-29 — Route node and event authoring guide

- Added a developer guide for adding route node kinds, weighted event outcomes, recruitment offers, saved event state, graph migrations, and review steps. Linked it from the route overview and clarified current special and recruitment screen behavior.
- Main documents: `docs/ROUTE_NODE_EVENTS.md`, `docs/ROUTE_OVERHAUL.md`, and this index. Documentation-only change; links and `git diff --check` were reviewed.

### 2026-09-29 — Weighted special encounters and recruitment nodes

- Replaced the fixed special-node choice with a saved 75/25 positive/negative encounter roll. Positive outcomes award 50–100 coins in 10-coin steps, grant a Sitrus Berry, or restore 25% HP; negative outcomes remove half the coins or deal 20% HP damage. Kept recruiting on a separate route node with three choices, including rare non-starter Pokémon, and full-roster replacement handling. Save schema v20 migrates earlier route progress.
- Main files: `src/game/{route,engine,types}.ts`, `src/ui/{RouteScreen,RouteStopScreen}.tsx`, `src/app/App.tsx`, and `src/persistence/save.ts`. Rules and review targets are in [route overhaul](ROUTE_OVERHAUL.md) and [party builder](PARTY_BUILDER.md). `npm run build` and scoped `git diff --check` passed; no gameplay playthrough was run.

### 2026-09-29 — Route climbs toward the boss

- Reversed the vertical route presentation so the starting tile and column-one battle sit near the bottom and the column-ten boss sits at the highest point. Initial and post-node scrolling keeps the current tile and next higher choice visible. The guide's up button now moves toward the boss and down moves toward the start. Saved node order, connections, and rewards are unchanged.
- Main file: `src/ui/RouteScreen.tsx`; the current layout and review notes are in [route overhaul](ROUTE_OVERHAUL.md) and [UI progress](UI_OVERHAUL_PLAN.md). The production build and `git diff --check` passed; no visual browser review or gameplay test was run.

### 2026-09-29 — Vertical route layout

- Repositioned the ten progression columns as rows from top to bottom, with branch choices spread across the board width. The route now scrolls vertically; mouse dragging, touch scrolling, wheel scrolling, up/down guide buttons, and current-position alignment use that axis. The saved route graph, node choices, rewards, and battle rules are unchanged.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`; behavior and review notes are in [route overhaul](ROUTE_OVERHAUL.md) and [UI progress](UI_OVERHAUL_PLAN.md). The production build and `git diff --check` passed; no gameplay playthrough or automated test was run.

### 2026-09-29 — Level-up move choices and Technical Machines

- Removed free move swapping from the route Party panel. Newly eligible level moves now create saved choices on the XP screen: replace one active move or keep the current set. Route progression waits until each choice is resolved. Ordinary evolution retains the prior active slots and learned history. Added single-use TM Swift (a TM-only move) and TM Thunderbolt, species compatibility lists, Bag teaching controls, shop stock, and named placeholder TM icons. TMs cannot be held.
- Main files: `src/game/engine.ts`, `src/game/types.ts`, `src/content/{moves,species,items,shop,catalog}.ts`, `src/ui/{RouteScreen,IntermissionScreen}.tsx`, `src/app/App.tsx`, `src/persistence/save.ts`, `src/styles/{route-party,route-overlays}.css`, and `public/assets/ui/icons/item-tm-*.svg`. Rules and authoring notes are in [early build plan](PLAN.md), [route overhaul](ROUTE_OVERHAUL.md), [scaling guide](SCALING.md), and [asset authoring guide](UNIT_MOVE_ABILITY_ASSETS.md). Save schema v19 migrates v18 and older saves without replaying past offers. The production build and `git diff --check` passed; no gameplay playthrough or automated test was run.

### 2026-09-29 — Position selection UI pass

- Reworked battle preparation around readable full-width roster rows, a six-unit meter, visible active Pokémon, explicit Add/Remove actions, and clearer HP/status details. Framed the isometric map closer, enlarged its deployed sprites, marked ally/enemy sides and the active tile, and strengthened the placement message. Constrained the horizontally scrollable roster so the phone layout stays within the viewport. Battle placement rules are unchanged.
- Main files: `src/ui/PrepareScreen.tsx`, `src/ui/DeploymentBoard.tsx`, `src/styles/deployment.css`, `src/main.tsx`; behavior and review notes are in [route overhaul](ROUTE_OVERHAUL.md) and [UI progress](UI_OVERHAUL_PLAN.md). Visually reviewed the screen at 1280×720 and 390×844 and checked switching the active Pokémon and choosing a tile. The production build and `git diff --check` passed; no gameplay test was run.

### 2026-09-29 — Compact route HUD and inventory

- Moved the route currency display into a small coin row and aligned smaller Party and Bag buttons beneath it so the route map has more room. Added a route inventory panel showing grouped bag items, their effects, and items held by each Pokémon, with a Manage Team action for equipping. Both panels share the route visual style and keyboard dismissal. Item ownership and use rules are unchanged.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route-party.css`; behavior and layout are in [route overhaul](ROUTE_OVERHAUL.md). Visually reviewed the HUD and Bag panel at desktop and 390×844, including navigation to Party and Escape focus return. The production build and `git diff --check` passed; no gameplay test was run.

### 2026-09-29 — Route tokens and Travelling Team polish

- Reduced the route nodes' stone depth and footprint to make the encounter emblems and route paths clearer. Replaced the route Party control's plain symbol with a pixel emblem and visible roster count. Rebuilt Travelling Team cards around type, HP, ability, held item, and equipped moves, with expandable loadout controls and a fainted state. This makes the route's roster readable before committing to a node without changing team or route rules.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, `src/styles/route-party.css`, `src/main.tsx`; design and behavior are recorded in [route overhaul](ROUTE_OVERHAUL.md). Visually reviewed route nodes and the Party panel at 1280×720 and 390×844 in a local browser. The production build and `git diff --check` passed; no gameplay test was run.

### 2026-09-29 — Route flow UI and XP award animation

- Added a compact route guide with next-column progress, hovered or focused node details, and pan controls; improved route Party health display, store item cards, and special reward choices. The linked preparation screen now shows each Pokémon's idle battle sprite on the isometric map, adds roster HP bars, and fits its battle action within the viewport at shorter desktop heights. The post-battle screen counts XP into saved totals, wraps its level bar at level-up, and reveals a level-up badge; reduced motion shows final values immediately. These changes make the route, placement, and reward steps easier to read without changing their game rules.
- Main files: `src/ui/RouteScreen.tsx`, `src/ui/RouteStopScreen.tsx`, `src/ui/PrepareScreen.tsx`, `src/ui/DeploymentBoard.tsx`, `src/ui/IntermissionScreen.tsx`, `src/styles/route.css`, `src/styles/route-overlays.css`; details are in [route overhaul](ROUTE_OVERHAUL.md) and [animation guide](ANIMATION_ASSETS.md). The production build and `git diff --check` passed. Visually reviewed the route guide, horizontal pan, Party panel, and deployment map in a local 1280×720 browser view; the store and XP animation were not visually played through in this pass. The app runs locally at `http://127.0.0.1:5173/`.

### 2026-09-28 — Starting party selection UI pass

- Reworked the new-run draft with a clearer team column, six-point meter, compact roster cards, a larger catalog, type filtering, and a persistent level-10 stat inspector. All eight current choices fit in one desktop row; type-colored accents distinguish the shared placeholder portraits. Unaffordable Pokémon remain inspectable while selection still obeys the existing point budget.
- Main files: `src/ui/PartyBuilder.tsx`, `src/styles/party-builder.css`, `src/styles/menus.css`, `src/main.tsx`; behavior and layout are in [party builder](PARTY_BUILDER.md) and [UI progress](UI_OVERHAUL_PLAN.md). The local production build and `git diff --check` passed. Visually reviewed the screen and selected three Pokémon in a local 1265×713 browser view; narrow viewport appearance was not visually checked.

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
