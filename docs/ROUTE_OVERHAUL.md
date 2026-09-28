# Ten-column route and deployment overhaul

## Run flow

After the six-point starting draft, the player enters a generated cavern route with **10 columns**. Column 1 is a battle; column 10 is always the boss. Columns 2–9 have between two and four choices and a mix of battle, elite, healing, store, and special nodes. Columns 4 and 7 always contain four nodes so every generated run visibly uses the expanded branching layout. A choice is legal only when it is in the next column and has a drawn connection from the previously completed node. The full map can be inspected by horizontal dragging through the boss, while only connected choices in the next column are active. Route generation uses a separate seeded stream, so opening the screen does not change combat RNG.

Columns 2, 3, 5, and 7 guarantee visible healing/store/special opportunities. A route through the three guaranteed special nodes can recruit enough Pokémon to deploy six, if the player chooses that path. Other node positions vary with the run seed.

| Node | Current behavior |
| --- | --- |
| Battle | Three standard enemies. Win for shared XP and 12 coins. |
| Elite battle | Four enemies at a higher level. Win for shared XP and 20 coins. |
| Healing | Immediately fills HP and revives every owned Pokémon, including reserves. |
| Store | Opens a shop. Spend coins on held items for the bag; leave when ready. |
| Special | A simple hidden clearing: choose one of two free recruits or take 18 coins. At the 20-owned cap, choose an existing Pokémon to release before confirming a recruit. Its held item returns to the bag; a selected party slot passes to the recruit. |
| Boss | Four high-level opponents on the Crown Citadel map. Defeat them and hold the capture tile to clear the layer and finish this run. Win for shared XP and 30 coins. |

The shop starts with Sitrus Berry (12), X Attack (14), Leftovers (20), Assault Vest (26), and Charizardite X (40). A new run starts with 20 coins. The item goes into the bag; after leaving the shop, the player can assign it from the party panel while choosing the next route node. Shops may sell multiple copies while funds remain. Prices and stock live in `src/content/shop.ts`.

Normal enemy level is `9 + floor((column − 1) × 0.8)`; elite adds 3 levels and one opponent. The boss currently uses level 21 and four opponents. Battle wins give 65 XP at normal nodes, 85 at elite nodes, and 100 at the boss. These values are initial tuning targets, not measured balance.

## Preparation on the map

While choosing a route node, open **Party** to manage every owned Pokémon. Each card expands to show four equipped move slots, learned move choices, a held-item selector limited to compatible items in the bag, and an evolution action when its level requirement is met. Choosing an already equipped move swaps slots. Item swaps return the old item to the bag. The party panel is the only place to change move loadouts, assign held items, or evolve; the post-battle screen reports XP and newly learned moves, then returns to this route screen. Evolution can be deferred to a later route choice.

After choosing a battle, elite, or boss node, preparation shows a scrollable owned roster beside the **authored isometric map**. Up to six healthy Pokémon can be selected. Select a roster portrait, then click or keyboard-activate a highlighted tile in the ally zone. The map uses the same tile assets, tile centers, zones, terrain objects, and legal-placement rule as combat. Selected positions appear as numbered portraits on the map. Clicking an occupied tile swaps two teammates only when both positions are legal. Enemy entry remains in the top enemy zone. Preparation handles deployment and positioning only.

Preparation now opens over a noninteractive view of the route board. A dark translucent frame holds the roster on the left and the live isometric deployment map on the right, matching the route selector's floor, tile graph, and panel colors. The upper-right Back button returns to route choice and removes that pending node from the visited path; its battle has not started. On narrow screens, the roster becomes a horizontal strip above the map. The placement and six-unit limits still use the existing deployment rules.

After a victory, the growth screen uses the same route-board backdrop and frame. Its summary shows the encounter's XP award for every owned Pokémon, coins earned, and rewarded roster count. A scrollable two-column card grid (one column on narrow screens) shows portrait, final level, awarded XP, current level progress, HP, and deployed/reserve state. A card highlights a level-up when the award crossed its current level threshold. Level and learned-move milestones remain below the cards, with an OK control to continue. The award comes from the encounter definition used by battle completion; reserves receive it too. At the level cap, the progress display says Maximum level. Cosmetic card and bar motion respects reduced-motion preferences.

Store, special encounter, and run-result screens now use the route's repeating tile floor, dark translucent frame, and pale inner panel. Their controls use the same raspberry outline and gold primary action as the other menus. This changes presentation and leaves node rewards and route choices intact.

The six-point **starting draft** still usually yields three Pokémon because ordinary species cost two points. Six is the battle deployment ceiling, not a larger starting budget. The run may own up to 20, with reserves outside battle.

## State, saves, and art

- `src/game/route.ts` defines node IDs, seeded generation, connection rules, and plan validation.
- `src/game/engine.ts` validates node choices and resolves node rewards, battle strength, shop purchases, and progression. The saved run carries route nodes, visited node IDs, current node ID, and coins.
- `src/ui/RouteScreen.tsx` draws the graph and node icons as scalable SVG with keyboard focus. The full-screen selector uses larger raised tiles with pale stone sides, engraved pixel-grain tops, blue connections, cyan glow and amber pointers for available nodes, a clean repeating isometric tile floor, a route avatar marker, left coin/party controls, and a small upper-right back button inspired by the supplied reference. Tile colors distinguish encounters and stops. The graph scrolls horizontally to keep ten columns readable; mouse or touch dragging reveals every later column through the boss, while a click still chooses an available node. When the viewport changes, it aligns the current tile in view. The start tile, first battle, and boss share the center row; route columns are spaced 335 SVG units apart and rows 190 units apart. The responsive translucent party management panel remains accessible from the Party control. `src/ui/RouteStopScreen.tsx` renders shop and special choices. `src/ui/DeploymentBoard.tsx` draws the isometric placement map from the authored tiles.
- Save schema **v18** migrates v16–v17 route progress onto the expanded graph and migrates v15 and earlier runs to a center path, preserving current battle and party state. New route decisions follow the ten-column rules.
- `public/assets/backgrounds/route-tiles.svg` is the active route-selection backdrop: a small repeating pale limestone diamond grid with subtle tile variation and no ruins, vegetation, or other objects. `src/styles/route.css` repeats it at 112×56 CSS pixels, so it fills wide and narrow route viewports without cropping or stretching. The older `route-ruins-pixel.png` artwork remains in the assets folder but is not used by the selector. `public/assets/backgrounds/route-cavern-pixel.png` remains in the asset folder but is not the active route-stop backdrop. Graph lines, icons, and labels are code-native and replaceable without changing route rules.
- `public/assets/ui/route-trainer-placeholder.svg` is an original hand-authored 32×32 pixel-grid avatar rendered at 96×96. Its transparent ground point is `(16,31)` in source coordinates. The dark-capped, pink-haired explorer with pale cape tips stands on the current route tile and can be replaced independently of the party's Pokémon sprites; keep a transparent background and feet centered at the lower edge so it remains aligned to the tile.

## Review targets

- Follow a legal path from column 1 to column 10; locked and disconnected nodes never activate.
- Verify healing restores fainted reserves, shop purchases spend exact coins and enter the bag, and a special node offers recruit or coins. At 20 owned, recruitment requires a valid replacement and returns that Pokémon's held item to the bag.
- Deploy six on separate legal ally tiles when the run has six healthy Pokémon; a seventh cannot be selected.
- Confirm battle preparation and the battle renderer show the same map locations for every chosen position.
- Confirm generated columns contain no more than four nodes, columns 4 and 7 contain four, and every displayed node has at least one incoming and outgoing connection where applicable.
- Check the route and party overlay at desktop and narrow widths. On narrow screens the graph scrolls horizontally, starts with the current tile and next choice in view, and the party cards stack into one column. Drag from the current tile across all ten columns to the boss; dragging across an available node must not select it, while a short click still does. The reference-sized view should show the uninterrupted stone tile floor without ruins or props, the dark start tile, connected colored encounter tiles, blue links, left coin/Party HUD, and upper-right back control without a large title banner over the route.
- On a route choice, swap learned moves, equip and unequip bag items, and evolve an eligible Pokémon. Confirm preparation has only deployment controls and intermission only reports growth. Items purchased or returned from replacement become available at the next route choice.
- Review the shop, special, and result panels on the repeated tile floor at desktop and narrow widths; content should scroll within the translucent frame without losing its main action.
- Review XP cards for deployed and reserve Pokémon, a level-up, a learned move, and a maximum-level Pokémon. Check that the coin summary, milestone list, and OK action remain reachable with a full 20-Pokémon roster and reduced motion enabled.

### Route node art details

The selector keeps the reference's raised stone-token look using code-native SVG in `RouteScreen.tsx`. Each tile has a dark cast shadow, light and shaded stone sides, a pale rim, a colored inset, a small pixel-grain pattern, and an engraved inner border. Battle, store, and special nodes use warm gold; elite nodes use rose red with a four-point spark; healing is green; the start is navy. The sword, healing cross, cart, question mark, and boss mark remain replaceable inside `Glyph`. A future icon asset should fit roughly 75×75 SVG units around its center and keep high contrast against its tile. Available nodes alone receive the cyan glow and amber pointer. Locked future nodes remain fully colored so the route is readable, while their click and keyboard activation stay disabled. The number and placement of choices still come from the saved route graph, so a generated four-choice column may be denser than the visual reference.
