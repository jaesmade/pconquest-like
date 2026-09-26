# Scalability review

The new target assessment for 32×32 maps, competitive 8v8, 20 total owned Pokémon, and 60 FPS is in [SCALABILITY_TARGETS.md](SCALABILITY_TARGETS.md). This earlier review describes the current prototype.

Review date: 2026-09-26. This is a code and architecture review of the early build. A local Node benchmark covers serialization and cloning on synthetic 8×8, 64×64, and 128×128 maps; low-end-device and browser frame profiles remain future work.

## Addressed in this review

| Area | Change |
| --- | --- |
| Long runs | Level growth stops at 100, matching the saved-unit validator. XP is capped at the level-100 threshold. |
| Mega forms | Mega stats now use the same level scaling as base forms. HP is clamped to base-form maximum when the battle ends. |
| Saves | Party HP, level, XP, moves, and items are normalized; battles reject invalid stats, types, abilities, items, status values, or AP. A failed browser save is visible in the top bar. |
| Save cost | Commands copy units and touched tile rows while sharing the rest of the map. v7 saves store authored map ID plus changed tiles and transient-free units. Saves are debounced after state commits and written to IndexedDB with the prior snapshot in a backup slot. v6 localStorage saves migrate on load. |
| Enemy decisions | Move damage is previewed once per target and move for each decision, instead of repeatedly inside a sort comparator. |
| Enemy turns | Enemy planning now yields after bounded candidate checks and path-search node expansions. One action is committed per browser frame, with animations allowed to finish before the next action. A remaining route is reused during the same enemy turn while target, occupancy, weather, and battle time stay compatible. Planning consumes no battle RNG. |
| Board redraws | React updates that only change callbacks or notices no longer redraw the entire grid. Processed animation IDs stay bounded by the retained visual-event window. |
| Assets | A battle loads only unit and attack sheets needed by its deployed units, plus shared effect and fallback sheets. |
| Content validation | Move costs, powers, areas, effects, species stats, and encounter levels reject more invalid numeric values at startup. |

## Remaining priorities

### Measured: save and clone cost

Run `node scripts/measure-save.mjs` to repeat the local synthetic-map benchmark. At 128×128 tiles, the previous full clone took about 13.4 ms and the v6 payload was 463 KB; the new command clone took about 0.003 ms and the v7 payload was 4.7 KB, with JSON serialization about 0.022 ms. Measurements vary by machine and do not include browser rendering or IndexedDB latency. The benchmark holds unit count and changed-tile count constant, so larger teams or extensive terrain changes still grow save size and command cost.

### Medium: rendering work still scales with every tile

`src/battle/Board.tsx` redraws the dynamic grid after a battle or selection change and checks line of sight for each potential target cell. It also creates matchup text objects during a redraw. For large boards, profile CPU frame time and object count first, then cache static attack-range overlays until source, map blockers, or weather changes; draw only visible cells when scrolling is introduced. The board currently assumes a full-map camera and one 64-pixel tile per logical cell.

### Medium: move and AI effect growth

`src/game/engine.ts` handles all cast and hit effect families in branching code, while enemy status-move selection separately understands weather, stages, and tile effects. Adding a new effect requires coordinating combat, AI usefulness, preview, and animation. Move effect handlers should expose explicit validation, resolve, preview, and AI-scoring hooks with a stable execution order. This is an architecture step, not a reason to add a generic event system before there are more effect families.

### Medium: animation playback backlog

Combat can enqueue many visual events immediately, while `src/battle/Board.tsx` plays attacks serially. The saved list is bounded, but the in-memory queue can grow during a long enemy phase and postpone player input. Later builds should cap or coalesce nonessential effects and distinguish the logical action timeline from visual playback. The existing animation manifest lets art be replaced without changing combat rules.

### Medium: content and save schema evolution

Content IDs are stable, but `src/content/catalog.ts` does not cover every semantic relationship or detect balance errors. Battle saves include live map data and references to current move, species, item, and ability definitions; changing those rules can alter a resumed battle. Future content packs need namespaced IDs, pack/version metadata, collision checks, and explicit migration or battle restart rules. The seven-number stat tuple also makes new stat fields error-prone; named stats would require a save migration.

### Lower: bundle and asset budgets

Phaser remains a large lazy-loaded battle chunk, and all shared effect sheets are still preloaded. This is acceptable for the small prototype. Set target devices and loading-time/memory budgets before splitting chunks or atlasing sprites; compare a production build on those devices before and after optimization.

## Review boundary

The current battle remains a small local, single-player prototype. This review does not establish an FPS target, maximum map size, maximum unit count, or multiplayer authority model. Those limits should be chosen before claiming large-battle performance.
