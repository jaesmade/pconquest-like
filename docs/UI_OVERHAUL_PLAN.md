# UI overhaul plan

## Implementation progress (starting party draft)

- The new-run draft uses a clearer header, a six-segment point meter, compact selected-party cards, larger species choices, a type filter, and a persistent stat inspector. Species retain the shared placeholder portrait, with type-color accents to help distinguish them until individual portraits are available. Unaffordable choices remain inspectable but cannot be added.
- The draft styles now live in `src/styles/party-builder.css`. The selection rules, point costs, and stat calculations are unchanged; see [party builder](PARTY_BUILDER.md) for behavior and replacement details.

## Shared visual style (implemented)

The title, party draft, route controls, preparation, shop, special encounter, and post-battle screens now use one interface palette. `src/styles/theme.css` defines navy ink (`#17303e`), raspberry borders (`#b6194e`), coral display accents (`#ed6b5d`), gold primary actions (`#ffcb3d`), pale aqua page backgrounds, and paper or gray panels. Pixel lettering is reserved for display headings and short controls; body copy stays in the readable sans-serif face. Primary actions use gold with a raspberry outline, while neutral menu choices use gray.

The isometric battle map keeps its environmental colors, while route stops use the same tiled floor as route selection. Battle HUD panels use dark navy surfaces for contrast with the map, with the same raspberry outline and gold focus/current-turn cue. Health, teams, terrain, and targeting colors continue to communicate gameplay state and should not be recolored solely to match menu decoration. Shared styling loads after the screen styles so new screens can use the tokens without copying older green panel rules. Review at desktop and narrow widths; keep critical controls inside safe-area insets and give keyboard focus a visible gold outline.

## Implementation progress (palette and XP reward pass)

- Shared colors now flow through the title options, route HUD and party panel, shop/special stops, preparation, battle HUD, and result screen. Navy glass frames and pale paper panels contain the content; raspberry outlines and gold primary actions give controls a consistent hierarchy. Healing and other gameplay signals keep their semantic colors. The shop/special and result screens use the same repeating route tile floor instead of the separate cavern backdrop.
- The XP screen leads with a per-Pokémon XP and coin summary. Each scrollable card shows the portrait, final level, awarded XP, level progress, HP, and deployed/reserve state; a level-up badge appears when the new level can be established from the XP award. Level and move milestones sit below the cards. Cards and bars animate briefly unless reduced motion is enabled. The existing battle reward and progression rules are unchanged.
- The local production build was checked. Screen appearance and interactions still need an in-browser review at desktop and narrow widths; the prior browser approval was unavailable because of the account usage limit.

## Implementation progress (route-linked preparation and growth)

- Deployment and post-battle XP now use the route selector as a noninteractive backdrop. A dark translucent outer frame and pale translucent panels follow the supplied position and XP references. Preparation keeps the live isometric placement board beside the party roster, with a Back control that returns to the route choice before battle. On small screens the roster sits in a scrollable strip above the map.
- The placement UI now gives each Pokémon a readable roster row with HP, type, deployment status, and an explicit Add/Remove action. A six-slot meter, active-unit status, map zone labels, and stronger current-tile feedback clarify the select-then-place flow. The mobile frame constrains its scrollable roster to the viewport. These are presentation changes; tile and team legality still come from the existing deployment rules.
- The growth screen replaces the text-only report with scrollable Pokémon cards showing portrait, level, awarded XP, level progress, and HP. Coins, level-ups, and learned-move messages remain visible below the cards. The action control continues the run. Route generation, placement legality, and XP awards are unchanged.

## Implementation progress (glass battle action menu)

- The active Pokémon's contextual popup now follows the supplied action-state sketch. Its main state has four compact buttons: **Attack**, **Move**, **Special**, and **End**. The actor HUD retains HP, AP, and status information so those values do not crowd the command list.
- **Attack** opens four equipped moves in the supplied cross layout: one above, one left, one right, and one below a central Back button. Hovering or focusing a move opens a separate compact description tooltip with power, range, type, category, and AP cost. The tooltip does not resize or move the action buttons. Choosing a move replaces the list with only Back; the board shows range, area, and effectiveness, and clicking a valid tile commits the attack. Back returns to move choice without spending AP.
- **Move** shows only Back in the popup. Reachable tiles remain highlighted, and the bottom hint reports the hovered path's AP cost and AP left; clicking a tile commits movement. **Special** opens Back and Use Item; its tooltip shows the held item's AP cost. **End** asks Yes or No before passing and banking AP.
- `src/styles/battle-menu.css` loads after the shared theme. Only the individual buttons and temporary descriptions have translucent pale glass surfaces; the menu wrapper has no fill, outline, or shadow. The popup follows the acting unit on wide and narrow screens, preferring a position above it and clamping to the top HUD boundary when necessary. Keyboard focus is visible; Escape walks back through menu states. Battle rules and seeded outcomes are unchanged.

## Implementation progress (first slice)

- The title flow now begins with a splash, then shows Continue when available, New Run, Lab, Options (sound), and Exit information. The battle has a pause overlay with Resume and Title. New Run asks before replacing an active save.
- Battle uses a viewport stage, a six-entry portrait turn strip from the authoritative turn order, a unit-anchored action menu, a compact actor HUD, status/stat icons, and a collapsible log. The action menu stays by the unit on narrow viewports. Existing unit sheets supply temporary portraits and model animations.
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
- Hovering over a movement tile previews the authoritative route on the map and its AP cost in the bottom hint. Clicking a reachable tile commits the move; Back consumes no AP. Reachability is calculated once per movement state and shared with highlights.
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

- The route is a saved ten-column graph with a guaranteed boss in column ten. Middle columns contain two to four nodes, with four-node branches guaranteed in columns 4 and 7. React renders the full-screen repeating pale isometric tile board with raised and engraved node tiles, blue paths, glowing amber-marked choices, an original explorer marker, compact coin/Party/Bag controls on the left, an upper-right title return control, and translucent responsive overlays. Progression columns appear as rows climbing from the bottom start to the top boss, with choices spread across the board. Mouse dragging or touch and wheel scrolling reveals the boss above; the guide pans up toward the boss and down toward the start. Only the next connected nodes accept input. See [ROUTE_OVERHAUL.md](ROUTE_OVERHAUL.md).
- Battle and elite nodes open preparation, healing fully restores and revives, stores sell held items for coins, and the initial special encounter offers one of two free recruits or a coin cache.
- The route party overlay displays four active moves as read-only chips and expands each Pokémon for its compatible held-item selector and eligible evolution. The post-battle growth screen offers each new level move for replacement or skip before the route continues. The route Bag has a distinct TM section with compatible recipient and replacement-slot controls.
- Preparation now places up to six selected Pokémon directly on the authored isometric map. Its scrollable roster and map are for deployment and positioning only. Tile legality and saved positions use the same deployment rules as battle.

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
- Move shows reachable tiles and a path/AP preview on hover. Clicking a valid tile commits movement. After a committed move, follow the sprite and reopen the popup at its new screen position if it still has AP. Attack remains limited to once per turn; moving or using a special follows existing AP rules.
- Anchor by projecting the active unit's world tile into stage coordinates on state, camera, or viewport changes. Center the menu above the unit and clamp it against the top HUD and viewport edges when space is limited. Keep this behavior on narrow screens. Keep move descriptions in a separate overlay so hover does not change the menu's dimensions or anchor.
- Only one overlay owns input at a time. Escape/Back closes a submenu or pause panel in order; focus returns to the prior control. Keep keyboard and mouse use equivalent, provide visible focus, accessible names, and touch targets of at least 44 CSS pixels. Reduced motion removes popup travel and decorative effects while preserving actionable feedback.

## Turn order and battle information

- Replace the text queue with a horizontal portrait strip **inside the battle stage**. Show the current actor and the next five entries from the authoritative `upcoming(battle)` result. Portrait frame color and labels distinguish ally and enemy; highlight the current actor and show its AP gain. A repeated Pokémon appears only if the turn scheduler actually returns another entry.
- Reuse the current unit sheet's idle frame as a temporary portrait; later swap in named portrait images without changing turn-order data. Use species/form ID and a fallback portrait, so evolutions and future 8v8 rosters do not require hardcoded UI conditions.
- Put map name, weather and remaining duration, round/time, capture objective, selected unit HP/AP/status, and a compact expandable action log in fixed HUD positions. Critical combat messages may appear as short in-world callouts, but the log remains available to inspect missed events.
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
- A player can complete a battle using the contextual popup, including repeated moves while AP remains, one attack per turn, item special, end turn, move preview, and attack effectiveness preview. Popup placement stays near the acting unit and on screen at every edge and after camera movement.
- The title is the first interactive screen; saved runs offer Continue, and Options/Exit never erase a run. Menu and battle controls are usable by mouse, keyboard, and touch. The narrow layout keeps the floating commands near the unit and scrolls the menu if the available height is small.
- Portrait order matches the authoritative queue after speed changes, fainting, and a turn boundary. Animations and UI transitions leave seeded battle outcomes unchanged.
- Every imported public asset has source/license metadata and a named replacement path. Terrain and effects remain legible at native and zoomed scales, with no blurred pixels or visible tile seams.
- Record frame timing and memory for a 32×32, 16-unit battle in a production build; optimize measured bottlenecks before declaring the 60 FPS target met.
