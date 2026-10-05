# Project master record

This is the running record of changes to the playable game. Read the linked topic document for full rules, asset specifications, or design intent. The entries below describe work visible in the repository; a dated entry does not by itself mean the feature was playtested. Git history remains the source for exact line-by-line changes.

## How to maintain this record

For every future task that changes code, assets, behavior, or project documentation, add a dated entry at the top of **Recent changes** before finishing the task. State what changed, why, the main files or topic document, and what was checked. Keep entries short but specific enough that another developer can locate the implementation. Update the linked topic document when its behavior or instructions change. Add a new topic document in `docs/` only when an existing one does not cover the subject. Do not describe a plan as implemented until code and assets are present.

## Documentation map

| Subject | Canonical document |
| --- | --- |
| Player-facing game description | [Detailed game description](GAME_DESCRIPTION.md) |
| Game scope and rules | [Early build plan](PLAN.md) |
| Run-wide artifacts | [Artifacts plan](ARTIFACTS_PLAN.md) |
| Route, rewards, recruitment, deployment | [Route overhaul](ROUTE_OVERHAUL.md), [node and event authoring](ROUTE_NODE_EVENTS.md) |
| Party drafting and conditional starter unlocks | [Party builder](PARTY_BUILDER.md) |
| Battle balance | [Balance baseline](BALANCE.md) |
| Enemy ranks, compositions, and initial moves | [Implemented enemy-rank rules](PLAN.md#proposed-enemy-ranks-and-automatic-latest-four-movesets) |
| Gameplay gaps and decisions | [Mechanics audit](GAMEPLAY_MECHANICS_AUDIT.md) |
| Extending content and saved state | [Scaling guide](SCALING.md) |
| Full Pokefile content rollout | [Pokefile implementation plan](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md) |
| Experience growth rates | [Experience growth plan](EXP_GROWTH_PLAN.md) |
| Rendering and size limits | [Scalability targets](SCALABILITY_TARGETS.md), [render profile](RENDER_PROFILE.md) |
| UI direction | [UI overhaul plan](UI_OVERHAUL_PLAN.md), [start screen](START_SCREEN_OVERHAUL.md) |
| Environment art | [Top-down battlefield assets](ISOMETRIC_ASSETS.md) |
| Unit, move, and ability art workflow | [Asset authoring guide](UNIT_MOVE_ABILITY_ASSETS.md), [animation guide](ANIMATION_ASSETS.md) |
| Sounds and music | [Audio guide](AUDIO_ASSETS.md) |
| Controlled combat sandbox | [Battle Lab](BATTLE_LAB.md) |

## Recent changes

### 2026-10-06 - Optimized ranked encounter derivation and startup validation

- Removed repeated ranked-roster resolution during XP animation and deployment focus/placement updates; preparation reuses enemy rank summaries and latest-four display labels. Save validation derives expected ranked stats once per unit instead of seven times and reuses its resolved encounter. Move-choice behavior, deterministic teams, stat validation, and v27 save/migration rules are preserved.
- Catalog validation now shares map-zone and origin/mobility routes within each call, computes player evolution forms once, and reuses legal-cell arrays. Interleaved warmed Node measurements reduced reachability searches 89 → 28, zone scans 190 → 14, and median validation CPU 13.68 → 5.52 ms locally. Caches expire after each call; ordered errors matched across six mutated content fixtures. Added `npm run measure:catalog` and restore measurements/assertions to `npm run measure:save`, including six allies/eight ranked enemies/20 owned Pokémon.
- Main files: `src/ui/{PrepareScreen,IntermissionScreen}.tsx`, `src/content/catalog.ts`, `src/persistence/save.ts`, `scripts/{measure-catalog.mjs,measure-save.mjs,ranked-encounters-checks.ts}`, and `package.json`. Updated README, [optimization audit](SCALABILITY_AUDIT.md#2026-10-06-follow-up-ranked-encounter-optimization), and [scaling contracts](SCALING.md).
- Checked production build, campaign/Battle Lab playthrough and rank/save regressions, both measurement scripts, 15 before/after React markup cases, whitespace, and the new documentation links. Saved corruption in every stat slot and invalid level still restart preparation. Final local Boss-room restore cost was about 0.81 ms; storage latency and full-match browser FPS remain unmeasured. The existing Phaser chunk-size warning and unrelated working-tree changes remain.

### 2026-10-05 - Implemented ranked encounters, scaled teams, and latest-four defaults

- Added per-unit Normal/Elite/Boss ranks with intrinsic 1×/2×/3× level-derived HP, Attack, Defense, Special Attack, Special Defense, and Speed; Movement and 3-AP gains are unchanged. Bonuses remain separate from temporary stages and survive Mega stat recalculation. Added explicit species pools, a separate seed/node/level composition stream, and the [level-9-to-21 count curve](PLAN.md#proposed-enemy-ranks-and-automatic-latest-four-movesets). The level-21 Heartwood encounter now has one Charmander Boss, two Elites, and five Normal escorts; all seven maps support eight distinct legal placements through existing zone fallback.
- Fresh drafts, recruits/replacements, wild enemies, and Battle Lab use their latest four distinct current-level starting/learnset moves, with short sets supported. Owned slots, manual level-up choices, TMs, evolution/form moves, and saved pending offers remain preserved as clarified by the user. Added preparation roster/rank/move details, HUD/inspection badges and stats, board Elite/Boss labels, and a Battle Lab rank selector. Saved the visually reviewed [Boss move-menu preview](ENEMY_RANKS_PREVIEW.png).
- Save v27 stores/validates ranks, intrinsic stats, maximum HP, rank counts, and unique move slots. Active older battles restart at preparation once with a report; party progression, route history, chosen/TM moves, and pending offers are retained. Valid owned open slots survive refresh. New v27 battles round-trip HP, moves, RNG, and scheduling without rerolling or multiplying bonuses again; current/backup storage remains supported.
- Main files: `src/game/{types,engine,enemyRanks,movesets}.ts`, `src/content/{encounters,catalog}.ts`, `src/persistence/save.ts`, preparation/title/battle UI, board labels/styles, and `scripts/ranked-encounters-checks.ts` within the existing playthrough. Updated the design, balance, route, scaling, game description, Battle Lab, Pokefile plan, and README to reflect shipped behavior.
- Checked production build, campaign/Battle Lab playthrough, targeting equivalence, forest/navigation validation, save/fingerprint measurement, and `git diff --check`. Focused checks cover levels 1–100, every arena/template at eight enemies across eight seeds, deterministic preview/re-entry, rank Speed/stage/paralysis/Trick Room/Mega behavior, short/duplicate move lists, level-15 recruits/full-roster replacement, manual XP/TM/evolution choices, and v25/v26/v27 preparation/battle/intermission saves. The opening scripted battle won in 65 action decisions; inspected preparation and Boss menus in the browser and confirmed a clean reload with no new runtime errors. Human win rates, late-game difficulty, and release-device performance remain unmeasured. Existing unrelated working-tree changes were preserved.

### 2026-10-05 - Added temporary Speed stat stages

- Added Speed to the ±6 stage system alongside Attack, Defense, Special Attack, and Special Defense; HP and Movement remain excluded. Speed stages use the shared ratios, rescale remaining AV, combine with paralysis/ability/weather and Trick Room, expire at their exact AV timestamp, and display a `Spd` badge. The current move catalog has no Speed-stage move yet; its typed effect contract now supports one.
- Main files: `src/game/{types,stages,damage,engine,moveEffects}.ts`, `src/ui/BattleScreen.tsx`, `src/persistence/save.ts`, `scripts/playthrough-smoke-entry.ts`, and the profile fixture. Save v26 adds inactive Speed fields to v25 battles without restarting them. Updated the [rules](PLAN.md), [scaling guide](SCALING.md), [balance](BALANCE.md), [mechanics audit](GAMEPLAY_MECHANICS_AUDIT.md), [Battle Lab](BATTLE_LAB.md), and current-schema references in related proposals.
- Checked production build and the campaign/Battle Lab smoke playthrough, including new Speed-stage caps, waiting-action rescheduling, exact expiry between cycles, paralysis/Trick Room interaction, and unchanged HP. A focused fixture also checked Speed-stage move resolution, v25 battle migration, v26 stage/timer/AV/HP/RNG round trips, and invalid-stage rejection. `git diff --check` passed. No browser visual review was run. Existing unrelated working-tree changes were preserved.

### 2026-10-05 - Clarified latest-four defaults without replacing owned moves

- Corrected the [enemy-rank and initial moveset plan](PLAN.md#proposed-enemy-ranks-and-automatic-latest-four-movesets) after the user clarified that latest-four moves initialize newly created Pokémon, especially high-level recruits and wild opponents. Owned Pokémon retain manual level-up replacement/keep-current choices, TM teaching, selected slots, evolution/form move behavior, and saved pending offers. Removed the earlier proposal to automatically overwrite owned moves, remove choice UI, disable TMs, and normalize owned loadouts during migration.
- Updated related [balance](BALANCE.md), [route](ROUTE_OVERHAUL.md), and [scaling](SCALING.md) summaries, implementation steps, and acceptance checks. Enemy ranks, stat multipliers, and composition rules remain as proposed. This clarification supersedes the universal automatic-moveset interpretation in the earlier planning entry below; no game code changed.
- Rechecked current `defaultLoadoutAtLevel`, creation/recruitment, owned battle construction, XP offers, `resolveLevelMove`, TM teaching, evolution, and intermission controls. Checked affected document links, removed contradictory planned instructions, and ran `git diff --check`; game tests were not needed for this documentation-only correction.

### 2026-10-05 - Planned enemy ranks, scaled compositions, and automatic movesets

- Added the [ranked-enemy and latest-four moveset proposal](PLAN.md#proposed-enemy-ranks-and-automatic-latest-four-movesets) to the existing design plan. Specified per-enemy Normal/Elite/Boss ranks, intrinsic 1×/2×/3× six-stat multipliers separate from temporary stages, requested mixed-team count ranges, and a tunable deterministic level-count curve. Incorporated the user's confirmation that Speed is multiplied and all units, including high-level wild Pokémon and level-15 recruits, use their current-level learnset's latest moves. Documented drafts, recruitment, XP, evolution/forms, Battle Lab, saves, and the proposed handling of obsolete manual TM slots.
- Defined implementation order, eight-enemy deployment validation, rank presentation, save migration/reload behavior, and acceptance/tuning checks. Updated related [balance](BALANCE.md), [route](ROUTE_OVERHAUL.md), and [scaling](SCALING.md) documents with clearly marked proposal links. This is documentation only; no encounter, stat, move, UI, or save rules were implemented.
- Checked current engine/types, species/encounter catalogs, deployment/map defaults, catalog validation, save v25, progression/TM UI/controller paths, verification script entry points, and existing design/reference docs. Validated proposed count bounds, examples, Markdown links, and `git diff --check`; no game tests were run for this planning-only change. Existing unrelated working-tree changes were preserved.

### 2026-10-05 - Centered units within top-down tiles

- Removed the legacy 12-pixel upward sprite offset in battle and deployment so grounded unit frames sit at the square tile center. Shifted ellipse shadows and swimming ripples down with the units; frame-aligned shadows, HP bars, and movement/attack anchors follow the updated battle position. Flying and swimming offsets remain unchanged.
- Main files: `src/battle/Board.tsx`, `src/ui/DeploymentBoard.tsx`, the [battlefield guide](ISOMETRIC_ASSETS.md), and [animation guide](ANIMATION_ASSETS.md). Production build passed; visually reviewed battle and deployment in the live boss gallery and refreshed the [boss preview](TOP_DOWN_BOSS_PREVIEW.png). `git diff --check` passed. Combat rules and tile selection are unchanged.

### 2026-10-05 - Converted battlefields to a Mystery Dungeon-style top-down view

- Replaced the active diamond projection with unshifted 64×64 square cells in battle, deployment, targeting/path overlays, effects, popup placement, camera picking, and the minimap. Visually rebuilt all seven arenas with 59 original square woodland floor/prop/border SVGs: joined shorelines, grass-bordered dirt corridors, readable ledges and cardinal ramps, and matching Heartwood paving/seal art. Authored map layouts, collision footprints, heights, objectives, and saved logical facing remain compatible.
- Remapped the shared animation sheet to cardinal south/west/east/north rows [0,6,2,4], so allies start facing straight up and enemies straight down. Actions still turn units toward movement/attack directions. Main files: `src/battle/{topDown,terrainArt,Board}.ts*`, `src/ui/{DeploymentBoard,BattleScreen}.tsx`, the animation manifest, `public/assets/environment/top-down/`, `scripts/generate_top_down_assets.mjs`, forest verification/gallery, and the profile fixture's shared geometry import. The gallery now fits maps after camera initialization. Earlier isometric assets and source remain as legacy material.
- Updated the [battlefield guide](ISOMETRIC_ASSETS.md), animation/authoring guides, route/UI/game descriptions, scaling guidance, render compatibility notes, and README; saved a [boss preview](TOP_DOWN_BOSS_PREVIEW.png). Checked production build, campaign/Battle Lab playthrough, all 1,600 square cell centers and boundary/ramp picking, all 69 bidirectional ramps, 1,394 connected plain cells, 12 object collision/sight profiles, 59 square SVG registrations, deployment facing, and campaign rotation. Reviewed the seven battle themes and representative deployment views in the live gallery; all 11 live Phaser renderer assertions passed with no browser errors. `git diff --check` passed. Encounter balance and release-device performance were not retuned or measured.


### 2026-10-03 - Documented species-specific experience growth

- Added a runtime implementation proposal that maps species to the six growth curves already present in the checked reference data, preserves save level/progress during migration, updates XP UI calculations, and calls for route reward retuning. This is a plan only; gameplay behavior is unchanged.
- Main files: [experience growth plan](EXP_GROWTH_PLAN.md), [Pokefile implementation plan](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md), README, and this record. Inspected XP thresholds, battle rewards, species assignments, save migration, and intermission progress in the current code; `git diff --check` passed. No tests were run because no runtime code changed.

### 2026-10-03 - Rebuilt Ancient Heartwood as a ceremonial boss arena

- Replaced the boss map's scattered shelves with an open 4×4 raised stone dais, eight matching stone inclines, twin southern approaches, flank routes, and an upper rear crest. Added a gold-and-green capture seal, two larger ancient trees, and four runed standing stones around the perimeter. The map remains 8×8 with ID `ancient-heartwood`, capture `[4,4]`, the existing deployment/spawn layout, and the defeat-and-capture encounter.
- Main files: `src/content/{maps,terrainObjects}.ts`, `src/game/types.ts`, `src/battle/{terrainArt,Board}.ts*`, `scripts/generate_isometric_assets.mjs`, the isometric manifest and twenty new paving/ramp/prop SVGs, and `scripts/verify-forest-maps.mjs`. Both renderers share the new art; Phaser loads stone ramps only for maps using them and keys cliff texture clips by source art. Updated the [isometric guide](ISOMETRIC_ASSETS.md), [scaling guide](SCALING.md), and README; saved a [boss arena preview](BOSS_ARENA_PREVIEW.jpg).
- Checked production build, campaign/Battle Lab smoke test, save fingerprint/delta regression script, and forest verification: all 50 boss ground cells connected, four objective approaches, sixteen platform cells without solid obstacles, eight bidirectional boss ramps, clear deployment, new prop collision/sight behavior, boss-only asset placement, and all seventy SVG registrations/dimensions/corners. Visually inspected battle and deployment; the refreshed preview had no browser errors. `git diff --check` passed. Encounter balance was not retuned.

### 2026-10-03 - Made forest ramps continuous slopes

- Replaced flat tread overlays with grass-and-dirt inclines in all four directions, with elevation-specific earth wedges. Downhill corners descend exactly 20 pixels to the neighboring ground; ramp entrances have no upright cliff wall and the other exposed sides taper. Battle and deployment share the new complete ramp tiles, geometry, midpoint unit anchors, highlights, and click areas; movement rules and authored maps remain unchanged.
- Main files: `scripts/generate_isometric_assets.mjs`, the isometric manifest and ramp SVGs, `src/battle/{isometric,terrainArt,Board}.ts*`, `src/ui/DeploymentBoard.tsx`, and `scripts/verify-forest-maps.mjs`. Updated the [isometric guide](ISOMETRIC_ASSETS.md) and saved an [Ancient Heartwood ramp close-up](SLOPED_RAMPS_PREVIEW.jpg).
- Checked production build, campaign/Battle Lab smoke test, and forest verification: 66 lower-edge connections and bidirectional traversals, 36 directional surface clicks, midpoint anchors, open entrances/tapered sides, 50 SVG assets with art/projection corner agreement, existing connectivity and depth fixtures. Elevated picking covers 250 direct centers plus Willowbrook's rear ramp midpoint, which is now correctly occluded by the upper foreground slope. Visually inspected battle and deployment inclines; browser error logs were empty. `git diff --check` passed.

### 2026-10-02 - Rebuilt the forests and added two campaign battlefields

- Reworked all five existing forest arenas with connected terraces at heights 0–2, clear ramps, branching dirt trails, wooded clusters, logs, stumps, ferns, mushrooms, and moss. Added 16×16 Willowbrook Crossing and Pinewatch Rise to a five-map normal rotation; elite Moonpool and the 8×8 Heartwood capture arena retain their IDs. Original Mystery Dungeon-inspired SVG tiles and props now share a richer woodland palette, rooted earth cliffs, and varied grass/path surfaces.
- Main files: `src/content/{maps,terrainObjects,catalog,data}.ts`, `src/game/{types,engine}.ts`, `src/battle/{Board,isometric,terrainArt}.ts*`, `src/ui/{DeploymentBoard,BattleScreen}.tsx`, `src/persistence/save.ts`, the isometric generator/manifest/SVGs, and `scripts/verify-forest-maps.mjs`. Fixed preparation image heights and ramp alignment; added clipped, depth-sorted terrace faces and grid-footprint actor ordering while keeping tactical overlays visible. Save deployment follows the selected route map; changed old battle geometry returns to preparation using the existing save compatibility behavior.
- Added the development-only [forest gallery](FOREST_MAP_PREVIEW.html), backed by `scripts/forest-preview.tsx`, for inspecting all seven maps in the actual battle and preparation renderers without changing campaign saves. Updated the [isometric guide](ISOMETRIC_ASSETS.md), [scaling guide](SCALING.md), [route guide](ROUTE_OVERHAUL.md), terrain rules, and README. Existing in-progress work was retained.
- Checked production build, gallery TypeScript compilation, campaign/Battle Lab smoke test, authored-save fingerprint checks, eleven live Phaser renderer assertions, and forest verification: 1,399 connected ground cells, 66 bidirectional ramps, 157 blocked cliff edges, 251 elevated click centers, ten object collision/sight profiles, all 38 SVG registrations/dimensions, campaign arena selection, and exposed-face/depth fixtures. Visually inspected all seven maps in both renderers and saved a [Pinewatch preview](FOREST_MAP_PREVIEW.jpg). Regenerating woodland assets twice produced identical hashes; `git diff --check` passed. Encounter balance and the performance cost of the extra static terrain layers have not been established.

### 2026-10-02 - Reduced repeated targeting, rendering, UI, and save work

- Narrowed damaging aim scans to the exact inverse move footprint, reused active matchup labels and unchanged HP Graphics commands, cached route/inventory and XP-screen derivation, and cached authored object/slope save fingerprints. These reduce repeated computation and allocation while preserving target order, gameplay rules, UI markup, and save schema v25. Existing in-progress changes were retained.
- Main files: `src/game/{engine,enemyPlanner}.ts`, `src/battle/Board.tsx`, `src/ui/{RouteScreen,IntermissionScreen}.tsx`, `src/persistence/save.ts`, `scripts/verify-targeting.mjs`, `scripts/measure-save.mjs`, `scripts/profile/`, and `package.json`. Updated the [optimization audit](SCALABILITY_AUDIT.md), [extension guide](SCALING.md), [route guide](ROUTE_OVERHAUL.md), and [render profile](RENDER_PROFILE.md); exposed repeatable targeting/save checks in the README.
- Checked production build, scripted campaign/Battle Lab playthrough, 1,960 ordered aim sets, 274,400 exhaustive hit comparisons, 140 planner decisions with unchanged state/RNG, save fingerprint/delta replacement checks, before/after UI markup parity, and 11 live Phaser reuse/invalidation assertions. Local pursuit CPU median changed from 2.771 to 1.990 ms; the 30-update browser fixture reduced HP redraws from 480 to 30. Frame intervals remained near 60 Hz; GPU, texture memory, release-device FPS, and competitive capacity remain unmeasured.

### 2026-10-01 - Simplified battle stat-stage badges

- Replaced multiplier-heavy stage readouts with compact labels such as `Def III`; green indicates a boost and red a drop. Accessible labels retain direction, stage count, and cycles remaining. Main files: `src/ui/BattleScreen.tsx` and `src/styles/theme.css`; updated the [UI overhaul plan](UI_OVERHAUL_PLAN.md). Production preview, build, and `git diff --check` confirmed the updated readout.

### 2026-10-01 - Corrected Travelling Team portraits

- Replaced the shared Bulbasaur placeholder shown on every Travelling Team card with code-native portraits for the supported species, so each card's icon matches its Pokémon. Battle sprites and other shared-placeholder surfaces are unchanged.
- Main files: `src/ui/SpeciesPortrait.tsx`, `src/ui/RouteScreen.tsx`, and `src/styles/route-party.css`; updated the [route guide](ROUTE_OVERHAUL.md). Reviewed the live Travelling Team preview at desktop size; no build or tests were run.

### 2026-10-01 - Match active-condition chip sizes

- Applied the field-condition font family without resetting the weather button's shared font size, so weather and Trick Room chips now match in text and padding. Main file: `src/styles/battle.css`; updated the [UI overhaul plan](UI_OVERHAUL_PLAN.md). Production preview and `git diff --check` confirmed both indicators use the same size.

### 2026-10-01 - Show only active battle field conditions

- Hide the empty Clear weather and Trick Room Off labels. Active weather and Trick Room now appear in parentheses with their remaining cycle counts; the weather details card is available only while weather is active and closes on expiry.
- Main files: `src/ui/BattleScreen.tsx`, `src/styles/battle.css`, and `src/styles/theme.css`; updated the [UI overhaul plan](UI_OVERHAUL_PLAN.md). `npm run build` and scoped `git diff --check` passed. Production preview confirmed the empty state, Sandstorm, and combined Sun + Trick Room indicators.

### 2026-10-01 - Face evolution sprites toward the player

- Changed the evolution scene to use the front-facing idle row for both forms. Updated the [route guide](ROUTE_OVERHAUL.md). Reviewed the animation manifest's facing-row mapping; no build or tests were run.

### 2026-10-01 - Show idle sprites in the evolution scene

- Replaced portrait rendering for the before-and-after forms with an idle spritesheet animation. Reduced-motion settings show its first frame. Main files: `src/ui/RouteScreen.tsx` and `src/styles/route-party.css`; updated the [route guide](ROUTE_OVERHAUL.md). Reviewed the manifest clip dimensions, row mapping, and evolution scene markup; no build or tests were run.

### 2026-10-01 - Added Fire Stone to the starting bag for testing

- New runs now start with one Fire Stone alongside the existing starting items so the Vulpix-to-Ninetales Bag flow can be tried without first reaching a Store. Updated the starting-inventory note in the [route guide](ROUTE_OVERHAUL.md). Reviewed `STARTING_BAG` and the documented fresh-run inventory; no build or tests were run.

### 2026-10-01 - Added Fire Stone evolution from the route Bag

- Added Fire Stone to the shop for 20 coins and made it a single-use Bag item that evolves Vulpix into Ninetales without a level requirement. The picker only lists compatible Pokémon, cancellation preserves the stone, and selecting Vulpix runs the shared evolution scene while applying the form's HP and move updates.
- Main files: `src/content/{items,species,shop,catalog}.ts`, `src/game/engine.ts`, `src/ui/RouteScreen.tsx`, `src/app/App.tsx`, and `public/assets/ui/icons/item-fire-stone.svg`. Updated the [route guide](ROUTE_OVERHAUL.md) and [scaling guide](SCALING.md). Reviewed the source/target links, bag callback, and documentation; no build or tests were run.

### 2026-10-01 - Added an evolution scene to party management

- Choosing an eligible Pokémon's evolution now opens a staged modal animation with a charging effect, sprite transition, and evolved-form reveal. The scene can be skipped, supports reduced-motion settings, and restores focus to the evolved Pokémon's card when closed. Evolution rules and save data are unchanged.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route-party.css`, and the [route guide](ROUTE_OVERHAUL.md). `npm run build` and scoped `git diff --check` passed; no gameplay test was run.

### 2026-10-01 - Added two-step TM use windows

- Replaced the inline TM recipient and move selectors with a compatible-Pokémon picker followed by a move-replacement window. Pokémon with an open move slot can add the TM move without overwriting; selection uses the existing single-use TM validation and consumption rules.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route-party.css`, and the [route guide](ROUTE_OVERHAUL.md). `npm run build` and scoped `git diff --check` passed; no gameplay test was run.

### 2026-10-01 - Added fallen logs and an elite lake arena

- Added a depth-sorted fallen-log prop to the forest map layouts and assigned all elite route battles to a dedicated 16×16 lake clearing. The lake sits in the neutral center with grounded paths around it; logs block movement and leave line of sight clear.
- Main files: `src/content/maps.ts`, `src/content/terrainObjects.ts`, `src/game/engine.ts`, `src/content/catalog.ts`, and the isometric manifest and asset generator. Updated the [isometric asset guide](ISOMETRIC_ASSETS.md) and [scaling guide](SCALING.md). Checked with the production build and `git diff --check`.

### 2026-10-01 - Corrected the same-type damage bonus in the plan

- Updated the plan's same-type bonus from 1.2× to 1.5× to match the current damage calculator. Main documents: [early build plan](PLAN.md) and this record. Checked `src/game/damage.ts`; no tests were run.

### 2026-09-30 - Planned conditional starter unlocks

- Specified a three-reward proposal tied to first clear, a diverse deployed team, and deploying a Pokémon recruited during the run. Preserved the eight currently draftable species, defined boss-clear timing, locked-choice presentation, save migration, and future acceptance checks. This is documentation only; unlock behavior is unchanged.
- Main documents: [party builder](PARTY_BUILDER.md), [early build plan](PLAN.md), [mechanics audit](GAMEPLAY_MECHANICS_AUDIT.md), and this record. Checked current `STARTERS`/`RECRUITS`, draft catalog, boss-win counter, and save shape; no tests were run.

### 2026-09-30 - Reduced normal battle coin rewards

- Normal battle nodes now grant 10 coins; elite rewards remain 20 and boss rewards remain 30. Updated the victory wallet gain and displayed report together, then aligned the route, balance, and game description documents.
- Main files: `src/game/engine.ts`, `docs/ROUTE_OVERHAUL.md`, `docs/BALANCE.md`, and `docs/GAME_DESCRIPTION.md`. Checked the reward expression and documented values; no tests were run.

### 2026-09-30 - Started new runs with no coins

- Set the starting wallet to 0 coins for both the party draft state and the newly created run, removing the initial store budget while preserving the starting TM Swift. Updated the [route and reward guide](ROUTE_OVERHAUL.md).
- Main files: `src/game/engine.ts`, `src/persistence/save.ts`, and `docs/ROUTE_OVERHAUL.md`. Checked all current new-run and reset paths for starting coin values; no tests were run.

### 2026-09-30 - Matched the battle UI to route selection

- Reframed battle HUDs, field cards, action controls, and camera controls with the route screen's navy panels, pale rims, raised shadows, and gold/cyan cues. Narrow screens use a two-column command tray; action menus move clear of weather details and the lower HUD.
- Main files: `src/styles/theme.css`, `src/styles/battle-menu.css`, and `src/ui/BattleScreen.tsx`. Updated the [UI overhaul plan](UI_OVERHAUL_PLAN.md). `npm run build` and `git diff --check` passed; the production browser preview was checked at 1142×910 and 390×844, including rain-cycle and effects readouts.

### 2026-09-30 - Added Pokémon experience growth rates to the reference CSV

- Filled the existing `exp gain` column in the checked Pokémon reference CSV with each species' experience growth curve, including Medium Fast and Medium Slow labels. Updated the generator to join the pinned PokeAPI growth-rate table. The edit preserved the CSV's existing columns and did not change game behavior.
- Main files: [checked Pokémon reference CSV](../pokefiles/for%20checking/Pokemon%20Reference.csv), [generator](../scripts/generate_pokemon_reference_csv.py), [Pokefile implementation plan](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md), and this record. Checked all 1,351 values against the PokeAPI species/growth-rate tables and imported the CSV for spreadsheet review.

### 2026-09-30 - Added tactical battle field previews and unit readouts

- Added a weather field card with remaining cycles, weather effects, and the next Sandstorm damage tick; weather moves and Trick Room now show field forecasts before use. Levels are visible in turn portraits and unit cards; the current unit shows action readiness, timed stat stages show their rank and exact multiplier, and tile inspection exposes coordinates, terrain, height, and hazards.
- Main files: `src/ui/BattleScreen.tsx`, `src/styles/battle.css`, and `src/styles/battle-menu.css`. Updated the [UI overhaul plan](UI_OVERHAUL_PLAN.md), [Battle Lab guide](BATTLE_LAB.md), [game rules](PLAN.md), [mechanics audit](GAMEPLAY_MECHANICS_AUDIT.md), and this record. `npm run build`, `npm run playthrough`, and `git diff --check` passed. The 1142×910 production browser preview showed the weather card, Sunny Day forecast, Trick Room timer, level labels, and Defense +1 (1.5×, 4 cycles left); narrow-screen visual review was not completed.

### 2026-09-30 - Planned enemy levels above 100 on higher floors

- Documented a level-100 player cap with a separate enemy ceiling and a saved floor index. Floor 1 keeps the current encounter curve; a provisional +6 enemy-level offset per floor puts the floor 15 boss at 105. Added the save, validation, stat-scaling, and balance considerations; this remains a design proposal.
- Main documents: [route overhaul](ROUTE_OVERHAUL.md), [balance baseline](BALANCE.md), [scaling guide](SCALING.md), and this record. Checked current player XP/level clamps, enemy generation, catalog and save validators, and the v25 save format. Documentation only; no tests were run.

### 2026-09-30 - Planned branching quest battles and legendary rewards

- Added the Rayquaza / Groudon / Kyogre quest example with three branch-specific battles, exclusive Red Orb / Blue Orb / Meteorite rewards, and matching recruits. Documented reuse of preparation and battle flow, saved branch selection, defeat behavior, battle reward tuning, quest-only species content, and full-roster replacement. This is a design proposal; no game behavior changed.
- Main documents: [route node and event authoring guide](ROUTE_NODE_EVENTS.md), [route overhaul](ROUTE_OVERHAUL.md), and this record. Checked the current battle start, victory/intermission, defeat, encounter, and recruitment flows. No tests were run.

### 2026-09-30 - Expanded the quest proposal for multiple chains and steps

- Specified data-driven quest definitions with independent saved progress per quest and per step, round-robin follow-up checks, and distinct special-node visits for each step. The plan now explicitly supports three or more concurrent quests and quests that require three or more nodes; no fixed two-quest or two-step shape is assumed.
- Main documents: [route node and event authoring guide](ROUTE_NODE_EVENTS.md), [route overhaul](ROUTE_OVERHAUL.md), and this record. Reviewed the state and event ordering for step retries, new quest starts on missed nodes, and one event per special node. Documentation only; no tests were run.

### 2026-09-30 - Planned multiple concurrent special-node quests

- Extended the design so a missed follow-up can start another eligible quest on that special node. Each quest keeps independent progress and miss counts; one quest is checked per node in round-robin order, and each node resolves only one story event. This remains a proposal; no runtime behavior changed.
- Main documents: [route node and event authoring guide](ROUTE_NODE_EVENTS.md), [route overhaul](ROUTE_OVERHAUL.md), and this record. Checked the revised event priority against the existing one-result-per-special-node flow. No tests were run.

### 2026-09-30 - Refined the special-node quest odds proposal

- Clarified that one designated special node always starts the Gracidea quest, while each later entered special node has a rising, non-guaranteed chance to reveal Shaymin. Missed checks increase the next chance; skipped nodes do not count, and misses fall back to the regular special encounter. This remains a design proposal with provisional odds only.
- Main documents: [route node and event authoring guide](ROUTE_NODE_EVENTS.md), [route overhaul](ROUTE_OVERHAUL.md), and this record. Checked the existing guaranteed special-node columns and persisted one-outcome-per-entry event flow. No game behavior changed and no tests were run.

### 2026-09-30 - Planned a multi-node special-node quest chain

- Added a design proposal for special nodes to progress a saved quest from finding Gracidea to recruiting Shaymin, including key-item separation, saved scene outcomes, full-roster handling, and route reachability decisions. This is documentation only; game behavior and content are unchanged.
- Main documents: [route node and event authoring guide](ROUTE_NODE_EVENTS.md), [route overhaul](ROUTE_OVERHAUL.md), and this record. Checked the current weighted special-event flow, saved event payload, recruitment replacement behavior, route guarantees, and save schema v25. No tests were run.

### 2026-09-30 - Restricted battle XP to deployed participants

- Battle victories now award XP only to player Pokémon recorded in the battle deployment. Deployed Pokémon still receive XP if they faint; reserves do not gain XP, levels, or move offers from that battle. The growth screen shows each award and +0 XP for reserves.
- Main files: `src/game/engine.ts`, `src/ui/IntermissionScreen.tsx`, and `scripts/playthrough-smoke-entry.ts`. Updated the [game rules](PLAN.md), [balance baseline](BALANCE.md), [route guide](ROUTE_OVERHAUL.md), [game overview](GAME_DESCRIPTION.md), [artifact proposal](ARTIFACTS_PLAN.md), [UI plan](UI_OVERHAUL_PLAN.md), [mechanics audit](GAMEPLAY_MECHANICS_AUDIT.md), and [smoke guide](BATTLE_LAB.md). `npm run playthrough`, `npm run build`, and `git diff --check` passed.

### 2026-09-30 - Added an Artifact Bag placeholder to the route selector

- Added a route HUD Artifact Bag control and a dialog that says “coming soon.” The dialog follows the existing Escape, backdrop-dismissal, and focus-return behavior. It does not contain artifact inventory or change game state. Updated the artifact and route plans to identify the placeholder and its limits.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route-party.css`; related docs: [artifacts plan](ARTIFACTS_PLAN.md), [route overhaul](ROUTE_OVERHAUL.md), and this record. Reviewed the existing route panel patterns and documented that no artifact gameplay is implemented; no tests were run.

### 2026-09-30 - Added a detailed game description

- Added a player-facing overview of the run, party draft, branching route, tactical battles, progression, boss objective, and proposed artifact system. Marked artifacts as design-only and called out unresolved sample-effect decisions. Linked the overview from the early build plan and README.
- Main documents: [game description](GAME_DESCRIPTION.md), [early build plan](PLAN.md), [README](../README.md), and this record. Reviewed route, party, artifact, and game rules docs and checked current run types/engine for implementation claims. No tests were run.

### 2026-09-30 - Planned a run-wide artifact system

- Added a design plan for a separate artifact collection with a 20-definition catalog cap (10 standard and 10 cursed), five rarity tiers, global run effects, the six sample concepts, and implementation decisions. Updated the early build and route plans to link the artifact rules and reserve legendary acquisition for question-mark event nodes. This is documentation only; no game code, assets, behavior, or save system changed.
- Main documents: [artifacts plan](ARTIFACTS_PLAN.md), [early build plan](PLAN.md), [route overhaul](ROUTE_OVERHAUL.md), and this record. Checked the existing run/inventory types, held-item rules, post-battle XP flow, and special-node behavior. No tests were run.

### 2026-09-30 - Shortened forest battle approaches

- The deterministic campaign run originally won in 10 rounds. Moved preferred deployment to the inner edge of each forest map's deployment band and improved the smoke player's policy to combine Move and Attack when both are available. The same seeded campaign now wins in 7 rounds and 53 action decisions, with five turns using both commands. No battle rules or save schema changed; saved active battles with the previous map signature restart at preparation under existing map validation.
- Main files: `src/content/maps.ts`, `scripts/playthrough-smoke-entry.ts`, [Battle Lab and smoke guide](BATTLE_LAB.md), [isometric asset guide](ISOMETRIC_ASSETS.md), and this record. `npm run playthrough`, `npm run build`, and `git diff --check` passed. Rendered browser play was not completed because browser access to the isolated local test origin was denied.

### 2026-09-30 - Replaced campaign maps with forest battlefields

- Replaced the four mixed-terrain layouts with three 16×16 forest maps used by normal and elite encounters and an 8×8 forest boss arena with a capture tile. Updated encounter references and documented deployment layout and save behavior; saves in an old active map restart at preparation while route and party progress remain.
- Main files: `src/content/maps.ts`, `src/content/encounters.ts`, [isometric asset guide](ISOMETRIC_ASSETS.md), [scaling guide](SCALING.md), and this record. `npm run build` and `git diff --check` passed; no gameplay playthrough was run.

### 2026-09-30 - Made Speed equal the species base stat at every level

- Removed level scaling and the 11.5 multiplier from Speed. Updated the 11 runtime species/forms to their source base Speeds (mean 63.27), so a base Speed of 60 stays 60 at any level while the roster remains close to the Speed-65 AV and Trick Room reference. Schema v25 restarts pre-v25 active battles at preparation because their saved battle units contain the prior derived Speed; run progression and party HP are retained.
- Main files: `src/game/engine.ts`, `src/content/species.ts`, `src/persistence/save.ts`, and the playthrough smoke expectation. Updated [game rules](PLAN.md), [balance notes](BALANCE.md), [save guide](SCALING.md), [Pokefile plan](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md), and this record. Manually checked all 11 source Speed values, the mean, level-independent formula, and save migration; the smoke script was updated but no runtime test was run.

### 2026-09-30 - Filled reference TM compatibility from the latest available game record

- Updated the Pokémon reference CSV generator to use Scarlet/Violet TM compatibility when present, fall back to Sword/Shield, then use the latest earlier version group with machine/TM compatibility data. Games without a TM system are skipped. Transformed forms with no eligible form-specific record inherit the default form's selected compatibility. Added a source version-group column, flags empty matches to the project's TM.csv list, and clarified that TM numbers retain the project list's numbering. No game behavior changed.
- Main files: [Pokemon reference CSV](../pokefiles/output/Pokemon%20Reference.csv), [generator](../scripts/generate_pokemon_reference_csv.py), [Pokefile implementation plan](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md), and this record. Regenerated the export and checked fallback-source selection, empty-list status, row count, and spreadsheet import.


### 2026-09-30 - Calibrated battle Speed around 65

- Set the cycle to 10,000 AV and the base action interval to 650,000 AV, so the current level-10 catalog averages Speed 65 and acts once per cycle. Scaled derived Speed by 11.5 without changing authored species or reference CSV values; Trick Room now pivots around 65. Schema v24 restarts pre-v24 active battles at preparation with a report because saved AV timelines use the old scale.
- Main files: `src/game/actionValue.ts`, `src/game/engine.ts`, `src/persistence/save.ts`, the playthrough smoke script, [battle rules](PLAN.md), [balance baseline](BALANCE.md), [save guide](SCALING.md), [Pokefile implementation plan](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md), [Battle Lab](BATTLE_LAB.md), and this record. Manually checked the level-10 Speed average and interval/Trick Room arithmetic, save migration path, and updated docs; no runtime test was run.

### 2026-09-30 - Added a Pokémon item reference CSV

- Created a 462-row reference export from all 459 Pokefile item rows plus the three runtime-only entries. It includes source descriptions and proposed game mappings, reports current runtime support and effects, preserves duplicate names by source row, and flags all 28 blank source descriptions without guessing. No game behavior changed.
- Main files: [Pokemon Items Reference CSV](../pokefiles/output/Pokemon%20Items%20Reference.csv), [generator](../scripts/generate_pokemon_items_reference_csv.py), [Pokefile implementation plan](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md), and this record. Confirmed source-row coverage, runtime/catalog overlap, blank-description status, CSV row count, and `git diff --check`. No runtime test was run.

### 2026-09-30 - Added the form-level Pokemon reference CSV

- Created a 1,351-row reference CSV with dex/form keys, the source six stats and types, evolution conditions, ability options, learnsets, Scarlet/Violet TM compatibility, form, and region. The output is reference data and does not change runtime catalogs. Nine Mega forms without source ability records are flagged.
- Main files: [Pokemon reference CSV](../pokefiles/output/Pokemon%20Reference.csv), [generator](../scripts/generate_pokemon_reference_csv.py), [Pokefile implementation plan](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md), and this record. Confirmed one-to-one mapping for all 1,351 source rows, exact stats/types, parsed nested CSV fields, and spreadsheet import. No runtime test was run.

### 2026-09-30 - Added the Gen 7-9 move reference

- Created a 919-row move reference covering the combined Gen 7-9 main-series move catalog. It preserves existing Moves.csv powers and implementation notes while adding current base power, accuracy and effect chances, damage class, type, traits and flags, targeting, and timing metadata. The game and source CSVs were not changed; five blank descriptions use summaries from existing implementation notes.
- Main files: [move reference](../pokefiles/output/Pokemon%20Moves%20Gen7-9%20Reference.csv), [Pokefile implementation plan](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md), and this record. Checked 919 row/name alignments, preserved source powers and notes, verified descriptions and CSV dimensions. No runtime test was run.

### 2026-09-30 — Expanded timed stat stages to six levels

- Expanded stat-stage caps to ±6, which gives the requested multipliers, and set stage effects to five AV cycles. Reapplying a stage already stacks its delta and refreshes its timer, so Harden can reach Defense +2 on a later turn and restart its duration. Legacy active-stage timers now convert to the full AV duration during save migration. Updated Harden, Tail Whip, and Howl descriptions.
- Main files: `src/game/stages.ts`, `src/content/moves.ts`, `src/persistence/save.ts`, [game rules](PLAN.md), [balance baseline](BALANCE.md), [save guide](SCALING.md), [mechanics audit](GAMEPLAY_MECHANICS_AUDIT.md), and this record. Reviewed the stage formula, timer conversion, save validation, and migration paths; no runtime test was run.

### 2026-09-30 â€” Added the Pokefile content gap register

- Created a filterable issue CSV covering missing mappings and rule decisions across the four source files. It contains 1,002 gap rows, combining shared gaps with row-specific blockers and source references. The original CSVs and game catalogs were not changed.
- Main files: [gap register](../pokefiles/Content%20Information%20Gaps.csv), [implementation plan](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md), and this record. Audited all four source CSVs and current implementation contracts; checked the CSV round-trip dimensions and source coverage. No runtime test was run.

### 2026-09-30 â€” Planned the Pokefile content rollout

- Added a staged implementation plan for the four Pokefile CSVs so original PokÃ©mon stats and types, temporary Movement 4, four equipped moves, and move/ability/item rules can be introduced with explicit data and save gates. Corrected the early-build move-slot description to four and linked the plan from the content guide. This is documentation only; no game or CSV behavior was changed.
- Main documents: [Pokefile implementation plan](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md), [early build plan](PLAN.md), [scaling guide](SCALING.md), and this record. Reviewed the four CSVs and current content, battle, catalog, and save code; checked the documentation diff and links. No runtime test was run.

### 2026-09-29 â€” Added Trick Room to the AV battle system

- Added Trick Room as a global five-cycle field with timeline Speed `25 / effective Speed`; it reverses action order and action frequency around the Speed-5 baseline. Lapras learns it at level 14, its re-cast ends the field, and the battle header shows remaining duration. Updated the reference move row and save schema to v23.
- Main files: `pokefiles/Moves.csv`, `src/game/{actionValue,engine,moveEffects,types}.ts`, `src/content/{moves,species}.ts`, `src/persistence/save.ts`, `scripts/playthrough-smoke-entry.ts`, [game plan](PLAN.md), [balance baseline](BALANCE.md), and [Battle Lab](BATTLE_LAB.md). `npm run build`, `npm run playthrough`, and `git diff --check` passed. The local Battle Lab confirmed the slower Lapras moved ahead of faster Pikachu under the field and showed its duration; the build retains the existing 1.41 MB battle-chunk advisory.

### 2026-09-29 â€” Restored the isometric cube route tokens

- Replaced circular medallions with flat, raised cube tokens based on the supplied route-map reference: broader diamond tops, pale stone sides, a slim dark underside, category-colored insets, smaller centered emblems, and turquoise links. Kept the non-spinning bobbing route marker. Updated the route art guide.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, and [route overhaul](ROUTE_OVERHAUL.md). Reviewed at the running local route screen; `npm run build`, `npm run playthrough`, and `git diff --check` passed. The build retains the existing 1.41 MB battle-chunk advisory.

### 2026-09-29 â€” Replaced route tiles with circular medallions

- Replaced the raised diamond plaques with round, category-colored route markers with dark rims, centered icons, and soft shadows. Kept route links, selection behavior, and node colors while giving markers a distinct silhouette against the diamond floor. Updated the route art guide.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, and [route overhaul](ROUTE_OVERHAUL.md). Visually checked the running local route screen; `npm run build` and `git diff --check` passed.

### 2026-09-29 â€” Refined route node plaques

- Reshaped the route nodes into smaller, shallower diamond plaques with muted bevels and compact emblems; softened the connecting paths so branches and tiles sit more naturally on the map floor. Updated the route art guide.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, and [route overhaul](ROUTE_OVERHAUL.md). Visually checked the running local route screen; `npm run build` and `git diff --check` passed.

### 2026-09-29 â€” Stabilized the route pyramid marker

- Removed the spinning projection and replaced it with fixed, clearly layered pyramid facets; kept the gentle vertical bob. This avoids the route marker changing shape or breaking during rotation.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, and [route overhaul](ROUTE_OVERHAUL.md). `npm run build` and `git diff --check` passed; verified the static pyramid and bobbing marker in the locally running route screen.

### 2026-09-29 â€” Animated pyramid route marker

- Replaced the route-selection avatar with a downward-pointing SVG pyramid above the current route position. It spins around its vertical axis and bobs up and down; reduced-motion settings turn off both animations. Updated the route art guide to describe the current marker.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, and [route overhaul](ROUTE_OVERHAUL.md). `npm run build` and `git diff --check` passed; viewed the spinning and bobbing marker on the running local route screen.

### 2026-09-29 â€” Added volume to the route pyramid marker

- Reworked the route marker as a perspective-projected square-base pyramid with separate top and visible side facets. Its face geometry updates as it rotates, keeping it visibly three-dimensional and pointed down instead of flattening edge-on like a 2D sprite. Updated the route art guide.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, and [route overhaul](ROUTE_OVERHAUL.md). `npm run build` and `git diff --check` passed; verified the changing top and side facets in the locally running route screen.

### 2026-09-29 â€” Fixed AP gain and once-per-turn Move command

- Replaced the prior Movement-based AP gain with a fixed 3 AP per PokÃ©mon turn. AP still banks between turns. Each PokÃ©mon may issue one Move command per turn for a flat 1 AP, within its Movement tile range, and one Attack command; the enemy planner follows the same limit. Added and migrated the per-turn Move flag with save schema v22. Updated the gameplay rules, UI guidance, scaling and balance notes, and scripted playthrough coverage.
- Main files: `src/game/{engine,grid,enemyPlanner,types}.ts`, `src/persistence/save.ts`, `src/ui/BattleScreen.tsx`, and `scripts/playthrough-smoke-entry.ts`; related docs: [early build plan](PLAN.md), [balance baseline](BALANCE.md), [Battle Lab](BATTLE_LAB.md), [scaling guide](SCALING.md), [UI direction](UI_OVERHAUL_PLAN.md), and [README](../README.md). `npm run build`, `npm run playthrough`, and `git diff --check` passed. The playthrough checked 100/125/200 SPD intervals and proportional Speed rescheduling, fixed 3 AP gain, 1 AP multi-tile movement, blocked repeat Move and Attack commands, AP banking, and the campaign/effect smoke cases. The production build retains its advisory about the 1.41 MB battle chunk.

### 2026-09-29 â€” Continuous Speed and Action Value timeline

- Replaced round-by-round Speed sorting with per-unit next-action AV scheduling: turns use `10,000 / effective Speed`, waiting AV rescales when Speed changes, and move effects can advance or delay the next action of waiting or acting units. AP still comes from Movement. Timed effects and periodic damage now follow 2,000-AV cycles; save schema v21 migrates earlier active battles and timer values. Updated the battle HUD and relevant rules, balance, UI, Battle Lab, and scaling guidance.
- Main files: `src/game/{actionValue,engine,moveEffects,types}.ts`, `src/persistence/save.ts`, `src/ui/BattleScreen.tsx`, `src/styles/battle.css`, and [early build plan](PLAN.md), [balance baseline](BALANCE.md), [scaling guide](SCALING.md), [Battle Lab](BATTLE_LAB.md), and [UI direction](UI_OVERHAUL_PLAN.md). Reviewed scheduler, migration, and Speed/AP references and checked the scoped diff; no automated test or gameplay playthrough was run.

### 2026-09-29 â€” Movement-based action point gain

- Changed each PokÃ©mon's AP gain at turn start to `max(1, floor(Movement))`. Speed still controls turn order, while Movement now controls both AP gain and the tile limit per Move command. Updated the battle rules, balance baseline, scaling guidance, and ability cue wording to match.
- Main files: `src/game/engine.ts` and [early build plan](PLAN.md), [balance baseline](BALANCE.md), [scaling guide](SCALING.md), and [audio guide](AUDIO_ASSETS.md). Checked all AP and Speed references for stale wording and reviewed the scoped diff; no gameplay playthrough was run.

### 2026-09-29 â€” Analyze and trim the Phaser battle bundle

- Added an opt-in production bundle treemap (`npm run analyze`). The report showed Phaser dominated the lazy battle chunk, so the Vite resolver now uses Phaser's supplied build without Matter Physics, which the board does not use. The chunk fell from 1.53 MB / 355 KB gzip to 1.41 MB / 320 KB gzip; the 500 KB uncompressed-size warning remains. Updated the scalability audit with the result and the next tuning boundary.
- Main files: `vite.config.ts`, `package.json`, `package-lock.json`, and [scalability audit](SCALABILITY_AUDIT.md). `npm run analyze`, `npm run build`, and `git diff --check` passed. No gameplay playthrough was run.

### 2026-09-29 â€” Route node and event authoring guide

- Added a developer guide for adding route node kinds, weighted event outcomes, recruitment offers, saved event state, graph migrations, and review steps. Linked it from the route overview and clarified current special and recruitment screen behavior.
- Main documents: `docs/ROUTE_NODE_EVENTS.md`, `docs/ROUTE_OVERHAUL.md`, and this index. Documentation-only change; links and `git diff --check` were reviewed.

### 2026-09-29 â€” Weighted special encounters and recruitment nodes

- Replaced the fixed special-node choice with a saved 75/25 positive/negative encounter roll. Positive outcomes award 50â€“100 coins in 10-coin steps, grant a Sitrus Berry, or restore 25% HP; negative outcomes remove half the coins or deal 20% HP damage. Kept recruiting on a separate route node with three choices, including rare non-starter PokÃ©mon, and full-roster replacement handling. Save schema v20 migrates earlier route progress.
- Main files: `src/game/{route,engine,types}.ts`, `src/ui/{RouteScreen,RouteStopScreen}.tsx`, `src/app/App.tsx`, and `src/persistence/save.ts`. Rules and review targets are in [route overhaul](ROUTE_OVERHAUL.md) and [party builder](PARTY_BUILDER.md). `npm run build` and scoped `git diff --check` passed; no gameplay playthrough was run.

### 2026-09-29 â€” Route climbs toward the boss

- Reversed the vertical route presentation so the starting tile and column-one battle sit near the bottom and the column-ten boss sits at the highest point. Initial and post-node scrolling keeps the current tile and next higher choice visible. The guide's up button now moves toward the boss and down moves toward the start. Saved node order, connections, and rewards are unchanged.
- Main file: `src/ui/RouteScreen.tsx`; the current layout and review notes are in [route overhaul](ROUTE_OVERHAUL.md) and [UI progress](UI_OVERHAUL_PLAN.md). The production build and `git diff --check` passed; no visual browser review or gameplay test was run.

### 2026-09-29 â€” Vertical route layout

- Repositioned the ten progression columns as rows from top to bottom, with branch choices spread across the board width. The route now scrolls vertically; mouse dragging, touch scrolling, wheel scrolling, up/down guide buttons, and current-position alignment use that axis. The saved route graph, node choices, rewards, and battle rules are unchanged.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`; behavior and review notes are in [route overhaul](ROUTE_OVERHAUL.md) and [UI progress](UI_OVERHAUL_PLAN.md). The production build and `git diff --check` passed; no gameplay playthrough or automated test was run.

### 2026-09-29 â€” Level-up move choices and Technical Machines

- Removed free move swapping from the route Party panel. Newly eligible level moves now create saved choices on the XP screen: replace one active move or keep the current set. Route progression waits until each choice is resolved. Ordinary evolution retains the prior active slots and learned history. Added single-use TM Swift (a TM-only move) and TM Thunderbolt, species compatibility lists, Bag teaching controls, shop stock, and named placeholder TM icons. TMs cannot be held.
- Main files: `src/game/engine.ts`, `src/game/types.ts`, `src/content/{moves,species,items,shop,catalog}.ts`, `src/ui/{RouteScreen,IntermissionScreen}.tsx`, `src/app/App.tsx`, `src/persistence/save.ts`, `src/styles/{route-party,route-overlays}.css`, and `public/assets/ui/icons/item-tm-*.svg`. Rules and authoring notes are in [early build plan](PLAN.md), [route overhaul](ROUTE_OVERHAUL.md), [scaling guide](SCALING.md), and [asset authoring guide](UNIT_MOVE_ABILITY_ASSETS.md). Save schema v19 migrates v18 and older saves without replaying past offers. The production build and `git diff --check` passed; no gameplay playthrough or automated test was run.

### 2026-09-29 â€” Position selection UI pass

- Reworked battle preparation around readable full-width roster rows, a six-unit meter, visible active PokÃ©mon, explicit Add/Remove actions, and clearer HP/status details. Framed the isometric map closer, enlarged its deployed sprites, marked ally/enemy sides and the active tile, and strengthened the placement message. Constrained the horizontally scrollable roster so the phone layout stays within the viewport. Battle placement rules are unchanged.
- Main files: `src/ui/PrepareScreen.tsx`, `src/ui/DeploymentBoard.tsx`, `src/styles/deployment.css`, `src/main.tsx`; behavior and review notes are in [route overhaul](ROUTE_OVERHAUL.md) and [UI progress](UI_OVERHAUL_PLAN.md). Visually reviewed the screen at 1280Ã—720 and 390Ã—844 and checked switching the active PokÃ©mon and choosing a tile. The production build and `git diff --check` passed; no gameplay test was run.

### 2026-09-29 â€” Compact route HUD and inventory

- Moved the route currency display into a small coin row and aligned smaller Party and Bag buttons beneath it so the route map has more room. Added a route inventory panel showing grouped bag items, their effects, and items held by each PokÃ©mon, with a Manage Team action for equipping. Both panels share the route visual style and keyboard dismissal. Item ownership and use rules are unchanged.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route-party.css`; behavior and layout are in [route overhaul](ROUTE_OVERHAUL.md). Visually reviewed the HUD and Bag panel at desktop and 390Ã—844, including navigation to Party and Escape focus return. The production build and `git diff --check` passed; no gameplay test was run.

### 2026-09-29 â€” Route tokens and Travelling Team polish

- Reduced the route nodes' stone depth and footprint to make the encounter emblems and route paths clearer. Replaced the route Party control's plain symbol with a pixel emblem and visible roster count. Rebuilt Travelling Team cards around type, HP, ability, held item, and equipped moves, with expandable loadout controls and a fainted state. This makes the route's roster readable before committing to a node without changing team or route rules.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, `src/styles/route-party.css`, `src/main.tsx`; design and behavior are recorded in [route overhaul](ROUTE_OVERHAUL.md). Visually reviewed route nodes and the Party panel at 1280Ã—720 and 390Ã—844 in a local browser. The production build and `git diff --check` passed; no gameplay test was run.

### 2026-09-29 â€” Route flow UI and XP award animation

- Added a compact route guide with next-column progress, hovered or focused node details, and pan controls; improved route Party health display, store item cards, and special reward choices. The linked preparation screen now shows each PokÃ©mon's idle battle sprite on the isometric map, adds roster HP bars, and fits its battle action within the viewport at shorter desktop heights. The post-battle screen counts XP into saved totals, wraps its level bar at level-up, and reveals a level-up badge; reduced motion shows final values immediately. These changes make the route, placement, and reward steps easier to read without changing their game rules.
- Main files: `src/ui/RouteScreen.tsx`, `src/ui/RouteStopScreen.tsx`, `src/ui/PrepareScreen.tsx`, `src/ui/DeploymentBoard.tsx`, `src/ui/IntermissionScreen.tsx`, `src/styles/route.css`, `src/styles/route-overlays.css`; details are in [route overhaul](ROUTE_OVERHAUL.md) and [animation guide](ANIMATION_ASSETS.md). The production build and `git diff --check` passed. Visually reviewed the route guide, horizontal pan, Party panel, and deployment map in a local 1280Ã—720 browser view; the store and XP animation were not visually played through in this pass. The app runs locally at `http://127.0.0.1:5173/`.

### 2026-09-28 â€” Starting party selection UI pass

- Reworked the new-run draft with a clearer team column, six-point meter, compact roster cards, a larger catalog, type filtering, and a persistent level-10 stat inspector. All eight current choices fit in one desktop row; type-colored accents distinguish the shared placeholder portraits. Unaffordable PokÃ©mon remain inspectable while selection still obeys the existing point budget.
- Main files: `src/ui/PartyBuilder.tsx`, `src/styles/party-builder.css`, `src/styles/menus.css`, `src/main.tsx`; behavior and layout are in [party builder](PARTY_BUILDER.md) and [UI progress](UI_OVERHAUL_PLAN.md). The local production build and `git diff --check` passed. Visually reviewed the screen and selected three PokÃ©mon in a local 1265Ã—713 browser view; narrow viewport appearance was not visually checked.

### 2026-09-28 â€” Scripted gameplay playthrough

- Added a repeatable local smoke playthrough (`npm run playthrough`) because the previous move-effect refactor had only been compiled. With a fixed battle seed and a three-PokÃ©mon party, it completed draft, route choice, preparation, a six-round first-battle win, XP and coin rewards, and return to column two in 69 committed actions. Battle Lab checks also passed for Sandstorm, Harden, Water Pulse displacement, Rock Throw cover, Ember Burn, Thunder Shock chaining into a Ground-type immunity, and enemy weather selection without redundant recasting.
- Main files: `scripts/playthrough-smoke-entry.ts`, `scripts/playthrough-smoke.mjs`, `package.json`; usage and scope are in [Battle Lab](BATTLE_LAB.md). The script passed locally. It exercises game rules directly; rendered UI, animation timing, and later route columns were not checked because browser visual access remains unavailable after the prior account usage-limit approval rejection.

### 2026-09-28 â€” Shared move-effect handlers

- Moved the six cast and hit effect families from engine branches into typed handlers with validation, resolution, preview, and AI scoring hooks. Catalog checks, enemy Status choices, damage-move tie breaking, and hover details now use those hooks. The engine keeps AP, direct damage, seeded RNG, and explicit cast-then-hit execution order.
- Main files: `src/game/moveEffects.ts`, `src/game/engine.ts`, `src/game/enemyPlanner.ts`, `src/content/catalog.ts`, `src/ui/BattleScreen.tsx`; the contract is in [scaling guide](SCALING.md) and the finding is updated in [scalability audit](SCALABILITY_AUDIT.md). The local production build completed; no gameplay test or browser playthrough was run.

### 2026-09-28 â€” Optimization audit and deployment preview reuse

- Reviewed the current bundle, documented 32Ã—32 render profile, battle redraws, save scheduling, route overlays, and preparation UI. The measured battle hotspot already has a target-preview cache; a renderer rewrite has no current evidence. Memoized static deployment SVG terrain and map geometry, indexed occupants by tile, and omitted empty actor groups so placement edits do less repeated work without changing placement rules.
- Main file: `src/ui/DeploymentBoard.tsx`; findings and remaining measurement priorities are in [scalability audit](SCALABILITY_AUDIT.md) and [scaling guide](SCALING.md). The local production build completed and `git diff --check` passed. No new browser frame measurement was taken; visual browser access remains unavailable after the account usage-limit approval rejection.

### 2026-09-28 â€” Shared palette and clearer XP rewards

- Brought title options, route HUD, shop/special stops, preparation, battle HUD, and result panels closer to the same navy, paper, raspberry, and gold palette. Shop/special and result now share the route tile floor. Reworked the growth screen with a reward summary, clearer per-PokÃ©mon XP cards and progress, level-up cues, milestone messages, and reduced-motion-aware animation; battle reward rules are unchanged.
- Main files: `src/styles/theme.css`, `src/styles/menus.css`, `src/styles/route.css`, `src/styles/route-overlays.css`, `src/ui/RouteStopScreen.tsx`, `src/ui/ResultScreen.tsx`, `src/ui/IntermissionScreen.tsx`, [UI progress](UI_OVERHAUL_PLAN.md), [route guide](ROUTE_OVERHAUL.md), and [start screen guide](START_SCREEN_OVERHAUL.md). The local production build completed and `git diff --check` passed. Browser visual review remains unavailable following automatic approval review's account usage limit.

### 2026-09-28 â€” Route-linked deployment and XP screens

- Restyled battle preparation and post-battle growth to match the route selector's translucent overlay treatment. Preparation keeps the live isometric placement board and adds a Back action to return to route choice; growth now shows each PokÃ©mon's portrait, level, awarded XP, progress, and HP in cards, with other rewards below.
- Main files: `src/ui/PrepareScreen.tsx`, `src/ui/IntermissionScreen.tsx`, `src/ui/RouteScreen.tsx`, `src/app/App.tsx`, `src/game/engine.ts`, `src/styles/route-overlays.css`, [route behavior](ROUTE_OVERHAUL.md), and [UI progress](UI_OVERHAUL_PLAN.md). The local production build completed. Browser visual review remained unavailable because automatic approval review reported the account usage limit.

### 2026-09-28 â€” Aligned, draggable route graph

- Aligned the start tile and first battle with the route's center row, widened columns and rows, and expanded the horizontal map through the boss. Added mouse and touch drag scrolling with a movement threshold so dragging an available node does not select it.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, [route behavior](ROUTE_OVERHAUL.md), and [UI progress](UI_OVERHAUL_PLAN.md). The local production build completed; browser review remained blocked by automatic approval review because the account usage limit was reached. No gameplay test was run.

### 2026-09-28 â€” Tile-only route floor

- Replaced the route selector's decorative ruined-stone backdrop with a repeating isometric limestone tile asset. The route graph, raised encounter tokens, avatar, and HUD remain in their existing positions; only the floor art changes.
- Main files: `public/assets/backgrounds/route-tiles.svg`, `src/styles/route.css`, [route art guide](ROUTE_OVERHAUL.md), and [UI progress](UI_OVERHAUL_PLAN.md). Local production build completed. Browser review was blocked by automatic approval review when the account usage limit was reached.

### 2026-09-28 â€” Raised route token detail pass

- Refined the isometric route tokens with shaded stone sides, inset borders, stronger grain, a detailed sword, a bright four-point elite emblem, and a pink-haired route avatar to follow the supplied image more closely. Removed the leftover rule that grayed out locked future nodes. Route generation and selection rules are unchanged.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, `public/assets/ui/route-trainer-placeholder.svg`, and [route art guide](ROUTE_OVERHAUL.md). The local production build completed and the route was visually inspected in a 1280Ã—720 browser viewport. No gameplay test was run.

### 2026-09-28 â€” Removed project-local game development skill pack

- Removed all 74 locally installed skills from `gamedev-skills/awesome-gamedev-agent-skills`, deleted the tracked `skills-lock.json`, and removed the unused `.agents/` ignore rule. Project guidance remains in `AGENTS.md` and `docs/`; game code and assets were not changed by this removal.
- Main files: `skills-lock.json` (deleted), `.gitignore`, and [scaling guide](SCALING.md). Checked that every lock entry belonged to the same source and that `.agents` and the lock file no longer exist. No build was needed for this tooling-only change.

### 2026-09-28 â€” Stone-ruins route selector reference pass

- Replaced the washed cavern route backdrop with original pale isometric ruins art, added a transparent pixel explorer marker, and enlarged and textured the colored raised node tiles. The route now uses blue links, amber choice pointers, a left coin/Party HUD, and a small upper-right back button without a large banner over the map. Kept the ten-column graph and legal-node rules; adjusted SVG framing and scroll positioning so the active tile and next choice remain visible on narrow screens.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, `public/assets/backgrounds/route-ruins-pixel.png`, `public/assets/ui/route-trainer-placeholder.svg`. Updated [route art and behavior](ROUTE_OVERHAUL.md) and [UI progress](UI_OVERHAUL_PLAN.md). Local production build completed; visually reviewed the route at 1920Ã—1080 and 390Ã—844 in the local browser. No gameplay test was run.

### 2026-09-28 â€” Route-only party management

- Moved four-move loadout editing, held-item assignment, and eligible evolution into each PokÃ©mon's expandable card in the route party panel. Removed loadout editing from battle preparation and evolution actions from the post-battle growth report; preparation now focuses on deployment. The engine rejects evolution outside the route phase.
- Main files: `src/ui/RouteScreen.tsx`, `src/ui/PrepareScreen.tsx`, `src/ui/IntermissionScreen.tsx`, `src/app/App.tsx`, `src/game/engine.ts`, `src/styles/route.css`. Updated [route behavior](ROUTE_OVERHAUL.md), [game rules](PLAN.md), and [UI progress](UI_OVERHAUL_PLAN.md). Local production build completed; no gameplay test was run.

### 2026-09-28 â€” Reference-matched route UI and four-node branches

- Rebuilt the route screen around the supplied references: a full-screen isometric stone grid, raised layered nodes, cyan links, cyan-glowing choices with amber pointers, a lead-PokÃ©mon marker, coin and party controls, a responsive translucent party overlay, and a compact title return control.
- Expanded seeded route generation from fixed two-node middle columns to two through four nodes, with four-node layouts guaranteed in columns 4 and 7. Save schema v18 remaps v16â€“v17 progress onto the expanded graph.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`, `src/game/route.ts`, `src/persistence/save.ts`, `src/app/App.tsx`. Updated [route behavior](ROUTE_OVERHAUL.md), [UI direction](UI_OVERHAUL_PLAN.md), and the [scaling guide](SCALING.md). Production build completed; 50 generated seeds passed node-count checks; the route and party overlay were reviewed at 1920Ã—1080 and 390Ã—844.

### 2026-09-28 â€” Isometric route selector tiles

- Changed the route graph presentation to raised diamond tiles with pale stone sides, colored encounter tops, blue connecting paths, and an isometric grid backdrop to follow the supplied reference. Route rules and keyboard selection remain the same.
- Main files: `src/ui/RouteScreen.tsx`, `src/styles/route.css`. Updated [route behavior](ROUTE_OVERHAUL.md). Local production build completed.

### 2026-09-28 â€” Four-move loadouts and cross-shaped move menu

- Every current species and form has four distinct starting moves, with five basic moves added to fill type and range gaps. New and recruited PokÃ©mon equip four moves; later level unlocks remain learned and can replace any preparation slot. Selecting an already equipped move swaps its slot. Enemies and Battle Lab use four-move default loadouts, and v17 save migration expands earlier two-slot runs and active battles.
- The Attack menu now places four move buttons above, left, right, and below its central Back button, matching the supplied image. Move descriptions remain in a separate tooltip so hover does not shift the menu.
- Main files: `src/content/moves.ts`, `src/content/species.ts`, `src/game/engine.ts`, `src/ui/PrepareScreen.tsx`, `src/ui/BattleScreen.tsx`, `src/styles/battle-menu.css`, `src/persistence/save.ts`. Updated the [rules](PLAN.md), [UI plan](UI_OVERHAUL_PLAN.md), [Battle Lab](BATTLE_LAB.md), [balance notes](BALANCE.md), and [scaling guide](SCALING.md). Local production build completed; no gameplay test was run.

### 2026-09-28 â€” Battle menu anchor and hover correction

- Kept the action menu centered above the acting PokÃ©mon whenever viewport space permits. Move descriptions now render in a separate, pointer-transparent tooltip, so hover no longer changes the menu height or moves buttons under the pointer. Attack and movement targeting now show only Back in the menu; their ranges remain visible on the board.
- Main files: `src/ui/BattleScreen.tsx`, `src/styles/battle-menu.css`. Updated the [UI overhaul plan](UI_OVERHAUL_PLAN.md). Local production build completed; no gameplay test was run.

### 2026-09-28 â€” Floating translucent battle commands

- Removed the contextual menu's outer panel and connector. The command buttons and supporting move information use see-through glass surfaces, and the menu tracks above the active PokÃ©mon or moves below it when the top HUD blocks the space. Narrow screens use the same unit anchor instead of a bottom sheet.
- Main files: `src/ui/BattleScreen.tsx`, `src/styles/battle-menu.css`, `src/styles/battle.css`, `src/styles/battle-actions.css`. Updated the [UI overhaul plan](UI_OVERHAUL_PLAN.md). Local production build completed; no gameplay test was run.

### 2026-09-28 â€” Glass battle action menu and move choice

- Reworked the contextual battle popup to match the supplied sketch: four main commands, a small move grid with hover/focus descriptions, compact targeting and movement range states, Back and Use Item for Special, and Yes/No confirmation for End. The map still commits attacks and movement by tile click, and existing range/effectiveness overlays remain authoritative.
- Main files: `src/ui/BattleScreen.tsx`, `src/app/App.tsx`, `src/styles/battle-menu.css`, `src/main.tsx`. Updated the [UI overhaul plan](UI_OVERHAUL_PLAN.md), [Battle Lab guide](BATTLE_LAB.md), and [scaling guide](SCALING.md). Local production build completed; no gameplay test was run.

### 2026-09-28 â€” Master record established

- Added this document as the documentation index and running change record, linked it from `README.md`, and added the update rule to `AGENTS.md` so later changes are recorded here.
- Reviewed the existing docs, working tree, and Git history to backfill the entries below. No gameplay behavior changed for this entry.

### 2026-09-28 â€” Special-node recruitment at a full roster

- The special encounter now lets the player select a recruit and confirm which owned PokÃ©mon leaves when the roster is at 20. The engine validates the offered species and replacement ID, returns a held item to the bag, transfers the selected party slot, and advances the route. The 18-coin reward remains available.
- Main files: `src/game/engine.ts`, `src/ui/RouteStopScreen.tsx`, `src/app/App.tsx`, `src/styles/route.css`. Updated [route behavior](ROUTE_OVERHAUL.md) and the [mechanics audit](GAMEPLAY_MECHANICS_AUDIT.md). Local production build completed; no gameplay test was run.

### 2026-09-28 â€” Unit, move, and ability asset authoring guide

- Added [asset authoring instructions](UNIT_MOVE_ABILITY_ASSETS.md) for unit sheet sizes and facings, portraits and shadows, named move effects and sounds, ability trigger sounds, file naming, manifest registration, and replacement checks. Linked it from the README and related asset docs.
- Documentation only; the guide records that ability triggers currently have named sounds and text callouts, while per-ability artwork requires renderer support.

### 2026-09-28 â€” Assignable placeholders for future moves

- Added six four-frame move effect sheets and matching WAV cues for melee, projectile, area, self, hazard, and weather roles. New moves select role assets automatically or through optional `visualId` and `soundId`; a named manifest entry keyed by the move ID takes priority. Added startup checks for unknown asset IDs.
- Main files: `src/content/moveAssetRoles.ts`, `src/battle/moveVisuals.ts`, `src/battle/Board.tsx`, `src/audio/audio.ts`, the animation and audio manifests, and the placeholder generators. See the [visual preview](MOVE_PLACEHOLDER_PREVIEW.png), [animation guide](ANIMATION_ASSETS.md), and [audio guide](AUDIO_ASSETS.md). Local production build and asset format checks completed.

### 2026-09-28 â€” Shared interface palette

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
| 2026-09-26 | `8f51b9a` | Centralized PokÃ©mon-style direct damage calculation in `src/game/damage.ts`. |
| 2026-09-26 | `0b278a4` | Created the first playable React/Phaser battle engine, content catalog, asset manifests, save system, and design plan. |
