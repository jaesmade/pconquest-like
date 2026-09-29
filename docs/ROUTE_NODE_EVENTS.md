# Route node and event authoring guide

This guide covers how to add or change route node types and the events they open. The player-facing route rules and current rewards live in [Route overhaul](ROUTE_OVERHAUL.md); this page explains where the implementation belongs.

## Where each part lives

| Concern | File | Responsibility |
| --- | --- | --- |
| Node kinds and route graph | `src/game/route.ts` | `RouteNodeKind`, guaranteed node kinds, seeded generation, links, route validation, and graph migration. |
| Run and event state | `src/game/types.ts` | `RouteEvent` and the optional saved `pendingRouteEvent` on `Run`. |
| Node entry and outcomes | `src/game/engine.ts` | `selectRouteNode`, offer generation, reward validation, effects, and route advancement. |
| Node labels and map icon | `src/ui/RouteScreen.tsx` | Names, short descriptions, SVG `Glyph`, and map selection UI. |
| Node color and stop layout | `src/styles/route.css` | Kind-specific token colors and route-stop presentation. |
| Event and recruit screens | `src/ui/RouteStopScreen.tsx` | Shop, special-event result, and recruitment choices. |
| Save compatibility | `src/persistence/save.ts` | Save schema version and migration for changed route graphs or event payloads. |

## Add or change a node kind

1. Add the kind to `RouteNodeKind` in `src/game/route.ts` and to `routeKinds` if the generator may place it randomly.
2. If a column must contain the node, add it under `guaranteedKinds`. Keep the required kinds count at or below that column's generated node count. Columns 4 and 7 always have four slots; other columns have two to four.
3. Add a player-facing name and short description in `src/ui/RouteScreen.tsx`. Add a distinct `Glyph` branch and a `.route-node.<kind>` palette in `src/styles/route.css` so the token is identifiable on the map.
4. Add the node's entry behavior in `selectRouteNode` in `src/game/engine.ts`. Battle nodes continue into preparation; stops can use the existing `event` phase and render through `RouteStopScreen`.
5. If it offers Pokémon or items, build choices from authoritative content IDs (`RECRUITS`, `SPECIES`, or `ItemId`) and validate the selected ID in the engine before changing the run. Preserve the 20-owned Pokémon cap and the existing full-roster replacement flow.
6. Update the current rules and review targets in `ROUTE_OVERHAUL.md`, and add a dated implementation entry to `PROJECT_MASTER.md` after the change is complete.

Route generation is seeded and `routeIsValid` compares the saved graph with a fresh graph for that seed. Changing node placement, guarantees, or the generation algorithm therefore requires a save migration: increment the save schema, rebuild the route with `migrateRoutePlan`, and remap `currentNodeId` to the corresponding migrated visited node. Do not silently change generated graphs while keeping the same schema.

## Add or change an event outcome

1. Represent any saved result in the `RouteEvent` union in `src/game/types.ts`. Keep the pending result on `Run` so a refresh cannot reroll an event or lose its result.
2. Roll the outcome once, when its node is entered in `selectRouteNode`. Use the run's seeded `random(next)` stream and save the resulting event payload. Do not roll from React rendering or button handlers.
3. Apply the effect in `resolveSpecial` in `src/game/engine.ts`. Validate the current phase, node kind, selected choice, currency, roster size, and item/species IDs before changing state. Clear `pendingRouteEvent` after a successful claim, then advance the route.
4. Add clear outcome copy in `RouteStopScreen.tsx`. Keep recruit-node choices separate from special-event claims. Update the node's route-map description if players should know its odds before choosing it.
5. If the saved payload shape changes, update migrations in `src/persistence/save.ts`. When old event state cannot be represented safely by the new payload, explicitly convert or resolve it during migration. A change to only the outcome effect or probabilities does not require a schema bump when saved payloads remain compatible.
6. Update `ROUTE_OVERHAUL.md` with the player-facing odds and effects, and add the dated entry to `PROJECT_MASTER.md`.

## Current implementation example

The special node currently rolls a positive result with 75% probability and a negative result with 25% probability. Within the positive branch, the three rewards are equally likely: 50–100 coins in 10-coin steps, a Sitrus Berry, or 25% HP recovery for each owned Pokémon. Recovery rounds up from maximum HP and cannot exceed maximum HP. Within the negative branch, losing half the coins and taking 20% HP damage across the roster are equally likely. Coin loss rounds down; damage rounds up from maximum HP and cannot reduce a Pokémon below 1 HP. The selected event is saved in `pendingRouteEvent` and claimed once.

The recruitment node uses the same stop screen but does not use `pendingRouteEvent`. `offerRecruits` presents three choices from `RECRUITS`, preferring species the player does not own. This list includes starter species and non-starter Vulpix and Charmander. The engine checks the offer and replacement before accepting a recruit.

## Review checklist

- Every generated node kind has a readable name, description, icon, and palette.
- Seeded route generation remains deterministic; guaranteed kinds fit the generated column size and every node remains connected.
- Events roll once on entry, persist across save/load, and cannot be claimed twice.
- Positive and negative probabilities add to 100%, and all reward ranges and rounding rules match the displayed copy.
- Recruitment offers contain three valid species, prefer unowned choices, respect the 20-Pokémon cap, return held items on replacement, and transfer a selected party slot.
- Save migrations preserve visited progress and remap the active node whenever the route graph changes.
- Run `npm run build` and `git diff --check`; then play through the changed node, including a refresh while its stop screen is open and a full-roster replacement if recruitment changed.
