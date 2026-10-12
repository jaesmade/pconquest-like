# UI overhaul plan

## Implementation progress (stone position marker and compact route controls - 2026-10-12)

The current-position pyramid now uses smaller code-native pixels with an ivory/gold top, bronze sides, a dark warm outline, and a tiny fixed glint. `src/ui/RoutePositionMarker.tsx` retains the route anchor and accessible name without rotating. A gentle four-world-unit stepped hover pauses during dialogs, pending Capsule choices, inactive backdrops, and reduced motion.

The upper-left HUD has a compact wallet row above three equally sized Party, Bag, and Artifacts controls, with smaller icons and readable inline counts. Artifacts keeps its **SOON** label, original Artifact Bag accessible name, and placeholder modal. The guide now groups progress, consequences, confirmation, and labeled Boss/Start pan buttons. It forms a centered bottom strip on wide desktops, a stacked lower-left footer at widths up to 900px, and a 220px right sidebar on screens at least 480px wide and up to 620px high. The sidebar reserves map space; the compact footer reserves its action row so confirmation does not grow it. Hints follow the existing preview/direct-entry input rules. Map alignment observes guide resizing and keeps the occupied plinth clear of a footer.

Main files are `src/ui/RoutePositionMarker.tsx`, `src/ui/RouteScreen.tsx`, `src/styles/route.css`, and `src/styles/route-party.css`. The exact background, graph/positions, clean plinths, encounter icons, paths, gameplay input, and phone preview/confirmation remain intact. See [marker and control authoring](ROUTE_OVERHAUL.md#position-marker-and-route-controls-2026-10-12) and the current checks in [PROJECT_MASTER.md](PROJECT_MASTER.md). Earlier stone/moss captures and phone-description reviews retain their historical styling.

Production build, full gameplay/server-markup smoke checks, and independent browser review passed. The review covered both four-choice rows across seven desktop/portrait/short-window sizes, HUD text/count containment, direct and preview selection, Healing/focus, pan/drag, modal/Capsule locks, and reduced motion. Current [desktop](ROUTE_UI_CLEAN_DESKTOP_PREVIEW.png), [phone](ROUTE_UI_CLEAN_PHONE_PREVIEW.png), and [landscape](ROUTE_UI_CLEAN_LANDSCAPE_PREVIEW.png) captures show the completed presentation; the route guide and master record document check limits.

## Implementation progress (stone route plinths and floating icons - 2026-10-12)

The playable route uses raised limestone plinths, floating thick 3D pixel encounter symbols, and broken stepping-stone links derived from the approved Verdant treatment. A later refinement removed moss trim and green coloring from the node tiles. The exact existing `route-tiles.svg` background and its 112×56 repeat remain in use. No themed scene art or background ambience has been installed.

All seven encounter kinds have distinct symbols. Visible available icons slowly spin and bob; future and completed icons stay still. Teal available rims, gold inspected/current rims, completed checks, and a separate keyboard-focus outline keep route states clear. The current pyramid is retained. Reduced motion freezes icons and the pyramid; icons also pause for hidden pages, offscreen nodes, dialogs, pending ability choices, and inactive route backdrops.

Main files are `src/ui/RouteMossNode.tsx`, `src/ui/RouteStonePath.tsx`, `src/ui/RouteScreen.tsx`, and `src/styles/route.css`. Graph positions, legal choices, save data, encounter rules, drag suppression, desktop/keyboard entry, and touch/compact **Choose this stop** behavior remain as before. See [current route art and authoring](ROUTE_OVERHAUL.md#route-node-art-details), the [approved concept scope](NODE_SELECTION_BIOME_CONCEPTS.md#approved-production-scope-2026-10-12), and the dated production checks in [PROJECT_MASTER.md](PROJECT_MASTER.md).

## Implementation progress (route descriptions on phones - 2026-10-12)

- Route consequences stay visible on phones and short windows. A touch tap or a click in a compact viewport previews the selected stop without advancing the route; the guide retains its description, marks the node, and offers **Choose this stop**. Selecting another stop updates the preview. Confirmation clears it, and immediate Healing progression returns keyboard focus to the next available node. Ordinary desktop clicks and keyboard Enter/Space retain direct selection.
- At that stage, the guide moved to the lower right on short, wide screens and compacts its spacing at 400px height or less, keeping it clear of Party/Bag and Back. Pan controls and mouse drag suppression remain available. Preview validity follows route availability and the pending ability-choice lock.
- Main files: `src/ui/RouteScreen.tsx` and `src/styles/route.css`; behavior and the [phone preview](ROUTE_DESCRIPTION_PHONE_PREVIEW.png) are documented in [route descriptions](ROUTE_OVERHAUL.md#route-descriptions-and-compact-screen-selection-2026-10-12). Checked production build, scoped whitespace, and isolated route layouts at 320×568, 390×844, 568×320, 844×390, 1280×568, and 1280×900. Checked visible odds/healing copy, switching previews without progression, one-step confirmation, stale-preview clearing, keyboard/desktop selection, pan controls, drag suppression, and HUD/Back clearance. Compact pointer behavior was exercised in the browser; hardware touch scrolling was source-reviewed. Campaign saves were not used; the existing Phaser bundle warning remains.

## Living isometric node concepts (2026-10-12; Verdant nodes/paths selected)

The [four-concept comparison](node-selection-biome-concepts.html) presents **Verdant Ruins**, **Crystal Cavern**, **Lantern Garden**, and **Ember Citadel** as alternatives for a livelier pixel route selector. The user selected the Verdant mossy plinths, floating symbols, and stepping-stone paths for production, while explicitly preserving the background. The current production background, `public/assets/backgrounds/route-tiles.svg`, remains in use; all themed scene images are optional concept references for a later decision.

**Verdant Ruins** supplied the initial node/path direction; production now uses clean stone nodes with its stepping-stone paths, while the original moss-edged platforms remain in the comparison. The other proposed directions use crystal sockets and mineral seams, shrine platforms and garden bridges, or basalt platforms and stone causeways. Each concept also proposes two restrained scenic motions; these remain preview-only.

The user's floating-icon refinement is present in the comparison and the production Verdant renderer: thick shaded 3D pixel symbols hover and rotate above the platforms, replacing the upright box tops. Rest uses a mint plus, Shop a warm shopfront, Battle crossed swords, and Recruit a capture orb. Future icons stay still, and the current pyramid remains distinct. The comparison offers adjustable spin speed and motion; reduced motion freezes both preview and production animation. The [refinement notes](NODE_SELECTION_BIOME_CONCEPTS.md#floating-icon-refinement-2026-10-12-preview) record the preview behavior and [production scope](NODE_SELECTION_BIOME_CONCEPTS.md#approved-production-scope-2026-10-12) describes the installed treatment.

The [concept specification](NODE_SELECTION_BIOME_CONCEPTS.md) records the node structures, paths, motion, phone requirements, and image provenance. Its approved Verdant node/path scope is implemented; other node treatments and all scene backgrounds remain proposals. The comparison itself retains local feedback and illustrative resources. Independent desktop/phone, selection, keyboard, preserved-floor, and reduced-motion preview checks passed; the guide records their scope and limitations separately from production verification.

## Pixel node selection concepts (2026-10-12; proposed)

These are proposed pixel layouts, not live gameplay changes. **Trail map** uses a top-down pixel route with a selected-stop preview and a separate **Enter [node name]** action. **Waypoint choices** offers large cards for currently connected stops. The [interactive concept preview](route-node-pixel-ui-preview.html) uses illustrative resources and local feedback.

### Current baseline and proposed interaction

The current phone-description fix keeps consequences visible and uses **Choose this stop** for touch/compact pointer input, while desktop/keyboard enter nodes directly. The proposed Trail map would use consistent inspection before entry across input modes, with readable pixel silhouettes and explicit connection states.

1. Activate a node to select and inspect it. Selection does not call the engine or consume RNG. Show its name, column, connection status, immediate effect, and reward/cost or odds.
2. Retain the preview until another node is selected. Use **Enter Healing**, **Enter Battle**, etc. to call the existing route-entry action exactly once. Enter/Space on a node selects; Enter/Space on the entry button commits.
3. Allow keyboard and touch inspection of future, cleared, and disconnected nodes. Distinguish **Ahead**, **Cleared**, and **Disconnected**, and disable entry for all three. Inspection must not imply that a branch is legal.
4. On phones, keep details accessible without hover. In the concept, selecting a node brings its preview into view and focuses **Back to choices**; that control returns to the selected node. For production, evaluate a compact docked preview with the map occupying the remaining viewport, while retaining this scroll-to-preview fallback for small or short screens. Do not cover the selectable row or hide consequences to fit the panel.

### Strict pixel treatment

- Author upright sword, star shield, cross, shopfront, question mark, Poké Ball-plus, and crown silhouettes on a native 16×16 or 24×24 grid. Display them at integer multiples with nearest-neighbor rendering; avoid fractional foreshortening and smooth icon curves.
- Use square frames, hard offset shadows, opaque navy/paper panels, and a quiet tiled background. Reuse Press Start 2P headings, readable Pixelify Sans body copy, and the existing navy, aqua, raspberry, and gold palette. The preview embeds the project's licensed fonts without remote font requests.
- Use cyan paths for connected choices and gold for selection. Pair color with labels, a selection marker, and dashed disconnected framing. Keep keyboard focus distinct from selection. Native button hit areas remain at least 44×44 CSS pixels, independent of sprite size.
- Keep optional animation brief and discrete, respecting reduced motion. A stationary current-position marker is sufficient.

### Decision information

| Stop | Essential preview information |
| --- | --- |
| Battle | Standard fight; 10 coins on victory and XP for deployed participants. |
| Elite battle | Stronger ranked foes; 20 coins on victory and participant XP. |
| Healing | Full HP and revival for the entire owned roster, including reserves. |
| Store | Purchases spend coins; held items and single-use TMs are available. |
| Special | 75% reward / 25% setback; never reveal or roll the outcome before entry. |
| Recruitment | Choose one of three free recruits; at 20 owned, release a Pokémon first. |
| Boss | Defeat all foes and hold the capture tile; 30 coins on victory and participant XP. |

Trail map preserves planning through visible future connections, with the preview on the right on desktop. Waypoint choices makes legal stops primary cards; a full-route overview would still be needed for planning beyond the next choice. Both should retain accessible Party/Bag controls and ten-column progress. Do not present the unimplemented Artifact Bag feature as a gameplay benefit.

### Complete Trail map preview (2026-10-12; proposed)

The [complete pixel map](route-full-pixel-map-preview.html) expands the selected Trail map concept to all ten columns, with the boss at the top and the start at the bottom. It uses the actual `createRoute(58)` graph: 28 nodes and 49 links, all seven kinds, and four nodes in columns 4 and 7. The displayed legal trail clears Battle → Store → Special; the next connected choices are Battle and Healing in column 4. An independent check confirmed `routeIsValid` and `availableRouteNodes` for this fixture. Resource counts remain illustrative.

Future connections use muted pixel steps, the cleared trail uses stronger teal, available paths use cyan, and the selected choice adds a gold trace/frame. Passed-over nodes use dashed frames; the occupied node is labeled **You**. Keep all node names and icons visible while planning. Desktop details align beside the inspected row; on phones, selecting a node brings its details into view and **Back to selected stop** returns focus to the map. **Current stop** and **Boss** jump controls inspect their destinations without entering them.

This is a complete map overview rather than a fixed-height game viewport. It flows vertically at a readable sprite/control size, including on phones; a production viewport would still need scrolling and a compact preview arrangement. Pixel sprites stay at integer scale and targets remain at least 44px across. Native keyboard activation selects a node; only the separate entry control can commit a legal next stop. Future, disconnected, skipped, and completed stops can be inspected but cannot be entered. Entry in the concept produces local feedback only.

Checked the complete map at 1024, 704, 358, and 288px content widths (1056/736/390/320px browser widths), verifying ten ordered rows, 28 nodes, no horizontal overflow or overlapping targets, loaded fonts, integer canvas scale, keyboard inspection, disabled entry, boss/current navigation, mobile preview/return focus, and light/dark appearance. No production route generation, progression, or saves were changed by this follow-up.

### Scope, constraints, and review

Preserve all ten bottom-to-top progression columns, seven node kinds, the seeded graph, and `availableRouteNodes` legality. Presentation and tentative selection need no save migration; changing generated nodes or links does, because `routeIsValid` compares the saved graph with its seeded reconstruction. Keep tentative selection in UI state. Continue blocking entry during a pending Ability Capsule choice; keep covered map/HUD controls inert during dialogs and preserve focus containment/restoration.

The original two-variant mockup uses illustrative coins/roster counts and a focused column 3–5 excerpt with two connected choices and two disconnected branches. The separate complete-map preview above uses a validated generated graph. Both entry buttons show local feedback only; no gameplay, save, inventory, or event roll changes. Party/Bag dialogs, actual recovery/preparation, and route advancement remain outside these concepts.

Reviewed the route docs and current `RouteScreen.tsx`, `route.css`, `route-party.css`, `pixel-system.css`, and `route.ts`, including the concurrent compact-screen fix, with an independent UX review. Browser review covers both concepts at desktop and narrow widths, native keyboard selection, preview updates, local entry feedback, disabled future/disconnected entry, mobile preview/return navigation, local fonts, and light/dark appearance. Production acceptance must additionally cover a ten-column climb, four-node columns, dragging across nodes, pending Capsule saving/failure, modal focus, and exactly-once engine entry. Those production behaviors are not implemented by this proposal.

## UI/UX improvement audit (2026-10-12; proposed)

Reviewed the current UI after the pixel-interface and targeting fixes. The audit includes proposed follow-ups; completed items are marked resolved below. Priority reflects ability to complete a task and make an informed decision; effort is a rough implementation estimate, not a schedule.

| Order | Improvement | Priority | Effort |
| --- | --- | --- | --- |
| 1 | Keep route consequences readable on phones (resolved) | High | Small |
| 2 | Explain the boss capture objective before deployment | High | Small |
| 3 | Complete battlefield keyboard navigation | High | Large |
| 4 | Show campaign damage and hit forecasts | Medium | Medium |
| 5 | Allow touch target inspection before committing | Medium | Medium |
| 6 | Make move and ability explanations tappable | Medium | Small–medium |
| 7 | Compare ally loadouts and recruits before choosing | Medium | Medium |
| 8 | Make turn portraits inspectable and clearly identified | Medium | Small–medium |
| 9 | Reduce deployment keyboard navigation to one grid stop | Medium | Medium |

### 1. Preserve route decision information (resolved 2026-10-12)

The audit found that phone/short-window rules hid the consequence description, and a tap immediately chose the stop. Those hide rules have been removed. Touch and compact-screen pointer selection now retain a noncommitting preview with visible odds/healing/recruitment copy and a **Choose this stop** action. The landscape guide also stays clear of the HUD and Back. See the implementation progress above for completed checks.

Main files: [route styles](../src/styles/route.css) and [route screen](../src/ui/RouteScreen.tsx). The descriptions remain at lines 39–46; node activation now separates pointer preview from confirmation. The checked phone/landscape cases can be read before committing, and dragging preserves route progress.

### 2. Teach the boss victory condition before battle

The route Boss description only says to defeat the final boss, and preparation explains placement without showing the capture objective or marking the tile. Add the complete objective to the route description and a short preparation objective with a labeled capture marker: defeat all foes **and** move a living ally onto the capture tile. The battle HUD already states the combined objective; retain it. This audit item remains proposed work.

Evidence: [route screen](../src/ui/RouteScreen.tsx), line 46; [preparation](../src/ui/PrepareScreen.tsx), lines 56–77; [deployment board](../src/ui/DeploymentBoard.tsx); [encounters](../src/content/encounters.ts), line 7; [victory check](../src/game/engine.ts), lines 249–257. Check the boss preparation screen and the transition after the final enemy faints while capture remains unoccupied.

### 3. Let keyboard users finish Move and Attack

Battle commands and cancellation support keyboard focus, but the Phaser board registers pointer/drag/wheel interactions without a focusable keyboard tile cursor. A keyboard user can choose a move but cannot select its target. Add one focusable board entry, arrow-key tile navigation, Enter/Space activation, Escape cancellation, and an announced tile/occupant/validity summary. Keep the cursor visible as the camera pans.

Evidence: [battle board](../src/battle/Board.tsx), input handlers at lines 117–150 and wrapper at line 779. Validate a complete keyboard-only battle, including an out-of-range target, camera edges, animation lock, and unchanged AP after cancellation.

### 4. Bring numerical forecasts into campaign targeting

The bottom HUD's damage forecast is gated by `controlBoth`, so only Battle Lab receives it. Campaign targeting shows range and effectiveness but no expected HP damage or hit chance. The unused [MovePreview component](../src/ui/MovePreview.tsx) contains relevant preview calculations. Adapt the existing engine helpers into a compact forecast for the aimed enemy/area, including absorption and affected units; keep it inside the measured bottom HUD so it does not cover targets.

Evidence: [battle screen](../src/ui/BattleScreen.tsx), line 357; `MovePreview.tsx`, lines 18–32; a source search found no uses of that component. Validate single-target, area, immune/absorbing, and status moves with the real target. A forecast must not consume AP or RNG.

### 5. Separate touch preview from commitment

Pointer hover updates path and affected-area previews, while a valid tile tap immediately executes movement or an attack. Touch players lack a dependable inspection step before spending AP. Trial a tap-to-preview flow with a compact **Move here / Use move** control, or an explicit preview mode. Keep dragging distinct from tapping and preserve quick desktop interaction. This is an interaction proposal; user testing should decide whether the added step earns its cost.

Evidence: [battle board](../src/battle/Board.tsx), lines 123–146; [app actions](../src/app/App.tsx), lines 186–194. Check touch path/area review, changing the tentative target, cancellation, and exactly one committed command after confirmation.

### 6. Keep move and ability explanations reachable

Move details exist in a hover/focus tooltip that disappears when a move is selected. The targeting prompt retains the name and AP cost. Draft, Party, and inspected-unit ability descriptions use `title` attributes on text elements, which do not provide a reliable touch or keyboard disclosure. Add a tappable/focusable **Info** control or a short expandable description, including selected-move range, effects, and weather changes. Reuse one disclosure pattern across these screens.

Evidence: [battle screen](../src/ui/BattleScreen.tsx), lines 327–334, 355, 391–398; [draft](../src/ui/PartyBuilder.tsx), line 91; [Party](../src/ui/RouteScreen.tsx), line 786. Check access without hovering and ensure closing Info restores focus without committing an action or hiding Back.

### 7. Support squad comparison at the decision point

Preparation lists enemy moves, but ally rows omit equipped moves, abilities, items, and tactical stats. Reserve focus buttons become disabled when six units are deployed. Recruitment cards show name/type and immediately recruit when there is room. Add a read-only ally inspector that remains available for reserves and a recruit preview with the actual incoming level, moves, abilities, and movement. Keep inspection separate from Add/Remove/Recruit. Loadout editing can remain on the route, as intended by the existing flow.

Evidence: [preparation](../src/ui/PrepareScreen.tsx), lines 65–75; [recruitment](../src/ui/RouteStopScreen.tsx), line 63. Check a full six-unit deployment and three recruit choices without requiring a return to Route → Party. The preview must match the unit actually recruited.

### 8. Make turn-order portraits useful controls

Turn entries are nonfocusable `div`s; extra Speed/banked-AP information is only in `title`. Phone rules hide names and rank badges. Make portraits open read-only unit inspection, provide an explicit accessible name with side/rank/time to act, and retain a compact visible team/rank cue. This lets players compare upcoming threats directly from the queue.

Evidence: [battle screen](../src/ui/BattleScreen.tsx), lines 347–350; [battle styles](../src/styles/battle.css), line 18; [battle menu styles](../src/styles/battle-menu.css), line 218. Check repeated species, ranked enemies, duplicate scheduled turns, phone widths, and focus restoration.

### 9. Simplify deployment grid navigation

Each legal deployment tile is a separate Tab stop and handles only Enter/Space. Use a roving grid focus with arrows between tiles, Enter/Space to place, and Tab to exit. Preserve the existing coordinate/occupant labels and focus styling. This is a navigation-efficiency improvement rather than a missing placement capability.

Evidence: [deployment board](../src/ui/DeploymentBoard.tsx), line 77. Check selecting a unit, moving to a legal tile, swapping two allies, and leaving the grid without traversing every tile.

### Scope and checks

Read the documentation inventory, UI/start-screen plans, game description, Battle Lab, route, and party guidance before checking implementation. Reviewed title/settings, draft, route/Party, recruitment, preparation/deployment, battle targeting/inspection/turn order, growth, and result code. Confirmed the route-description breakpoint in the isolated Vite preview through DOM/accessibility observations at 390×844 and 1280×900; reviewed phone screenshots. Other findings are source-confirmed gaps or explicitly marked interaction proposals, not measured player outcomes.

The existing targeting insets, mobile color legend, modal focus containment, save warnings, and reduced-motion support are already implemented and should be preserved. Broader Options controls and UI scale remain previously planned in this document; they were not newly validated here. The original audit changed documentation only and did not exercise a full campaign, live boss battle, or 32×32 keyboard playthrough. Later implementation and its checks are recorded separately above.

## Implementation progress (unobstructed target selection - 2026-10-12)

- Choosing an attack move or Move now removes the unit-anchored action popup for the targeting step. The active Pokémon's bottom HUD replaces its readiness line with the selected move, AP cost, and target prompt, and replaces the action toggle with Back. Invalid-target feedback appears there too, so the targeting card no longer hides nearby enemies or tiles. Move descriptions still appear while hovering or focusing the move list before selection; range and matchup overlays remain on the board.
- Back and Escape return to move selection or the main actions without spending AP. Keyboard focus moves to the bottom Back button when targeting begins and returns to the appropriate action menu after cancellation.
- Main files: `src/ui/BattleScreen.tsx` and `src/styles/battle-menu.css`. Checked the production build and Battle Lab at desktop and 390×844 phone sizes with an adjacent opponent, including movement targeting, attack and self-targeting status selection, Back/Escape, invalid-target feedback, and a successful tile-click attack. Scoped whitespace checks passed.

### Follow-up targeting gap review (2026-10-12; resolved)

The follow-up audit reproduced three P2 gaps in Battle Lab at 390×844. All three have now been corrected in `src/ui/BattleScreen.tsx` and `src/styles/battle-menu.css`:

- **Other HUD panels covered valid targets.** With level-1 Geodude acting against level-1 Squirtle, the Damage lab panel covered Rock Throw's target and received taps at its screen position. Attack and movement targeting now temporarily hide Damage lab, the campaign action log, the minimap, and expanded weather details. Weather name/count remain visible; weather inspection resumes after targeting. Camera buttons remain available, and the lab's selected-move damage/critical forecast moves into the bottom HUD.
- **Target notices overlapped the actor HUD with diagnostics.** The map canvas now reserves measured space below the top HUD and above the actor/camera controls. A layout effect plus ResizeObserver updates those insets when errors, status content, or viewport changes alter HUD height. The actor HUD can scroll on short screens while Back stays visible. Error messages no longer grow over map tiles or collide with diagnostics during targeting.
- **Narrow screens lost the color legend.** The bottom HUD now always shows labeled blue/range, green/strong, orange/resisted, and gray/immune swatches for attack targeting, including widths where `.battle-help` is hidden.

Checked the production build and rendered Battle Lab at 1280×720, 390×844, 320×568, 768×1024, and 844×390. The previously hidden target accepted a Rock Throw attack, a movement click committed through the resized canvas, and invalid-target feedback kept Back clear. Back/Escape preserved AP and restored move selection/diagnostics; the legend and camera controls remained available across the reviewed sizes. Expanded Sandstorm details collapse during targeting and restore afterward. Scoped whitespace checks passed. Camera pan/zoom is still needed for units outside the current viewport; a full campaign or 32×32 battle was not visually exercised in this follow-up. The existing Phaser bundle-size warning remains.

## Implementation progress (carved route-node emblems - 2026-10-06)

Historical treatment, superseded by the mossy plinths and floating symbols above.

- The seven route symbols remain a sword, star shield, medical cross, shopfront, question mark, Poké Ball with plus, and boss crown. They now blend with the diamond faces as dark, category-tinted carvings with a subtle lit lower edge, replacing the cream fill and heavy outline. Upright silhouettes use gentle foreshortening to sit within the tile surface. Cutouts match each tile's actual surface color, including visited, hover, and focus states.
- Decorative icon groups ignore pointer input and leave node names, available/locked state, and keyboard activation with the existing node controls. Reviewed the full set at desktop and 390px phone widths, including visited and gold keyboard-focus states; selecting Healing with Enter advanced the isolated route fixture.
- The original symbol pass passed production build and campaign/Battle Lab smoke checks. The carved treatment passed production build and desktop/390px visual review of all seven symbols, visited marks, and keyboard-focus contrast; the [saved preview](ROUTE_NODE_PREVIEW.jpg) records that previous treatment. Current art geometry is documented in [route-node art details](ROUTE_OVERHAUL.md#route-node-art-details).

## Implementation progress (full-run pixel interface - 2026-10-06)

- The splash, title and supporting panels, draft, route, Party/Bag, stores, events/recruitment, preparation, battle controls, XP/move choices, loading, pause and run results now share square frames, hard shadows, block controls and discrete feedback. Local Press Start 2P headings and Pixelify Sans body lettering replace the remote font request; licenses ship in `public/assets/fonts/`. `src/styles/pixel-system.css` loads last and supplies tokens, native control styling, pixel select arrows, focus rings, scrollbars and reduced-motion rules.
- Original species-specific 16×16 portraits distinguish all current species in menus, preparation, battle HUD and rewards/results. These SVG portraits live in `src/ui/SpeciesPortrait.tsx`; battlefield animation sets remain independently replaceable. `PixelIcon` provides command/navigation sprites, and the named 32px item/status assets contain pixel symbols instead of letter tiles. Regenerate the latter with `python scripts/generate_placeholder_ui.py`; `--force` deliberately replaces existing named art.
- Draft controls announce point feedback and offer filter resets. Party/Bag and nested item dialogs contain focus and disable covered controls. Stores show purchase feedback, grouped quantities and coin shortfalls; full-roster recruitment explains its two steps. Deployment actions are touch-sized. Battle controls show AP/readiness/disabled reasons and keep targeting instructions beside Back in the bottom actor HUD; turn portraits remain visible on phones. Canvas labels use the pixel body font, and resizing preserves the camera's world center.
- New Run uses a pixel confirmation with Escape/Tab handling and focus restoration for unfinished saves. Pause contains focus and makes the battlefield inert. Results show win/loss, cleared route count, coins, final roster and replay/title actions; focus starts at the outcome. Phone XP screens scroll the outer frame and preserve visible cards when move choices are pending.
- `scripts/ui-preview.html` and `scripts/ui-preview.tsx` provide isolated, stateful development fixtures from splash through win/loss, including full rosters and pending moves. They do not import persistence or production App and are not a production entry. With Vite running, open `/scripts/ui-preview.html?screen=route`; the review menu exposes other scenarios.
- Saved a [phone run-result preview](PIXEL_UI_PREVIEW.jpg) from the isolated victory fixture.
- Checked production build, the existing campaign/Battle Lab smoke playthrough and whitespace. Browser checks covered desktop/phone title/support screens, route/Party, store purchases, preparation, growth/move choices, results and Battle Lab commands. The existing Phaser bundle-size warning remains. Late-run screens were reviewed through fixtures; this pass did not manually play a complete ten-column campaign or retune gameplay.

## Implementation progress (conditional battle field indicators - 2026-10-01)

- Clear weather and inactive Trick Room no longer occupy space in the battle HUD. Each active condition appears in parentheses with its remaining cycle count; the weather details control is available only while weather is active and closes when that weather expires.
- Weather and Trick Room indicators share the same font size, line height, and chip padding at desktop and narrow breakpoints.
- Checked the production preview with no active conditions, Sandstorm active, and Sun plus Trick Room active. The preview showed only the applicable indicators and their remaining cycle counts. `npm run build` and scoped `git diff --check` passed.

## Implementation progress (battle UI matched to route selection - 2026-09-30)

- Battle HUD panels, field readouts, camera controls, and the contextual action buttons now share route selection's navy surfaces, cool pale frames, inset highlights, and raised shadows. Pixel headings, gold turn and focus cues, and cyan weather accents carry the route screen's visual hierarchy into battle; map art and team/weather semantics remain clear.
- On narrow screens the four main battle commands use a 2×2 touch tray. The action menu moves clear of the weather details card and lower HUD panels, and the active Pokémon card leaves room for the camera controls.
- Checked the production preview at 1142×910 and 390×844. The narrow preview showed the Rain cycle count and effects card, turn levels, compact action tray, and separated actor/camera panels. `npm run build` and `git diff --check` passed.

## Implementation progress (battle field and unit readouts - 2026-09-30)

- The battle HUD shows active weather and remaining cycles, and its weather control opens the current weather effects plus the next Sandstorm tick. Hovering or focusing a weather move previews its field change and resulting modifiers; Trick Room previews explain activation or recasting, while the HUD keeps its remaining cycles visible.
- Turn portraits show each Pokémon's level. The active and inspected unit readouts show level, HP, AP, action readiness, and status. Timed stat stages use compact stat abbreviations with Roman-numeral ranks; green marks boosts and red marks drops. Their accessible labels retain the signed stage count and remaining cycles without displaying a damage multiplier. Tile inspection includes grid coordinates, terrain, elevation, and an active hazard marker.
- The production browser preview was visually checked at 1142×910 for the weather details card, Sunny Day forecast, Trick Room countdown, level labels, and timed stage readout. A 390×844 review also confirmed the weather cycle count, effects card, level labels, and responsive action tray.

## Implementation progress (battle XP participants - 2026-09-30)

- Battle wins award XP only to the deployed Pokémon recorded for that battle; deployed battlers still receive XP if they faint. The growth screen shows each Pokémon's individual award and marks reserves at +0 XP. The party-wide XP summary has been removed.

## Implementation progress (starting party draft)

- The new-run draft uses a clearer header, a six-segment point meter, compact selected-party cards, larger species choices, a type filter, and a persistent stat inspector. Species retain the shared placeholder portrait, with type-color accents to help distinguish them until individual portraits are available. Unaffordable choices remain inspectable but cannot be added.
- The draft styles now live in `src/styles/party-builder.css`. The selection rules, point costs, and stat calculations are unchanged; see [party builder](PARTY_BUILDER.md) for behavior and replacement details.

## Shared visual style (implemented)

The screens share navy ink, raspberry/coral accents, gold primary actions, aqua backgrounds and paper panels. `src/styles/theme.css` provides the palette; `src/styles/pixel-system.css` supplies the final pixel primitives and local fonts. Press Start 2P handles display headings and short controls; Pixelify Sans provides readable pixel body copy. Frames use square corners and hard shadows, with gold focus cues and pale edges against dark battle surfaces.

The top-down battle map keeps its environmental colors, while route stops use the same tiled floor as route selection. Battle HUD panels and action controls use the route HUD's dark navy surfaces, cool pale frames, inset highlights, and raised edge shadows. Gold marks focus and the current turn; cyan highlights field information. Health, teams, terrain, weather, and targeting colors continue to communicate gameplay state and should not be recolored solely to match menu decoration. Shared styling loads after the screen styles so new screens can use the tokens without copying older green panel rules. Review at desktop and narrow widths; keep critical controls inside safe-area insets and give keyboard focus a visible gold outline.

## Implementation progress (palette and XP reward pass)

- Shared colors now flow through the title options, route HUD and party panel, shop/special stops, preparation, battle HUD, and result screen. Navy glass frames and pale paper panels contain the content; raspberry outlines and gold primary actions give controls a consistent hierarchy. Healing and other gameplay signals keep their semantic colors. The shop/special and result screens use the same repeating route tile floor instead of the separate cavern backdrop.
- The XP screen leads with a per-Pokémon XP and coin summary. Each scrollable card shows the portrait, final level, awarded XP, level progress, HP, and deployed/reserve state; a level-up badge appears when the new level can be established from the XP award. Level and move milestones sit below the cards. Cards and bars animate briefly unless reduced motion is enabled. The existing battle reward and progression rules are unchanged.
- The local production build was checked. Screen appearance and interactions still need an in-browser review at desktop and narrow widths; the prior browser approval was unavailable because of the account usage limit.

## Implementation progress (route-linked preparation and growth)

- Deployment and post-battle XP now use the route selector as a noninteractive backdrop. A dark translucent outer frame and pale translucent panels follow the supplied position and XP references. Preparation keeps the live top-down placement board beside the party roster, with a Back control that returns to the route choice before battle. On small screens the roster sits in a scrollable strip above the map.
- The placement UI now gives each Pokémon a readable roster row with HP, type, deployment status, and an explicit Add/Remove action. A six-slot meter, active-unit status, map zone labels, and stronger current-tile feedback clarify the select-then-place flow. The mobile frame constrains its scrollable roster to the viewport. These are presentation changes; tile and team legality still come from the existing deployment rules.
- The growth screen replaces the text-only report with scrollable Pokémon cards showing portrait, level, awarded XP, level progress, and HP. Coins, level-ups, and learned-move messages remain visible below the cards. The action control continues the run. Route generation, placement legality, and XP awards are unchanged.

## Implementation progress (glass battle action menu)

- The active Pokémon's contextual popup now follows the supplied action-state sketch. Its main state has four compact buttons: **Attack**, **Move**, **Special**, and **End**. The actor HUD retains HP, AP, and status information so those values do not crowd the command list.
- **Attack** opens four equipped moves in the supplied cross layout: one above, one left, one right, and one below a central Back button. Hovering or focusing a move opens a separate compact description tooltip with power, range, type, category, and AP cost. The tooltip does not resize or move the action buttons. Choosing a move removes the popup and puts Back, the move name, AP cost, and target prompt in the bottom actor HUD; the board shows range, area, and effectiveness, and clicking a valid tile commits the attack. Back returns to move choice without spending AP.
- **Move** removes the popup and puts Back in the bottom actor HUD. Reachable tiles remain highlighted, and the HUD prompt reports the fixed 1 AP cost and AP left; clicking a tile commits movement. Move becomes unavailable after one command in the turn. **Special** opens Back and Use Item; its tooltip shows the held item's AP cost. **End** asks Yes or No before passing and banking AP.
- `src/styles/battle-menu.css` loads after the shared theme. Individual controls use the route-matched raised navy frames; the menu wrapper has no fill or outline. The popup follows the acting unit, avoids HUD and weather-detail panels, and uses a compact two-column command tray on narrow screens. Keyboard focus is visible; Escape walks back through menu states. Battle rules and seeded outcomes are unchanged.

## Implementation progress (first slice)

- The title flow now begins with a splash, then shows Continue when available, New Run, Lab, Options (sound), and Exit information. The battle has a pause overlay with Resume and Title. New Run asks before replacing an active save.
- Battle uses a viewport stage, a six-entry portrait AV queue with time-to-act labels, a unit-anchored action menu, a compact actor HUD, status/stat icons, and a collapsible log. The action menu stays by the unit on narrow viewports. Existing unit sheets supply temporary portraits and model animations.
- Ability and held-item triggers emit bounded cosmetic events. The renderer displays short in-world callouts and plays named ability or item sounds. These cues are omitted from saves and do not consume battle RNG. Passive Leftovers and Sitrus Berry recovery now have activation cues.
- Named SVG item and status placeholders live under `public/assets/ui/icons/`; the animation and audio guides describe replacement.
- Still planned: camera pan/zoom and world-to-tile conversion for 32×32 maps, minimap, terrain asset pass, broader Options controls, and measured 60 FPS profiling. The current Phaser canvas still fits the whole map.

## Implementation progress (asset and battle layout pass)

- The battle canvas now fills the stage. Phaser renders a camera window over the 64-pixel world grid; 8×8 maps fit the view, while larger maps open near playable scale. Wheel or the HUD controls zoom, drag with Shift/right/middle pans, Fit Map shows the full map, and Center Active returns to the acting Pokémon. Tile clicks use camera world coordinates.
- A compact clickable minimap shows terrain, living units, and the camera rectangle. The contextual action panel projects its anchor through the same view and updates after camera changes or canvas resize.
- Selected 16×16 terrain and overlay cells from Kenney's CC0 Roguelike/RPG pack are imported under named paths and drawn once into a static Phaser render texture. Selected 32×32 frames from the CC0 UI Pack – Pixel Adventure still style the turn portraits; the action panel now uses CSS glass styling. The [asset manifest](../public/assets/battle-asset-manifest.json) records pack version, source file/cell, size, pivot, license, and replacement path; see the [preview](BATTLE_ASSET_PREVIEW.png).
- The remaining work in this plan includes a responsive settings pass, keyboard/gamepad camera navigation, visual review across screen sizes, and measured 32×32/8v8 performance before claiming the 60 FPS target.

## Implementation progress (contextual action pass)

- The active ally's action menu measures its own size, projects the actor through the camera, stays centered above the unit when possible, and clamps against the top HUD and stage edges. It has no connector or outer panel.
- Main commands expose the reason when Attack, Move, or Special is unavailable through their disabled-button titles. Attack, Move, and Special have a Back control; Escape steps back through attack targeting, move choice, or Special, then closes the panel and opens Pause. Closing the panel returns focus to its Actions button. Pause accepts Escape to resume.
- Hovering over a movement tile previews the authoritative route on the map and the fixed 1 AP cost in the bottom hint. Clicking a reachable tile commits the Move command once for the turn; Back consumes no AP. Reachability is calculated once per movement state and shared with highlights.
- Attack selection retains range and type effectiveness overlays. Hovering or focusing a move shows its description before selection. After choosing a move, clicking a valid tile attacks immediately. Inspecting another Pokémon or terrain tile shows a compact readout without changing the active actor. The panel reopens after a committed animation when the ally can still act.

## Implementation progress (start screen overhaul)

- Startup now opens on a full-screen **Pokémon Tactics** splash. Any key or pointer press enters the main menu. The menu follows the supplied visual references: pale aqua checker-grid backdrop, dark navy and coral pixel title, and vertically stacked gray buttons with raspberry borders.
- The menu keeps **Continue** when an active run can resume, then **New Run**, **Lab**, **Options**, and **Exit**. Existing run replacement confirmation, Lab setup, sound toggle, and saved-progress exit message remain functional.
- The title wordmark and menu labels use the pixel font family. Menu controls support mouse, touch, Tab, Enter/Space, visible focus, and Up/Down/Home/End navigation. The splash prompt respects reduced-motion preferences.
- Layout is built with responsive CSS and safe-area padding; the checkerboard, color wash, and scanline texture are CSS layers rather than baked screenshot artwork. Details and review criteria are in [START_SCREEN_OVERHAUL.md](START_SCREEN_OVERHAUL.md).

## Implementation progress (party selection)

- New runs use the two-panel point-budget builder documented in [PARTY_BUILDER.md](PARTY_BUILDER.md): removable roster cards at left; a searchable, paged species catalog, point balance, and Start Run control at right.
- Hovering or keyboard-focusing a catalog card updates a stats inspector with the candidate's level-10 HP, Attack, Defense, Special Attack, Special Defense, Speed, Movement, type, and ability.
- The starting draft has six points. Species cost two by default and content can override a cost; current eligible choices use the default. The run owns up to 20 Pokémon and deploys up to six per solo encounter.
- The layout uses responsive CSS, a scrollable roster/catalog, keyboard-operable controls, and a single-column narrow-screen mode. The current v17 save schema migrates earlier roster and route saves and fills four move slots.

## Implementation progress (route and preparation)

This section records the initial route/preparation implementation. Current node artwork, position marker, controls, and event rules are documented in [ROUTE_OVERHAUL.md](ROUTE_OVERHAUL.md).

- The route is a saved ten-column graph with a guaranteed boss in column ten. Middle columns contain two to four nodes, with four-node branches guaranteed in columns 4 and 7. React renders the full-screen repeating pale isometric tile board with raised and engraved node tiles, blue paths, glowing amber-marked choices, an original explorer marker, compact coin/Party/Bag controls on the left, an upper-right title return control, and translucent responsive overlays. Progression columns appear as rows climbing from the bottom start to the top boss, with choices spread across the board. Mouse dragging or touch and wheel scrolling reveals the boss above; the guide pans up toward the boss and down toward the start. Only the next connected nodes accept input. See [ROUTE_OVERHAUL.md](ROUTE_OVERHAUL.md).
- Battle and elite nodes open preparation, healing fully restores and revives, stores sell held items for coins, and the initial special encounter offers one of two free recruits or a coin cache.
- The route party overlay displays four active moves as read-only chips and expands each Pokémon for its compatible held-item selector and eligible evolution. The post-battle growth screen offers each new level move for replacement or skip before the route continues. The route Bag has a distinct TM section with compatible recipient and replacement-slot controls.
- Preparation now places up to six selected Pokémon directly on the authored top-down map. Its scrollable roster and map are for deployment and positioning only. Tile legality and saved positions use the same deployment rules as battle.

## Goal and current baseline

Make the battle feel like the main game screen: the map fills the browser viewport, the active Pokémon's commands appear near it, and the next turns are readable as portraits over the battlefield. Add a title screen with **Start Game**, **Options**, and **Exit** before the existing run flow.

The app uses React for menus and HUD, Phaser 3.90 for the board, and a 64-pixel world tile. The first pass replaced the old 512-pixel board and sidebar; the current battle stage and camera are described above. Existing 32-pixel unit, attack, and effect sheets are listed in `public/assets/animations/animation-manifest.json`. Keep the TypeScript battle state authoritative: UI, camera, and animations only present committed outcomes.

## Screen flow

```text
Boot/load save → Splash → any key/click → Title menu
                 ├─ Continue → current starter, route, preparation, battle flow
                 ├─ New Run → current starter, route, preparation, battle flow
                 ├─ Options → settings panel → Title
                 ├─ Lab → Lab setup → test battle
                 └─ Exit → saved-progress exit panel → Title or close tab

Battle → Pause overlay → Resume / Options / Exit to Title
Battle result → current XP and evolution flow → Title when run ends
```

- Always show the splash, then the title menu, after loading. The menu opens starter selection through **New Run** when there is no active run; otherwise it offers **Continue** and **New Run**. Show the existing run's encounter and party summary beside Continue. Confirm New Run only when it would replace an active save.
- **Options** initially includes master/music/effects volume, reduced motion, UI scale, battle zoom, and fullscreen. Persist preferences separately from run and battle state. Do not let opening Options advance the turn or trigger a save migration.
- Browsers generally cannot close a tab they did not open. **Exit** on the title shows a quiet exit panel confirming saved progress and saying the tab can be closed; if launched in a context that permits `window.close()`, it may close after the user's click. In battle, **Exit to Title** saves at the safe boundary and returns to the title.
- Use a screen/overlay state model (`title`, `game`, `options`, `pause`, `exit`) instead of mixing menu booleans into `Run.phase`. The gameplay phase continues to own route, preparation, battle, intermission, and result.

## Battle layout

```text
┌──────────────────────────────── browser viewport ────────────────────────────────┐
│ Encounter / map / weather       [portrait turn strip]       Pause / settings    │
│                                                                                  │
│                         CAMERA / GRID BATTLEFIELD                                │
│                                                                                  │
│               [active Pokémon]  [Attack] [Move] [Special]                        │
│                                 [End turn]                                       │
│                                                                                  │
│ Compact objective / log (expandable)       AP / HP / status       zoom / minimap  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Replace the page-width two-column battle layout with a `100dvh` battle stage. The Phaser canvas fills the available stage; small translucent HUD islands sit over it. Respect safe-area insets and reserve space for the top turn strip and bottom status controls. Remove the global site header and footer while battling.
- Keep map tiles square and pixel sharp. At 8×8, center the entire map and enlarge it as much as the usable viewport allows. At up to 32×32, show a camera window with pan, zoom, bounds, and a compact minimap; never shrink all 1,024 cells until units and targets are too small to select. Provide Fit Map and Center Active controls.
- Resize the Phaser camera and canvas with the stage via `ResizeObserver`; retain the world tile size, sprites, highlight geometry, and game coordinates. Convert pointer hits through the Phaser camera's world point before calculating a grid cell. The current `pointer.x / TILE` rule is insufficient once the camera pans or zooms.
- Render terrain as a small coherent tile family: plain ground, water, lava, wall, height edge, and cover. Add restrained decals and zone boundary cues without hiding movement range, target highlights, HP, or flight/swim markers. Elevation must remain readable at all zoom levels.
- Keep expensive static terrain in a cached layer and update only changed overlays and units. Profile a 32×32, 8v8 scene on a declared browser/device before claiming the 60 FPS target. Avoid React updates on every pointer move; Phaser can draw transient hover highlights.

## Contextual action popup

- Open above or near the active allied Pokémon when its turn begins and attack/move animations finish. Clicking that Pokémon reopens it; clicking another Pokémon or tile while in Inspect shows information without changing the active actor. During enemy turns show a small `Opponent acting` indicator, not actionable commands.
- Main popup: **Attack**, **Move**, **Special**, **End Turn**, current HP/AP, and whether Attack has been used. Disabled commands state why: insufficient AP, attack already used, item blocked, or no usable special.
- Attack opens a move list in the same popup or an attached pane. Each move shows type, category, AP, range, and tags. Selecting a move highlights range and target effectiveness. Hover previews damage and effect area; clicking a valid tile commits the attack. The target preview and optional button remain visible without covering the chosen target. Cancel returns to the action popup and consumes no AP.
- Move shows reachable tiles and a path preview with the fixed 1 AP cost. Clicking a valid tile commits the turn's only Move command. After a committed move, follow the sprite and reopen the popup at its new screen position if it still has AP. Attack remains limited to once per turn; Special follows its listed AP cost.
- Anchor by projecting the active unit's world tile into stage coordinates on state, camera, or viewport changes. Center the menu above the unit and clamp it against the top HUD and viewport edges when space is limited. Keep this behavior on narrow screens. Keep move descriptions in a separate overlay so hover does not change the menu's dimensions or anchor.
- Only one overlay owns input at a time. Escape/Back closes a submenu or pause panel in order; focus returns to the prior control. Keep keyboard and mouse use equivalent, provide visible focus, accessible names, and touch targets of at least 44 CSS pixels. Reduced motion removes popup travel and decorative effects while preserving actionable feedback.

## Turn order and battle information

- Replace the text queue with a horizontal portrait strip **inside the battle stage**. Show the current actor and the next five entries from the authoritative `upcoming(battle)` result. Portrait frame color and labels distinguish ally and enemy; highlight the current actor and show its AP gain. A repeated Pokémon appears only if the turn scheduler actually returns another entry.
- Reuse the current unit sheet's idle frame as a temporary portrait; later swap in named portrait images without changing turn-order data. Use species/form ID and a fallback portrait, so evolutions and future 8v8 rosters do not require hardcoded UI conditions.
- Put map name, weather and remaining duration, cycle/AV, capture objective, selected unit HP/AP/status, and a compact expandable action log in fixed HUD positions. Critical combat messages may appear as short in-world callouts, but the log remains available to inspect missed events.
- During visual playback, disable game commands and keep the queue/HUD synchronized with committed battle state. Retained visual cues play in order through the bounded renderer queue; coalescing must not roll RNG or change outcomes.

## Public asset plan and replacement rules

Use one style family for the first environment pass. [Kenney Roguelike/RPG Pack](https://kenney.nl/assets/roguelike-rpg-pack) provides 16×16 CC0 pixel tiles; map a chosen subset to the current terrain kinds and normalize it to the game's grid. [Kenney UI Pack – Pixel Adventure](https://kenney.nl/assets/ui-pack-pixel-adventure) is a CC0 starting point for panels/buttons. These are source candidates, not files already added to this repository. Review each selected tile at battle scale before importing. Keep text and interaction states in HTML/CSS, not baked into images.

The existing original placeholder unit and named move sheets remain the initial character/VFX assets. If a public CC0 effect fits a move, adapt it into the existing four-frame 32×32 attack-sheet contract; otherwise retain the named placeholder until original art is made. Do not silently substitute a generic asset that changes a move's visual meaning. Pokémon-specific artwork from the internet is not presumed redistributable merely because it is public to view.

| Family | Proposed repository path | Stable lookup |
| --- | --- | --- |
| Ground and obstacles | `public/assets/environment/tiles/terrain-<kind>-16px.png` | terrain kind plus visual variant |
| Height, cover, zone marks | `public/assets/environment/overlays/overlay-<id>-16px.png` | overlay ID |
| Battle backdrop | `public/assets/environment/backgrounds/background-<biome>.png` | biome ID |
| Unit portraits | `public/assets/ui/portraits/portrait-<species-or-form-id>-48px.png` | species/form ID; named fallback |
| HUD panels and icons | `public/assets/ui/hud/hud-<role>.png` | role ID; CSS controls remain semantic |
| Existing move effects | `public/assets/animations/attacks/attack-<move-id>-32px.png` | move ID in animation manifest |

- Add an asset manifest with URL, source page, author, license, source filename, edited filename, pixel size, tile/frame layout, pivot, and replacement status for every imported file. Record the exact downloaded pack/version and attribution requirements even for CC0 content.
- Import at native pixel dimensions with nearest-neighbor filtering, no smoothing, transparent PNG where needed, and explicit render order: backdrop → terrain → decals/zone/elevation → units/shadows/ripples → move effects → selection/target overlays → DOM HUD.
- Extend `docs/ANIMATION_ASSETS.md` with terrain atlas mapping, portrait crop/anchor rules, HUD assets, camera scaling, and an in-game contact sheet or preview. A creator replacing placeholders should need only the named asset and manifest entry, not combat code changes.

## Delivery sequence

1. **Menu foundation:** title, Start Game/Continue/New Run, Options, Exit panel, pause, and independent preference storage. Keep existing run saves loadable.
2. **Stage and camera:** viewport battle shell, resize handling, camera pan/zoom/fit, correct world-to-tile input, and compact HUD anchors. Preserve all current battle interactions.
3. **Context popup:** unit anchoring, flip/clamp, command and move submenus, direct tile actions with an optional preview button, keyboard/touch focus, and animation lock behavior.
4. **Turn portraits and information:** strip from `upcoming`, unit status, weather/objective/log panels, fallback portraits, and explicit current/next styling.
5. **Environment pass:** source and record public assets, normalize named files, render terrain/elevation/cover/water/lava, and update the asset guide. Retain existing attack effects unless a replacement passes native-scale review.
6. **Polish and performance:** motion settings, transitions and impact feedback, responsive layouts, 32×32 camera usability, and browser profiling against the 60 FPS target.

## Review gates

- On desktop, the battlefield occupies the available browser stage, and an 8×8 map is visibly larger than the present 512-pixel board. On 32×32, zoom/pan make individual units and target cells selectable.
- A player can complete a battle using the contextual popup, including one Move command and one Attack per turn, item Special, end turn with AP banking, move preview, and attack effectiveness preview. Popup placement stays near the acting unit and on screen at every edge and after camera movement.
- The title is the first interactive screen; saved runs offer Continue, and Options/Exit never erase a run. Menu and battle controls are usable by mouse, keyboard, and touch. The narrow layout keeps the floating commands near the unit and scrolls the menu if the available height is small.
- Portrait order matches the authoritative queue after speed changes, fainting, and a turn boundary. Animations and UI transitions leave seeded battle outcomes unchanged.
- Every imported public asset has source/license metadata and a named replacement path. Terrain and effects remain legible at native and zoomed scales, with no blurred pixels or visible tile seams.
- Record frame timing and memory for a 32×32, 16-unit battle in a production build; optimize measured bottlenecks before declaring the 60 FPS target met.
