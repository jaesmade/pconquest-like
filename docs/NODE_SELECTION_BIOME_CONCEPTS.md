# Living isometric node selection concepts

Date: 2026-10-12. Status: **Verdant node/path treatment implemented; themed backgrounds and other directions remain proposals**.

The [interactive comparison](node-selection-biome-concepts.html) presents four pixel art directions for a route selector that feels inhabited while retaining the familiar isometric layout. The user approved the mossy Verdant plinths, floating encounter symbols, and stepping-stone paths for production, with the current background explicitly preserved. Crystal Cavern, Lantern Garden, Ember Citadel, and all four themed scene images remain previews. The rejected flat Trail map remains recorded in the [UI history](UI_OVERHAUL_PLAN.md#pixel-node-selection-concepts-2026-10-12-proposed); it is not the baseline for this implementation.

## Current baseline

The live selector now uses clean raised limestone plinths, floating 3D pixel encounter icons, broken stepping-stone connections, and a smaller warm ivory/gold pixel pyramid for the current position. A later user-requested refinement removed moss trim, surface flecks, and green coloring from the node tiles; the original Verdant preview remains a design reference. Its active background remains the exact `public/assets/backgrounds/route-tiles.svg` file, repeated at 112 by 56 CSS pixels. Optional themed scene images illustrate future possibilities and have no production import. No scenic particles, water, foliage, or ruins have been added to the background.

The existing route retains ten bottom-to-top progression columns, two to four choices in middle columns, and four-node branches in columns 4 and 7. Only the next connected choices are legal. Touch and compact-screen pointer activation inspect a stop and retain its consequences before **Choose this stop** commits it; ordinary desktop clicks and Enter/Space enter directly. Node/path artwork does not change those rules, encounter rewards, RNG, saves, or route positions. See [current route behavior](ROUTE_OVERHAUL.md) and [node authoring](ROUTE_NODE_EVENTS.md).

## Approved production scope (2026-10-12)

`src/ui/RouteMossNode.tsx` renders the clean stone platforms and thick, projected pixel symbols using native canvas images inside the existing SVG controls. The filename is retained from the original mossy implementation. All seven kinds have symbols: crossed swords, star shield, mint cross/plus, shopfront, question mark, capture orb, and crown. Available symbols slowly turn and float above a small platform shadow; completed/future symbols stay still. Only visible available icons animate, and dialogs, pending ability choices, inactive backdrops, hidden pages, and reduced motion pause their motion. The current-position pyramid remains distinct on the occupied platform.

`src/ui/RouteScreen.tsx` retains the route's input and preview handlers and supplies saved link endpoints to `src/ui/RouteStonePath.tsx`. That helper draws static stepping stones with a continuous bed, small shadows, and moss flecks. Available branches remain clear; the inspected choice receives gold feedback, and completed stops have checks. `src/styles/route.css` supplies path/state and keyboard-focus presentation while retaining the existing floor repeat. The later control polish uses a compact three-control HUD and a responsive guide, with a centered desktop strip, portrait footer, and short-landscape sidebar. `RoutePositionMarker.tsx` supplies the smaller matching pyramid; [current marker/control details](ROUTE_OVERHAUL.md#position-marker-and-route-controls-2026-10-12) record its authoring and layout. See the [canonical art details](ROUTE_OVERHAUL.md#route-node-art-details) for state behavior and replacement guidance.

The interactive comparison remains a design preview with local selection feedback and optional scenery toggles. Its illustrative resources and graph do not replace the saved campaign graph. No concept PNG or WebP is imported by the game. The production build, complete gameplay/server-markup smoke suite, and independent desktop/phone/input/motion checks passed; [current captures and validation](ROUTE_OVERHAUL.md#route-node-art-details) record the implemented appearance and review scope.

## Four directions

| Direction | Node presentation | Path presentation | Two ambient motions |
| --- | --- | --- | --- |
| **Verdant Ruins** | Moss-edged raised limestone platforms beneath floating 3D encounter icons. Retain the substantial stone sides and dark contact shadow. | Broken limestone stepping stones, with a clear continuous connection trace between choices. | Two-frame leaf tips at the scene edges; occasional fireflies drifting through empty margins. |
| **Crystal Cavern** | Faceted stone sockets with corner crystal shards beneath the floating category icon. Crystal detail supports the silhouette without replacing it. | Stepped mineral seams over a dark under-stroke; available branches receive a stronger continuous trace. | Staggered small crystal glints; distant droplets followed by a tiny side-pool ripple. |
| **Lantern Garden** | Lacquered shrine platforms with a small side lantern, leaving the floating encounter icon unobstructed. | Flagstone bridges with small post pairs beside forks. Posts mark the environment rather than selectable stops. | Two-frame lantern flames; sparse petals crossing the outer scene. |
| **Ember Citadel** | Low basalt plinths, bronze edging, and corner masonry beneath the floating icon. | Riveted stone causeways with readable seams and restrained warm highlights. | Peripheral brazier flames; a few embers drifting upward. |

**Selected direction: Verdant Ruins nodes and paths.** Its masonry extends the current stone floor. The original moss trim remains in the comparison; production now uses the later clean-stone refinement. The user approved the node/path treatment while keeping the background. Peripheral scene motion remains a future option.

These are distinct structures and environments, not four palette swaps. Keep the large sword, star shield, healing cross, shopfront, question mark, recruitment emblem, and boss crown recognizable in every theme. The category meaning should remain consistent when the environment changes.

## Floating icon refinement (2026-10-12; preview)

At the user's request, the comparison replaces the upright stone boxes and carved plaques above the platforms with floating, spinning 3D pixel symbols. Rest uses a thick mint cross/plus; Shop uses a warm shopfront with a coral roof and striped awning; Battle uses crossed silver swords with bronze hilts; Recruit uses a coral-and-ivory capture orb. The future Elite and Mystery stops use subdued static trophy and question-mark symbols. The current-position pyramid remains distinct.

The symbols have actual projected thickness, shaded front/top/side faces, crisp silhouettes, and small pixel shadows on the platforms. Available icons make one slow turn in nine seconds by default, with a one-logical-pixel bob and staggered phases. Future stops stay still. Labels and selection rims do not spin; they preserve encounter identity when an icon turns edge-on.

The host controls provide **Spin icons** and **Seconds per turn** (6–16 seconds), independently of ambient scenery motion. Reduced motion freezes spin, bob, node travel, and ambience. The paused view holds a readable 3D angle. Preview state restores these settings and selections without changing any run or RNG. Extra transparent drawing space above each canvas prevents sword tips or roofs from clipping throughout a complete turn, without changing the platform positions.

This section records the preview refinement. Its floating-symbol approach is now also used by the production Verdant node renderer; the preview's spin/speed controls remain preview-only. The current stone background, route input rules, and saved campaigns retain their existing behavior.

## Selection and attention

- Preserve the raised tile and current-position pyramid as common anchors. The pyramid should remain visually stronger than decorative particles.
- Use the same state language across themes: teal framing and an amber pointer for available choices, a solid gold outline for the inspected choice, subdued future connections, and an explicit completed state. Pair color with shape and readable state text.
- Keep an opaque or strongly separated pixel panel behind descriptions and controls. Themed scenery must not reduce the contrast of labels, paths, or hit areas.
- Place ambient scenery motion in peripheral spaces. The requested icon rotation remains slow and restrained; available icons float while future stops stay still. Preserve the solid selection rim and readable label rather than adding blinking effects.
- Reduced motion freezes ambience and marker travel while retaining solid selection and focus feedback. Background particles must ignore pointer input.

## Phone and full-route requirements

Four-choice branches are the main legibility test. Simplify decorative architecture at narrow widths before reducing encounter glyphs or touch areas. Every selectable target should remain at least 44 CSS pixels, with distinct hit areas and a visible keyboard focus state.

Retain the existing inspected description and **Choose this stop** action for touch and compact screens. The description must keep Healing's entire-roster effect and Special's 75% reward / 25% setback odds visible. Theme changes must not imply that a future or disconnected stop is available or roll a Special outcome while inspecting it.

Preserve current route scrolling, panning, dragging, Party/Bag controls, pending ability-choice locks, and dialog focus behavior. Scenic props belong behind the graph and outside node targets; paths should have a contrast under-stroke where a busy background could obscure them. Keep available connections more prominent than future paths without hiding the full route's planning information.

## Concept image provenance and packaging

The comparison assets are four original 1536 by 1024 PNG images generated with the built-in ImageGen tool. Their retained paths are:

- `docs/node-selection-concept-assets/verdant-ruins.png`
- `docs/node-selection-concept-assets/crystal-cavern.png`
- `docs/node-selection-concept-assets/lantern-garden.png`
- `docs/node-selection-concept-assets/ember-citadel.png`

The HTML comparison embeds WebP encodings of the originals at full resolution for self-contained preview transport. Conversion compresses the PNG artwork without editing its composition. The PNGs remain the untouched retained originals. Graph nodes, projected 3D icons, selection states, paths, text, and ambient effects are separate code-drawn overlays, rather than gameplay controls baked into the background image. The host's design controls can toggle **Proposed background** to compare each treatment with the exact current stone floor, or disable **Ambient motion**. All selections and confirmation feedback remain local to the concept.

The shared prompt requested premium hand-placed 16-bit pixel art, a uniform crisp grid, a 3:2 landscape composition, and a shallow isometric top-down view with approximately 2:1 diamond surfaces. The central 60% is quiet empty floor for branching nodes; detailed scenery occupies the margins, with subdued upper-left and bottom-left HUD areas. It requested no interface, text, nodes, characters, or logos.

Theme prompt details were mossy limestone with forest canopy, ferns, trickling turquoise water, and sunlight; a teal-indigo cave with edge crystals and glowing pools; a twilight Japanese garden with bamboo, torii, warm stone lanterns, moss paving, and a right-side pond; and an obsidian volcanic courtyard with bronze ruins, edge lava channels, embers, and a fortress at the top. The generated garden includes tiny koi at the pond's right margin. No existing source artwork or game assets were edited.

The assets are concept material under `docs/`; do not import them into runtime code or replace `route-tiles.svg` as part of this design comparison.

## Rollout and review

The approved production rollout installs only the Verdant node/path treatment and floating symbols over the existing floor. Replacing the background or adding scenic ambience remains a separate design decision; that work is not part of the user's approval here. Crystal, garden, and volcanic node treatments are also still proposals.

Production review targets are all seven node kinds, available/inspected/current/completed/future states, four-choice rows, and the complete ten-column climb. Check desktop, 390px and 320px portrait, and short landscape layouts, plus reduced motion, keyboard focus, touch inspection, drag suppression, pending ability choices, modal focus, and exactly-once confirmation. Production verification is recorded in [PROJECT_MASTER.md](PROJECT_MASTER.md). The preview uses illustrative resources and local selection feedback. Its schematic snippet has one current stop, four reachable choices, and three future stops; it is not an actual ten-column fixture, campaign playthrough, or engine validation.

## Preview validation (2026-10-12)

- Visually reviewed all four generated scenes and their native node/path overlays at desktop size, plus compact layouts and the preserved-floor comparison. The embedded, self-contained fragment is under 1 MB; original PNG art remains separate under `docs/`.
- Independent Chrome checks covered all four themes at 1024px, 390px, and 320px viewport widths, including the renderer's narrower 288px scene. Available targets are at least 64px across and do not overlap; the current marker, caption, and inspected stop panel remain clear. The final compact spacing check exercised all 32 theme/selection combinations at 320px and 390px.
- Confirmed local node selection and descriptions, a single pressed state, three disabled future stops, confirmation feedback, restored saved preview state, matching keyboard confirmation/description, visible native focus plus a bright label ring, and no browser errors or horizontal overflow. Reduced motion leaves the ambient canvas unchanged and disables node travel.
- The preserved-floor preview embeds exactly the production SVG bytes and uses the same 112 by 56 repeat. Production source/assets/gallery files and the active background were unchanged during this task. No production build or campaign test was needed for this docs-only comparison.
- The floating-icon refinement passed all 48 theme/width/selection cases at 1024px, 390px, and 320px. Confirmed changing spin frames only for available icons, frozen future symbols, spin/speed/background/selection restoration, local confirmation, reduced-motion pixel stability, and no browser errors. All 64 rotation frames of each available symbol fit inside its canvas with at least three logical pixels above the painted silhouette; equal horizontal/vertical pixel scaling, hit-area separation, and marker/panel clearance also passed. A separate visual review confirmed the plus and shopfront remain readable on phones and visibly float over their shadows.

The illustrative graph, resources, and display-only Party/Bag/Artifact chrome are design context. Confirmation in the comparison only produces preview feedback; it does not simulate an encounter, change a run, or validate the engine. The production game uses the approved Verdant node/path design; optional scenery and the other three themed node treatments remain outside the playable game.
