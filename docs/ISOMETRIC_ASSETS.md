# Isometric battlefield asset guide

The battle presents the existing square rules grid in a three-quarter isometric view. Movement, range, line of sight, weather, and damage still use integer `(x, y)` cells. `src/battle/isometric.ts` owns world coordinates and click conversion. Phaser draws tiles, highlights, routes, units, and attack effects through that projection; the React HUD uses it to place the contextual popup and minimap.

The [battle preview](ISOMETRIC_BATTLE_PREVIEW.png) captures an earlier first-encounter layout at 1440×900, with allies entering from the bottom grid edge and opponents from the top. The authored object positions have since changed. Unit models and portraits remain the named placeholder sheets.

## Visual frame

- Each tile top is a **96×48 pixel diamond**. Adjacent grid cells move 48 pixels sideways and 24 pixels downward in screen space.
- Elevation lifts a tile top by **20 pixels per level**. The tile art extends its earth or stone sides so all levels meet the same lower plane. The current map contract permits levels 0–2.
- A higher plain tile can carry a slope facing north, south, east, or west. Its open edge must touch a passable tile exactly one level lower. Ground units can ascend or descend only across that edge; flying units can cross height changes freely. Brown tread and green edge art marks the accessible side.
- The board has a deep navy surrounding color. The forest family uses original Pokémon Mystery Dungeon-inspired pixel clusters: layered grass and moss, warm dirt trails, root-lined earth cliffs, turquoise water, rounded broadleaf canopies, and tiered pine trees. Logs and stumps show bark and growth rings; ferns, mushrooms, flowers, and grass tufts add low vegetation. Lava uses orange crust and walls use gray stone.
- Gameplay overlays remain distinct: translucent green movement diamonds, blue move range, gold target/path, and colored effectiveness outlines. These are drawn by Phaser so art replacements cannot alter their meaning.
- Campaign maps put the ally deployment zone in the bottom two grid rows and the enemy zone in the top two, with the remaining rows neutral. Preferred spawns use each deployment band's inner row. Battle Lab uses the same top/bottom layout on a smaller grid. Allies face north and enemies face south at deployment; gameplay direction is based on grid axes.
- Drag the battlefield with the left mouse button to pan the camera. A short press and release still selects a tile. Right or middle dragging also pans; the mouse wheel and camera controls change zoom. The camera allows a small margin around the map so dragging is visible even when the whole map fits the viewport.

## Current campaign maps

| Map ID | Battlefield | Size | Authored terrain |
| --- | --- | --- | --- |
| `mossveil-grove` | Mossveil Grove | 16×16 | Wooded shelves, branching trails, moss and logs. |
| `fernroot-woods` | Fernroot Woods | 16×16 | Rainy fern terraces and winding routes through woodland clusters. |
| `sunshade-thicket` | Sunshade Thicket | 16×16 | Raised sunny meadow, upper lookout and open forest flanks. |
| `willowbrook-crossing` | Willowbrook Crossing | 16×16 | New brook arena with a two-cell dry crossing, bank paths and wooded terraces. |
| `pinewatch-rise` | Pinewatch Rise | 16×16 | New long pine ridge, upper trail and low valley beside a western shelf. |
| `moonpool-elite` | Moonpool Clearing | 16×16 | Dedicated elite lake with two grounded shore routes and raised overlooks. |
| `ancient-heartwood` | Ancient Heartwood | 8×8 | Compact boss capture dais at `[4,4]`, with two side approaches and an upper lookout. |

All seven forests have usable elevation levels 0–2 and explicit ramps. Every unobstructed plain tile is reachable by grounded Pokémon, including neutral shelves. Authored dirt trails are checked against the same movement rules, so a trail cannot lead through a solid prop or an inaccessible cliff. Ramp approaches, preferred spawns, and capture points remain clear of scenery. The top two rows are enemy deployment, the bottom two are ally deployment, and the intervening rows are neutral. Preferred spawns sit on each band's inner row.

Normal route battles rotate through `NORMAL_MAP_IDS` using `(column - 1) % 5`: Mossveil, Fernroot, Sunshade, Willowbrook, then Pinewatch, repeating in later columns. Elite and boss nodes retain their dedicated arenas. Selection does not consume combat RNG. Save restoration resolves deployment against the selected route map. Existing map IDs are retained; changed geometry causes older active battles to return to preparation while preserving party and route progress. Grass/path/moss surfaces are restored from authored content and do not need a save schema change.

## Preview and checks

With the Vite development server running, open [`/docs/FOREST_MAP_PREVIEW.html`](FOREST_MAP_PREVIEW.html) (for example `http://127.0.0.1:5173/docs/FOREST_MAP_PREVIEW.html`). This developer gallery uses the actual Phaser board and preparation SVG, with a map selector and battle/deployment views. It creates temporary preview combatants and does not read or write the campaign save.

The [Pinewatch preview](FOREST_MAP_PREVIEW.jpg) captures the finished deployment layout. All seven maps were inspected in both gallery views. The existing 32×32 browser fixture also passed its eleven live renderer assertions after these changes; its earlier published timing results do not measure this forest layer configuration.

Run `npm run verify:forest` for map connectivity, grounded ascent/descent, cliff restrictions, elevated click picking, clear deployment/objective cells, object movement/line of sight, all SVG dimensions, and campaign arena selection. `npm run playthrough` checks a real campaign battle and Battle Lab rules. These checks establish valid navigation and content, not encounter balance or release-device performance.

## Replaceable files

The runtime asset map is [isometric-manifest.json](../public/assets/environment/isometric/isometric-manifest.json). The base family consists of `iso-<kind>-h<level>-96px.svg` for `plain`, `water`, `lava`, and `wall` at levels 0–2; `iso-slope-<direction>-96px.svg` overlays for the four slope directions; and named scenery SVGs. Its `forestTiles` section registers grass, speckled grass, moss, and woodland path at each elevation. All are original assets generated by `scripts/generate_isometric_assets.mjs`. Run `node scripts/generate_isometric_assets.mjs --forest` to refresh the woodland family, water, props, and ramps; run without flags to preserve existing files, or with `--force` to replace every generated asset. The forest refresh leaves lava and wall art alone.

To replace a tile, preserve its **96-pixel width**, the diamond top corners `(48,0)`, `(96,24)`, `(48,48)`, `(0,24)`, and the height-specific side depth of `22 + 20 × level` pixels. The complete SVG heights are 72, 92, and 112 pixels, including a two-pixel outer allowance. Keep the outer background transparent and inspect neighboring tiles as a 3×3 patch. A slope overlay is 96×48 pixels and faces the lower neighbor on the named grid edge. New art can be PNG: change its URL in the manifest and load it with `this.load.image` instead of `this.load.svg` in `src/battle/Board.tsx`. Keep texture IDs stable or update the renderer lookup too.

`src/content/maps.ts` authors slopes as a separate character row: `^` north, `v` south, `<` west, `>` east, and `.` none. The parser rejects slopes that lack a one-level-lower neighbor. Keep slopes off deployment and capture tiles when placing tall scenery so entrances remain legible.

An optional `surfaces` layer uses `:` for woodland path, `,` for moss, and `.` for ordinary grass; these markers are valid only on plain terrain and have no movement or damage effects. `src/battle/terrainArt.ts` supplies the same texture choice to Phaser and the preparation SVG. Unmarked grass varies deterministically by cell coordinates without consuming combat RNG. Preparation paints terrain by grid diagonal, using the full elevation-specific image height and the 48-pixel ramp height, then sorts scenery and Pokémon by their grid footprints. `isoTileDepth` removes the elevation lift from the sorting coordinate while keeping the lifted screen position, so a foreground upper terrace still occludes low ground behind it.

## Terrain objects

Map objects have their own authored character layer in `src/content/maps.ts`. `.` means empty. The object catalog in `src/content/terrainObjects.ts` defines each object's art size, category, movement collision, sight collision, and whether it draws as a depth-sorted prop. Object cells must be plain ground without a slope.

| Symbol | Object | Category | Movement | Line of sight |
| --- | --- | --- | --- | --- |
| `T` | Tree | Obstacle | Blocked for every Pokémon | Blocked through the tree tile |
| `P` | Pine tree | Obstacle | Blocked for every Pokémon | Blocked through the tree tile |
| `R` | Rock | Obstacle | Blocked for every Pokémon | Blocked through the rock tile |
| `B` | Bush | Foliage | Passable | Clear |
| `L` | Fallen log | Obstacle | Blocked for every Pokémon | Clear |
| `S` | Tree stump | Obstacle | Blocked for every Pokémon | Clear |
| `V` | Fern | Foliage | Passable | Clear |
| `M` | Mushrooms | Detail | Passable | Clear |
| `F` | Flower | Detail | Passable | Clear |
| `G` | Grass tuft | Detail | Passable | Clear |

Solid objects are excluded from deployment, path previews, direct movement, enemy pathing, and forced displacement. Map creation rejects solid objects on spawn or capture points. All seven campaign maps contain authored object positions. The small Battle Lab map intentionally has none. Compact saves record an object-layer signature; older saves load the authored layer and return to preparation if a saved Pokémon stands inside a new solid object or the authored geometry changed.

The standalone [title island background](../public/assets/backgrounds/title-island-reference-inspired.png) was generated with the built-in image tool using the earlier user image as a **style and perspective reference**. The current title splash and menu use a CSS checkerboard backdrop and color washes to match the newer title-screen references; the island image is retained for future use and is not rendered on the start screen. The earlier image prompt was: “Create a wide 16:9 decorative title-screen scene of a floating grassy island with chunky brown earth cliffs, a bright blue river, a short waterfall, rounded leafy trees, scattered rocks and tiny flowers, surrounded by deep navy negative space. Isometric 3/4 view, crisp deliberate pixel clusters, saturated greens and turquoise water, soft dark vignette, readable silhouettes. Keep the center quiet for an HTML menu. No characters, Pokémon, text, UI, logos, or watermark.”

Pokémon action strips and attack effect sheets use the [animation manifest](../public/assets/animations/animation-manifest.json). Unit clips have their own frame sizes (32×40 through 80×88 in the current shared set), while move effects remain 32×32. The renderer places the unit's ground point near the projected tile center. The placeholder portrait and action strips can be replaced independently using [the animation guide](ANIMATION_ASSETS.md). Character art is still shared placeholder art, so its detail level does not yet match the new terrain.

## Current rendering limit

Terrain, slopes, and ground-level flowers, grass tufts, ferns, and mushrooms are stamped once into a static render texture for maps up to 32×32. Raised plain tile tops and their exposed front cliff strips also use depth-sorted layers so low actors behind a terrace do not paint across its surface. Low decorations on raised tiles join the scenery layer so the terrace top does not hide them. The cliff strips are clipped to the difference from the east/south neighbor's elevation; buried soil does not paint over adjacent ground. Phaser caches these small clipped textures, while preparation uses matching SVG clips. These layers add static scene objects; the earlier renderer profiles do not measure their cost.

Trees, pines, rocks, bushes, logs, and stumps use separate depth-sorted images anchored at their ground point. Pokémon and their shadows interpolate grid-footprint depth during movement while elevation determines their screen position. The range, route, target, hazard, and capture overlays draw above forest terrain and scenery so elevated cells stay legible; combat effects, HP bars, and damage labels remain above them. Object collision and sight blocking come from the authoritative tile object ID, independent of drawing order. The minimap marks every solid prop, including low logs and stumps.
