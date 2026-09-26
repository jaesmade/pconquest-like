# UI overhaul plan

## Goal and current baseline

Make the battle feel like the main game screen: the map fills the browser viewport, the active Pokémon's commands appear beside it, and the next turns are readable as portraits over the battlefield. Add a title screen with **Start Game**, **Options**, and **Exit** before the existing run flow.

The current app uses React for menus and HUD, Phaser 3.90 for the board, and a 64-pixel world tile. `BattleScreen.tsx` places a board capped at 512 CSS pixels next to a sidebar. `Board.tsx` draws flat terrain colors, and its canvas is sized to the entire map. Existing 32-pixel unit, attack, and effect sheets are listed in `public/assets/animations/animation-manifest.json`. Keep the TypeScript battle state authoritative: UI, camera, and animations only present committed outcomes.

## Screen flow

```text
Boot/load save → Title
                 ├─ Start Game → Continue saved run / New Run → current starter, route, preparation, battle flow
                 ├─ Options → settings panel → Title
                 └─ Exit → saved-progress exit panel → Title or close tab

Battle → Pause overlay → Resume / Options / Exit to Title
Battle result → current XP and evolution flow → Title when run ends
```

- Always show the title after loading. **Start Game** goes straight to starter selection when there is no active run; otherwise it offers **Continue** and **New Run**. Show the existing run's encounter and party summary beside Continue. Confirm New Run only when it would replace an active save.
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

- Open beside the active allied Pokémon when its turn begins and attack/move animations finish. Clicking that Pokémon reopens it; clicking another Pokémon or tile while in Inspect shows information without changing the active actor. During enemy turns show a small `Opponent acting` indicator, not actionable commands.
- Main popup: **Attack**, **Move**, **Special**, **End Turn**, current HP/AP, and whether Attack has been used. Disabled commands state why: insufficient AP, attack already used, item blocked, or no usable special.
- Attack opens a move list in the same popup or an attached pane. Each move shows type, category, AP, range, and tags. Selecting a move highlights legal tiles and target effectiveness before confirmation. The target preview and **Confirm** remain visible without covering the chosen target. Cancel returns to the action popup and consumes no AP.
- Move shows reachable tiles and a path/AP preview. After a committed move, follow the sprite and reopen the popup at its new screen position if it still has AP. Attack remains limited to once per turn; moving or using a special follows existing AP rules.
- Anchor by projecting the active unit's world tile into stage coordinates on state, camera, or viewport changes. Prefer right of the unit; flip left/top/bottom and clamp inside the safe viewport when needed. Use a small connector/arrow so the popup remains associated with its unit. On narrow screens, use a bottom sheet with a pointer to the unit, preserving the same commands.
- Only one overlay owns input at a time. Escape/Back closes a submenu or pause panel in order; focus returns to the prior control. Keep keyboard and mouse use equivalent, provide visible focus, accessible names, and touch targets of at least 44 CSS pixels. Reduced motion removes popup travel and decorative effects while preserving actionable feedback.

## Turn order and battle information

- Replace the text queue with a horizontal portrait strip **inside the battle stage**. Show the current actor and the next five entries from the authoritative `upcoming(battle)` result. Portrait frame color and labels distinguish ally and enemy; highlight the current actor and show its AP gain. A repeated Pokémon appears only if the turn scheduler actually returns another entry.
- Reuse the current unit sheet's idle frame as a temporary portrait; later swap in named portrait images without changing turn-order data. Use species/form ID and a fallback portrait, so evolutions and future 8v8 rosters do not require hardcoded UI conditions.
- Put map name, weather and remaining duration, round/time, capture objective, selected unit HP/AP/status, and a compact expandable action log in fixed HUD positions. Critical combat messages may appear as short in-world callouts, but the log remains available to inspect missed events.
- During visual playback, disable game commands and keep the queue/HUD synchronized with committed battle state. Present animations sequentially as they are now; visual timing must not roll RNG or change outcomes.

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
3. **Context popup:** unit anchoring, flip/clamp, command and move submenus, target confirmation, keyboard/touch focus, and animation lock behavior.
4. **Turn portraits and information:** strip from `upcoming`, unit status, weather/objective/log panels, fallback portraits, and explicit current/next styling.
5. **Environment pass:** source and record public assets, normalize named files, render terrain/elevation/cover/water/lava, and update the asset guide. Retain existing attack effects unless a replacement passes native-scale review.
6. **Polish and performance:** motion settings, transitions and impact feedback, responsive layouts, 32×32 camera usability, and browser profiling against the 60 FPS target.

## Review gates

- On desktop, the battlefield occupies the available browser stage, and an 8×8 map is visibly larger than the present 512-pixel board. On 32×32, zoom/pan make individual units and target cells selectable.
- A player can complete a battle using the contextual popup, including repeated moves while AP remains, one attack per turn, item special, end turn, move preview, and attack effectiveness preview. Popup placement stays on screen at every edge and after camera movement.
- The title is the first interactive screen; saved runs offer Continue, and Options/Exit never erase a run. Menu and battle controls are usable by mouse, keyboard, and touch. The narrow layout uses a bottom sheet instead of obscuring the map.
- Portrait order matches the authoritative queue after speed changes, fainting, and a turn boundary. Animations and UI transitions leave seeded battle outcomes unchanged.
- Every imported public asset has source/license metadata and a named replacement path. Terrain and effects remain legible at native and zoomed scales, with no blurred pixels or visible tile seams.
- Record frame timing and memory for a 32×32, 16-unit battle in a production build; optimize measured bottlenecks before declaring the 60 FPS target met.
