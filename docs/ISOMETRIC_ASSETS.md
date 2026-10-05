# Top-down battlefield asset guide

The battlefield and deployment map now use a Pokémon Mystery Dungeon-inspired, non-isometric top-down view. The authoritative square grid is drawn as 64×64 pixel cells: increasing x moves right and increasing y moves down. Battle, deployment, highlights, routes, effects, camera controls, contextual menus, and the minimap use the shared geometry in `src/battle/topDown.ts`.

## Visual contract

- Every floor is a square, including elevated ground and ramps. Elevation never shifts the tile, unit anchor, or click area. World bounds include a 64-pixel margin on every side; clicks outside the actual board return no cell.
- Original pixel-cluster woodland art uses layered greens, moss, warm dirt corridors, turquoise water, broadleaf and pine trees, rocks, logs, stumps, ferns, mushrooms, flowers, and grass tufts. The boss arena keeps its weathered paving, gold-and-green seal, ancient trees, and standing stones, redrawn for the same view.
- `terrainArt.ts` chooses deterministic floor variants without combat RNG. `terrainEdges` adds matching cardinal shore banks, grass borders on trails, and short ledge strips on higher ground. Borders stay inside the owning cell. Joined water has no internal shoreline, and ramp entrances have no ledge wall.
- Heights 0–2 remain tactical data: ramps still permit grounded ascent/descent and unconnected ledges still block it. Brighter grass distinguishes raised ground; ledge strips mark drops. Ramps use horizontal or vertical tread marks in the downhill direction, with stone treads in Heartwood.
- Static floor tiles, borders, and small vegetation are stamped into one Phaser render texture. Larger props use row depth; deployment uses the same square art and row order. There are no raised diamond surfaces or foreground cliff occlusion layers.
- Allies deploy along the bottom two rows and face straight up; enemies deploy along the top two rows and face straight down. The source sheet rows for logical south/west/east/north are now `[0, 6, 2, 4]`, replacing the diagonal mapping. Movement and attacks still turn units toward their action direction. Deployment crops the north-facing idle frame at the same 1.65× scale as battle.
- Unit frames sit at the center of each square in battle and deployment, replacing the earlier 12-pixel upward offset. Flying/swimming adjustments remain; ground shadows and ripples follow the lowered anchor. HP bars and movement animations use the same centered battle anchor.
- Left, right, or middle dragging pans; a short click selects a square. Wheel and camera controls zoom. Minimap terrain and its viewport outline use the same square geometry.

## Campaign maps

All seven arenas have been visually rebuilt with the new top-down floors, props, ramps, and neighbor-aware terrain borders. Their authored grid layouts, collision footprints, heights, IDs, deployment bands, and objectives are retained.

| Map ID | Battlefield | Size | Theme |
| --- | --- | --- | --- |
| `mossveil-grove` | Mossveil Grove | 16×16 | Branching dirt trails and wooded moss shelves. |
| `fernroot-woods` | Fernroot Woods | 16×16 | Rainy fern terraces and winding woodland corridors. |
| `sunshade-thicket` | Sunshade Thicket | 16×16 | Sunny meadow, upper lookout, and forest flanks. |
| `willowbrook-crossing` | Willowbrook Crossing | 16×16 | Brook banks, a two-cell dry crossing, and wooded ledges. |
| `pinewatch-rise` | Pinewatch Rise | 16×16 | Pine ridge, upper trail, and low valley. |
| `moonpool-elite` | Moonpool Clearing | 16×16 | Elite lake, two connected shore routes, and overlooks. |
| `ancient-heartwood` | Ancient Heartwood | 8×8 | Open 4×4 ceremonial stone arena, eight stone ramps, seal at [4,4], ancient trees, and four standing stones. |

Normal battles rotate through the five normal maps using `(column - 1) % 5`; elites and bosses retain their dedicated maps. The maps contain 1,394 connected unobstructed plain cells and 69 bidirectional ramps. The boss retains 50 connected ground cells and its defeat-and-capture objective. Deployment, ramp entrances, and capture cells remain clear of solid scenery.

## Assets and authoring

The active manifest is [top-down-manifest.json](../public/assets/environment/top-down/top-down-manifest.json). Generate all 59 original SVG assets with:

`node scripts/generate_top_down_assets.mjs`

Floors, border overlays, cardinal ramps, and props use a 64×64 viewBox with transparent surroundings where appropriate. Art is authored at 32 logical pixels and doubled with crisp edges. Keep floor images square and opaque; keep border overlays transparent away from their edge. Every prop fits its owning cell, so an obstacle's visible footprint agrees with its collision cell. The ancient-tree variant adds exposed roots. Collision and line of sight still come from `src/content/terrainObjects.ts`, independently of art.

Map authoring stays in `src/content/maps.ts`: terrain symbols are `./~/^/#`, surface symbols are `:/,/=/*`, and slope symbols are `^/v/</>`. Object symbols and movement/sight flags remain unchanged. Surfaces change appearance only. New asset families must be registered in the manifest so both renderers resolve the same URLs.

The old isometric SVG family, generator, projection source, and screenshots are retained as legacy material; the active renderers do not load them. This guide keeps its original filename so existing links stay valid. Unit sheets are still the shared species placeholders; see the [animation guide](ANIMATION_ASSETS.md) and [unit, move, and ability authoring guide](UNIT_MOVE_ABILITY_ASSETS.md).

## Preview and verification

With Vite running, open the [forest gallery](FOREST_MAP_PREVIEW.html) at `/docs/FOREST_MAP_PREVIEW.html`. It uses the actual battle and deployment renderers without reading or writing the campaign save. Choose an arena and switch views; use Fit map to inspect its full layout. The gallery fits each map once its camera is ready. See the [top-down boss preview](TOP_DOWN_BOSS_PREVIEW.png).

`npm run verify:forest` checks catalog validity, connected ground, bidirectional ramps, restricted ledges, all 1,600 cell centers, square interior/boundary picking, cardinal source rows and team facing, shoreline joins, open ramp borders, object movement/sight, all 59 asset dimensions and registrations, and campaign arena selection. `npm run playthrough` exercises campaign and Battle Lab combat. Production build and live visual review establish rendering compatibility; earlier isometric timing measurements do not measure this renderer.
