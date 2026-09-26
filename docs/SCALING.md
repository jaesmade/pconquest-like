# Extending the early build

This guide describes the code that exists now and the contracts to keep stable as the game grows. The first run still has a small roster, four encounters, and simple enemy decisions.

The [scalability review](SCALABILITY_AUDIT.md) records the current growth limits and priorities for larger battles and content packs.

The [32×32 competitive 8v8 reassessment](SCALABILITY_TARGETS.md) sets the map ceiling alongside 20 total owned Pokémon per player and a 60 FPS rendering target. The present build has smaller gameplay limits; use that reassessment for the next implementation phases.

## Where changes belong

| Area | Current home | Additions |
| --- | --- | --- |
| Types and multipliers | `src/content/typeChart.ts` | Keep the imported 18-type chart and dual-type multiplication here. |
| Abilities | `src/content/abilities.ts` | Add a stable ability name, description, and supported effect settings. Species and Mega forms reference these names. |
| Move definitions | `src/content/moves.ts` | Add a stable move key, type, category, power, range, target mode, AP cost, move tags, optional area and effects, and description. |
| Species, stats, learnsets, evolution | `src/content/species.ts` | Add species keyed by stable ID; put new starter and recruit IDs in their lists. |
| Held items | `src/content/items.ts` | Add a stable item name, description, and supported passive or Special effect settings. |
| Terrain and deployment zones | `src/content/maps.ts` | Use `createMap` with rectangular terrain, elevation, and A/N/E zone rows, plus default spawn coordinates. |
| Run order and rewards | `src/content/encounters.ts` | Add an encounter ID, `nextId`, map ID, enemy species IDs, enemy level, objective, and XP reward. |
| Cross-reference checks | `src/content/catalog.ts` | Extend `validateCatalog` when a new content relationship is introduced. |
| Battle state and rules | `src/game/types.ts`, `src/game/engine.ts` | Define a rule once and call it from player, enemy, and preview paths. |
| Menus and battle display | `src/main.tsx`, `src/ui/`, `src/battle/Board.tsx` | Keep React controls separate from Phaser grid rendering. The battle screen loads on demand. |
| Run persistence | `src/persistence/save.ts` | Bump the schema version and migrate older saves when the saved state shape changes. |
| Visual assets | `public/assets/animations/` | Follow [the animation asset guide](ANIMATION_ASSETS.md) and add manifest entries for new art. |
| Audio assets | `public/assets/audio/`, `src/audio/audio.ts` | Follow [the audio asset guide](AUDIO_ASSETS.md); add named move, item, and music URLs to the manifest without changing battle rules. |

`src/content/data.ts` is a barrel for existing imports. New content can live in its focused file; rule changes should remain in `src/game/engine.ts` or a future engine module.

## Adding a Pokémon or move

1. Give the species and moves stable IDs. Existing IDs are stored in browser saves, so rename them only with a migration.
2. Add moves in `moves.ts` and the species' seven stats, types, ability, starting moves, and level learnset in `species.ts`. Stats are HP, Attack, Defense, Special Attack, Special Defense, Speed, and Movement, in that order. Add `mobility: { fly: true }` or `{ swim: true }` for a form that needs it beyond the Flying/Water type defaults. Register any new ability in `abilities.ts` before assigning it to a species.
3. Add the species ID to `STARTERS`, `RECRUITS`, or an encounter only when it should appear there. A defined species can exist without joining either list.
4. Add battle art or let the renderer use the shared placeholder. Add move-specific effect art to the manifest when available; missing effects use the shared impact cue.
5. Set an AP cost, tags, and an existing target area and effect in the move definition. `tags` is an array, so a move can have several. Supported tags are `contact`, `punch`, `bomb`, `projectile`, `pulse`, `sound`, `weather`, and `hazard`. Tag by what the move actually does: a future punching move would usually use `['punch', 'contact']`, while a thrown bomb could use `['bomb', 'projectile']`. The current starter moves have no punch or bomb move, so those tags are ready for future content without mislabeling Rock Throw or Tackle. Ability damage bonuses can use `requiredTag`; Tough Claws and Static now read the `contact` tag. The engine handles status, displacement, tile effects, chain damage, stat stages, and weather from those definitions. One move use, including a Status move, consumes that Pokémon's Attack command for the turn; movement and Special can still spend remaining AP. For a new effect family, extend `MoveEffect` and its resolver and preview together. Existing item hooks cover round healing and threshold healing, Special Defense, Status move restrictions, Attack boosts, and Mega Evolution.

To add a held item, give it a stable name in `items.ts` and choose an existing effect shape. Consumables set `consume: true`; the battle unit keeps an Attack multiplier after X Attack is consumed. A Mega form is a complete species entry with its own stable ID, types, ability, stats, movement, moves, and art key. Put `form: { kind: 'mega', from: '<base-species-id>', stone: '<item-id>' }` on that form entry; do not nest Mega stats under the base species. `megaFormFor` indexes those relations for stone compatibility and battle transformation. Keep temporary forms out of starter and recruit lists. Item names and form species IDs are saved, so renaming either needs a migration.

Startup validation reports missing types, moves, evolutions, Mega Stones, encounter species, maps, objectives, spawn capacity, unusable deep-water spawns, and encounter-link cycles. It does not validate gameplay balance.

## Adding a map or encounter

`createMap` accepts terrain rows (`.` plain, `~` deep water, `^` lava, `#` wall), matching elevation rows (`0`–`2`), and matching zone rows (`A` ally, `N` neutral, `E` enemy). All rows must have the same width, with a maximum of 32 rows and 32 columns. Every tile belongs to exactly one zone, and each side needs at least eight plain deployment tiles for future 8v8 battles. Default player spawns must be in the ally zone and enemy spawns in the enemy zone. Every spawn and capture coordinate must be in bounds and off walls; spawns must be unique. Spawn and capture tiles must be connected without crossing walls. Coordinates are zero based `[x, y]`.

During preparation, select a Pokémon and click a legal ally-zone cell; clicking an occupied cell swaps the two placements when both can use the destination. Water requires swimming or flight, and lava and walls are unavailable for deployment. The solo opponent chooses distinct legal enemy-zone cells using the battle's seeded RNG. `startBattle(run, enemyDeployment)` also accepts an explicit ordered enemy placement and rejects invalid, missing, or duplicate cells for a future competitive opponent. Neutral tiles cannot be used during deployment. Once battle starts, the zones do not restrict movement. Selected placements are part of the run save; older saves receive legal default positions.

Add the map to `MAPS`, then reference its ID from an entry in `ENCOUNTERS`. The encounter determines enemy species, objective (`defeat` or `defeat-and-capture`), and XP. An encounter using the capture objective needs a map capture tile. The engine and Phaser board use the map's actual width and height for movement, attack areas, rendering, and weather cues. Existing example maps use 8×8 layouts; they are examples rather than a board-size requirement.

An encounter's stable ID, `nextId`, and `enemyLevel` determine progression and difficulty. The numeric `run.encounter` only tracks progress for the UI. Branching routes can choose a different next ID without reordering existing definitions.

## Saves and future rule families

The current format is v10 in the browser's IndexedDB database `pokemon-tactics-saves`. The `current` slot holds `{ schemaVersion, savedAt, run }` as JSON; the `backup` slot holds the previous complete snapshot. Battle maps save an authored map ID and signature plus changed tiles; the signature includes deployment zones. The run stores selected deployment coordinates. Units retain combat state and seeded RNG, while transient animation events are omitted. Loading restores the authored map, applies changed tiles, validates the battle, and falls back to the backup if the current slot is malformed. A changed authored map restarts that battle at preparation with a report message.

On first load, v9 saves migrate to v10. A unit using the old `mega` flag becomes its form species ID while retaining battle HP, AP, moves, and turn state. Earlier saves still receive the v9 level and HP migration; their active battles return to preparation. Loading accepts v7–v9 IndexedDB saves, v6 through v2 localStorage saves, and the older `pokemon-tactics-prototype-v1` shape. Legacy localStorage keys remain a fallback. React batches normal writes for 700 ms during battle and 150 ms outside battle, and requests a final write when the page is hidden or closed; an abrupt browser termination can still lose the latest unsaved command. Storage failure appears in the top bar.

## Damage calculation

`src/game/damage.ts` is the single source for combat damage and UI ranges. It uses the attacking Pokémon's level, move power, the relevant Attack/Defense pair, the modern stat stage ratios (−6 to +6), and integer base damage. Weather, a 1.5× critical hit, one of 16 equally likely random rolls from 85% to 100%, 1.5× same-type attack bonus, type effectiveness, and physical burn are applied in that order. Critical hits ignore negative offensive stages and positive defensive stages. The UI reports the possible normal and critical damage ranges; it does not consume battle RNG. The engine rolls critical chance (1 in 24) and damage variation when each target is hit.

Ability power bonuses are applied to base power, item Attack and Special Defense bonuses to the relevant stat, and snow/sandstorm defensive bonuses to Defense/Special Defense. Grid range, AP costs, terrain hazards, and secondary effects remain independent of direct move damage. New move-specific damage rules should be added as explicit calculator hooks rather than folded into a single final multiplier. Species stat growth in this fangame is still custom, so matching this damage pipeline does not imply complete main-series battle simulation.

When changing persisted fields, raise the schema version, keep a migration for existing versions, and preserve content IDs or map them explicitly. If a removed species, move, or encounter can occur in an old run, migrate it to an available replacement or reset that run deliberately; a type assertion alone cannot make old data valid.

Ability and item definitions and their supported effect settings live in `abilities.ts` and `items.ts`. Move effects and areas live in `moves.ts`, with their resolution in `engine.ts`; pathfinding and line of sight live in `grid.ts`. Mobility capability and current state live in `mobility.ts` and on each battle unit. The Phaser board reads that state to draw a flight shadow or swim ripple. When more effect families are added, split resolution into registries with explicit hooks for preview, apply, and visual event generation. Keep the AP scheduler independent of those handlers so Speed controls AP gained each round.

The board creates a Phaser sprite and HP bar for each unit, draws static terrain once, and redraws dynamic overlays when state changes. Target-only changes redraw a separate cursor and impact preview; the [32×32 browser profile](RENDER_PROFILE.md) records why this path was isolated. Movement search stores predecessor keys and reconstructs only the requested route; board highlights use reachable tile IDs. Enemy targeting skips moves whose damage preview is zero, including type immunity and absorption. `EnemyPlanner` checks decisions and attack-position path nodes in bounded batches, yielding to the browser between batches. The solo UI commits one action at a time and waits for movement or retained attack cues before continuing. The visual queue keeps no more than three waiting attacks, coalesces stale weather and repeated empty-target cues, and catches up with shorter animation timing when behind. Battle state retains only 24 recent cues; all are disposable and omitted from saves. Remaining route steps can be reused during the same enemy turn; changed targets or occupancy invalidate them. A saved battle may resume on an enemy turn and reconstruct the planner. Planning never rolls RNG, so combat and tie breaks remain reproducible from the saved battle state. Profile representative full matches before tuning larger maps or many units further. Keep combat outcomes in game state; animations only consume visual events and do not decide hits or damage.
