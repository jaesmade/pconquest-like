# Ten-column route and deployment overhaul

## Run flow

After the six-point starting draft, the player enters a generated cavern route with **10 columns**. Column 1 is a battle; column 10 is always the boss. Columns 2–9 have between two and four choices and a mix of battle, elite, healing, store, and special nodes. Columns 4 and 7 always contain four nodes so every generated run visibly uses the expanded branching layout. A choice is legal only when it is in the next column and has a drawn connection from the previously completed node. The whole map is visible, while only connected choices in the next column are active. Route generation uses a separate seeded stream, so opening the screen does not change combat RNG.

Columns 2, 3, 5, and 7 guarantee visible healing/store/special opportunities. A route through the three guaranteed special nodes can recruit enough Pokémon to deploy six, if the player chooses that path. Other node positions vary with the run seed.

| Node | Current behavior |
| --- | --- |
| Battle | Three standard enemies. Win for shared XP and 12 coins. |
| Elite battle | Four enemies at a higher level. Win for shared XP and 20 coins. |
| Healing | Immediately fills HP and revives every owned Pokémon, including reserves. |
| Store | Opens a shop. Spend coins on held items for the bag; leave when ready. |
| Special | A simple hidden clearing: choose one of two free recruits or take 18 coins. At the 20-owned cap, choose an existing Pokémon to release before confirming a recruit. Its held item returns to the bag; a selected party slot passes to the recruit. |
| Boss | Four high-level opponents on the Crown Citadel map. Defeat them and hold the capture tile to clear the layer and finish this run. Win for shared XP and 30 coins. |

The shop starts with Sitrus Berry (12), X Attack (14), Leftovers (20), Assault Vest (26), and Charizardite X (40). A new run starts with 20 coins. The item goes into the bag; the player equips it during battle preparation. Shops may sell multiple copies while funds remain. Prices and stock live in `src/content/shop.ts`.

Normal enemy level is `9 + floor((column − 1) × 0.8)`; elite adds 3 levels and one opponent. The boss currently uses level 21 and four opponents. Battle wins give 65 XP at normal nodes, 85 at elite nodes, and 100 at the boss. These values are initial tuning targets, not measured balance.

## Preparation on the map

After choosing a battle, elite, or boss node, preparation shows a scrollable owned roster beside the **authored isometric map**. Up to six healthy Pokémon can be selected. Select a roster portrait, then click or keyboard-activate a highlighted tile in the ally zone. The map uses the same tile assets, tile centers, zones, terrain objects, and legal-placement rule as combat. Selected positions appear as numbered portraits on the map. Clicking an occupied tile swaps two teammates only when both positions are legal. Enemy entry remains in the top enemy zone. Moves and held items remain editable in the expandable loadout section.

The six-point **starting draft** still usually yields three Pokémon because ordinary species cost two points. Six is the battle deployment ceiling, not a larger starting budget. The run may own up to 20, with reserves outside battle.

## State, saves, and art

- `src/game/route.ts` defines node IDs, seeded generation, connection rules, and plan validation.
- `src/game/engine.ts` validates node choices and resolves node rewards, battle strength, shop purchases, and progression. The saved run carries route nodes, visited node IDs, current node ID, and coins.
- `src/ui/RouteScreen.tsx` draws the graph and node icons as scalable SVG with keyboard focus. The full-screen selector uses raised layered tiles, pale stone sides, cyan connections, cyan glow and amber pointers for available nodes, an isometric stone-grid backdrop, a lead-Pokémon map marker, coin/party controls, and a responsive translucent party summary inspired by the supplied route screenshots. Tile colors distinguish encounters and stops. `src/ui/RouteStopScreen.tsx` renders shop and special choices. `src/ui/DeploymentBoard.tsx` draws the isometric placement map from the authored tiles.
- Save schema **v18** migrates v16–v17 route progress onto the expanded graph and migrates v15 and earlier runs to a center path, preserving current battle and party state. New route decisions follow the ten-column rules.
- `public/assets/backgrounds/route-cavern-pixel.png` is generated placeholder art. Prompt: “Pixel art game background, 16:9: wide warm sandstone cavern floor with broad clear center for game map overlay, rocky brown cave walls at left and right edges, sparse moss and blue crystal flecks. Cohesive square pixel clusters. No text, no symbols, no UI, no characters.” It was made with the built-in image generation tool on 2026-09-28. Graph lines, icons, and labels are code-native and remain replaceable without changing route rules.

## Review targets

- Follow a legal path from column 1 to column 10; locked and disconnected nodes never activate.
- Verify healing restores fainted reserves, shop purchases spend exact coins and enter the bag, and a special node offers recruit or coins. At 20 owned, recruitment requires a valid replacement and returns that Pokémon's held item to the bag.
- Deploy six on separate legal ally tiles when the run has six healthy Pokémon; a seventh cannot be selected.
- Confirm battle preparation and the battle renderer show the same map locations for every chosen position.
- Confirm generated columns contain no more than four nodes, columns 4 and 7 contain four, and every displayed node has at least one incoming and outgoing connection where applicable.
- Check the route and party overlay at desktop and narrow widths. On narrow screens the graph scrolls horizontally and the party cards stack into one column.
