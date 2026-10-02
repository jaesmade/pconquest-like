# Scalability review

The new target assessment for 32×32 maps, competitive 8v8, 20 total owned Pokémon, and 60 FPS is in [SCALABILITY_TARGETS.md](SCALABILITY_TARGETS.md). This earlier review describes the current prototype.

Review date: 2026-09-26. This is a code and architecture review of the early build. A local Node benchmark covers serialization and cloning on synthetic 8×8, 64×64, and 128×128 maps; low-end-device and representative full-match browser profiles remain future work; a synthetic 32×32 browser profile was added later.

## 2026-10-02 follow-up: targeting, redraw allocation, UI derivation, and save fingerprints

- `aimBoundsForTarget` in `src/game/engine.ts` inverts each move's footprint so enemy targeting and attack-position search skip aim cells that cannot cover the defender. Interior unit attacks check one cell instead of nine; a 2×2 tile attack checks four instead of 25. Centered odd/even rectangles and corner anchors keep the surviving y/x order. Range, line of sight, scoring, AP, routes, and seeded RNG retain their rules.
- `npm run verify:targeting` compares 1,960 ordered aim sets, 274,400 hit results against an exhaustive board scan, and 140 planner actions against the prior broad scan. Mixed fixtures used 1,029 planner batches versus 1,219 before, across budgets 1, 2, 32, and 10,000. An interleaved warmed Node benchmark of 32×32, 16-unit Bubble pursuit retained its 56-tile path and 32 search batches while median CPU changed from 2.771 to 1.990 ms locally. This measures rule/search CPU, not frame scheduling or browser FPS.
- `src/battle/Board.tsx` reuses active matchup Text objects and destroys excess slots. Unit HP bars keep their Graphics commands while their displayed fill fraction and side remain unchanged; movement updates position through the transform, and retiring a unit clears its appearance cache. See [render measurements](RENDER_PROFILE.md) for browser allocation counters and limitations.
- `RouteScreen` caches route availability and visited membership, and indexes inventory quantities once per bag reference, preserving catalog ordering. `IntermissionScreen` caches participant membership, initial XP/level, maximum HP, and report derivation across its 40 ms animation ticks. Before/after rendered markup matched for route/party/inventory, TM and evolution pickers, empty inventory, and XP progress 0/0.4/1 with a 20-Pokémon roster. These UI changes have no measured FPS claim.
- Save snapshots cache the authored object/slope fingerprint alongside the existing geometry fingerprint, avoiding another full-map scan on every save. Authored definitions are immutable for the lifetime of their object reference; content replacement must use a new object. The repaired `npm run measure:save` uses independent authored synthetic maps, the current array draft API and actual save version, and checks transient tile deltas and same-ID content replacement. Local 32×32 warm serialization measured about 0.04–0.05 ms after caching versus 0.148 ms in the preceding run; the 16-unit/20-owned case measured about 0.11 ms versus 0.267 ms. These separate-run timings vary and exclude IndexedDB latency.

Production build and scripted gameplay checks are the regression gate for this pass. Full-match GPU/texture-memory profiling and release-device performance remain open; the changes do not establish competitive capacity or a higher FPS target.

## 2026-09-28 follow-up: current optimization check

The production build lazy-loads battle code. A bundle treemap (`npm run analyze`) showed Phaser was the main contributor because the default package entry bundled its full runtime. The board does not use Matter Physics, so Vite now aliases Phaser to its supplied arcade-physics build. On 2026-09-29 this reduced the battle chunk from 1.53 MB to 1.41 MB minified, and from 355 KB to 320 KB gzip (about 8%); the 500 KB chunk-size warning remains because Vite measures the uncompressed JavaScript. This is a loading-budget signal, not evidence of an in-battle frame bottleneck. The prior [32×32 browser profile](RENDER_PROFILE.md) measured target-preview and attack-range work and supports keeping the current Phaser renderer until a full-match profile on a declared device identifies a slower path.

The deployment preview rebuilt static SVG terrain and searched the selected roster for every tile on each placement update. `src/ui/DeploymentBoard.tsx` now memoizes map-derived cell coordinates, depth order, and static terrain elements by authored map reference; it builds a coordinate lookup for occupants and renders actor groups only for occupied or object tiles. Legal ally cells are recalculated when the focused species or map changes. Placement rules, art order, and the rendered hit cells remain the same. This is a source-level optimization, not a measured FPS improvement; the current authored battle maps are 8×8.

The remaining high-value checks are: profile a full 32×32, 8v8 battle on the chosen release device (including GPU/texture memory and animation bursts); measure preparation render/interaction time on a 32×32 authored map before adding further culling; and watch IndexedDB write latency if rapid committed states ever outpace the existing 700 ms battle/150 ms menu debounce. The current `saveRun` promise chain preserves write order but can queue stale snapshots if storage becomes slower than the save interval. Do not change save ordering or full-board rendering solely from this static audit.

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

`src/battle/Board.tsx` now redraws target previews separately from the full dynamic grid. The [32×32 browser profile](RENDER_PROFILE.md) measured attack-mode battle changes before and after caching the attack-range layer. That layer reuses its line-of-sight results while the actor, move, map, weather, and active cover remain compatible. Matchup labels still refresh with battle state; the fixture had one label and 70 scene objects during targeting after the change. The board has camera pan/zoom and viewport-sized canvas rendering; camera movement did not call `renderBattle` in the fixture. Static terrain remains a full-map render texture. Consider visible-cell culling only if a representative device profile shows a frame or memory problem.

### Medium: move and AI effect growth

The six current move-effect families now have `validate`, `resolve`, `preview`, and AI `score` hooks in `src/game/moveEffects.ts`. The engine calls them in authored order within cast and hit phases, the catalog uses their validation, move hover uses their preview, and enemy status choices use their score. The direct-damage and AP scheduler remain in `engine.ts`; there is no generic event system. Future effects still need deliberate choices about AI weight, animation cues, and whether they can run on chained hits. See the [scaling guide](SCALING.md) for the execution contract.

### Medium: animation playback backlog

Combat can enqueue many visual events immediately, while `src/battle/Board.tsx` plays attacks serially. The saved list is bounded, but the in-memory queue can grow during a long enemy phase and postpone player input. Later builds should cap or coalesce nonessential effects and distinguish the logical action timeline from visual playback. The existing animation manifest lets art be replaced without changing combat rules.

### Medium: content and save schema evolution

Content IDs are stable, but `src/content/catalog.ts` does not cover every semantic relationship or detect balance errors. Battle saves include live map data and references to current move, species, item, and ability definitions; changing those rules can alter a resumed battle. Future content packs need namespaced IDs, pack/version metadata, collision checks, and explicit migration or battle restart rules. The seven-number stat tuple also makes new stat fields error-prone; named stats would require a save migration.

### Lower: bundle and asset budgets

Phaser remains a large lazy-loaded battle chunk even after excluding Matter Physics; all shared effect sheets are still preloaded. The analyzer is available with `npm run analyze`. Set target devices and loading-time/memory budgets before building a custom Phaser runtime or atlasing sprites; compare a production build on those devices before and after optimization.

## Review boundary

The current battle remains a small local, single-player prototype. This review does not establish an FPS target, maximum map size, maximum unit count, or multiplayer authority model. Those limits should be chosen before claiming large-battle performance.
