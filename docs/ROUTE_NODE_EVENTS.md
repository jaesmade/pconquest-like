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

## Multi-node quest events (proposed)

This is a design proposal; chained quest events, key items, Gracidea, and Shaymin are not implemented. Keep the existing `special` node kind and use quest progress to decide which story beat a special node opens.

For the Gracidea and Shaymin example, define stable quest and step IDs and designate one specific special node as the quest starter. The guaranteed column 3 special node is a natural candidate. Landing on it always opens the initial flower/quest prompt. Claiming it adds Gracidea and activates the follow-up hunt.

On each later special node the player actually enters while the quest is active, roll once for the Shaymin follow-up. If it hits, save and show that scene; claiming it recruits Shaymin and completes the quest. If it misses, increase the saved miss count. When another eligible quest has not started, use that same node to open its starter prompt; otherwise resolve the ordinary special encounter. Skipping a special node is not a miss and does not increase the count. The ordinary weighted event pool remains the fallback whenever no quest follow-up or starter applies.

### Data model for multiple quests and steps

Do not represent this as a single active quest or a Gracidea-specific flag. Define quests by stable IDs and an ordered list of authored steps. A definition can have any number of steps and eligibility rules. Save progress for each quest independently: status (`unstarted`, `active`, or `complete`), the next step index, and the missed follow-up count for that current step. Keep a saved round-robin cursor (or equivalent stable ordering) for choosing which active quest gets the next follow-up check. This should support three or more quest definitions and several active chains without adding a new field for each quest.

A quest that requires three nodes has three distinct claimed steps: node one starts the quest and resolves step 1; a later special node resolves step 2; another later special node resolves step 3 and completes the quest. One node can advance at most one quest by one step. A miss does not advance the current quest. When a step is claimed, advance exactly one step and reset the miss count for the newly active step, so the rising odds for step 2 do not carry into step 3.

### Branching quest battles: Rayquaza example

Quest steps may be scenes, choices, battles, or rewards. A choice step stores a branch ID and selects the next authored step; it must not be represented as an untracked UI-only choice. One proposed Rayquaza quest flow is:

1. At its designated special node, the player meets Rayquaza and starts the quest.
2. At a later special node, the player finds Groudon and Kyogre fighting and chooses one branch:
   - **Side with Groudon:** start a saved quest battle against Kyogre. On victory, grant the Red Orb and offer Groudon to join.
   - **Side with Kyogre:** start a saved quest battle against Groudon. On victory, grant the Blue Orb and offer Kyogre to join.
   - **Fight both:** start a saved quest battle against Groudon and Kyogre together. On victory, grant the Meteorite and offer Rayquaza to join.
3. The matching key item and recruit are the exclusive reward for that branch. Do not grant the other branches' items or recruits.

After the player chooses, pause route progression and send the run through the existing preparation, battle, and intermission flow using a branch-specific encounter definition. Save the selected branch and encounter before preparation so a refresh or reload cannot change opponents. After a win and any level-up move choices, show a saved quest-reward event. It should grant the branch-matched key item, then allow only the matching recruit after validating the saved branch and ownership of that key item; resolve both exactly once before advancing beyond the special node. At the 20-Pokémon cap, show the existing replacement choice; return the released Pokémon's held item and transfer its selected slot as normal. Use the current run-loss behavior on defeat unless the design later calls for quest battles to be retryable. Explicitly author whether these fights award normal XP or coins; do not accidentally grant an ordinary battle-node coin reward just because the fight reused the battle pipeline.

The orb and Meteorite belong in the separate key-item collection, not the equipable-item Bag. Add Rayquaza, Groudon, and Kyogre to the species and battle-content catalogs with their required stats, moves, abilities, encounters, and visual assets. Keep them out of ordinary recruitment offers; the quest branch is their acquisition path. The branch choice, current battle step, result/reward, and pending full-roster replacement must all survive save/load and resolve only once.

At each later special node, check one active quest's current follow-up step in round-robin order. On success, save and show that step; claiming it advances that quest. On a miss, increase only that quest step's miss count. If an eligible unstarted quest remains, use the same node to show one new quest's opening step; otherwise resolve the ordinary special encounter. The newly started quest cannot also receive a follow-up check on that same node. If there are several eligible unstarted quests, choose among them with the run's seeded RNG and save the selected quest ID in the pending event. Skipping a special node is not a miss.

Use a rising chance that remains below 100%, independently for each follow-up step. One tunable curve is to start at 20% and double the follow-up odds after each missed check for that step. This gives about 20%, 33%, 50%, 67%, and 80% on successive checks, and never makes the encounter guaranteed. A completed step starts its next step at that step's base chance. These are initial tuning suggestions, not final balance values. Show all active quest objectives in a route tracker so the player can follow several chains.

Keep these state concerns separate:

- Save progress for every quest on `Run`, including quest ID, status, next step, and that step's missed follow-up count, plus the round-robin cursor. Advance quest steps only when the player claims the scene; record the selected quest, follow-up roll, any miss update, and any newly selected quest starter when the node is entered.
- If Gracidea should appear in an inspectable inventory or support a later Shaymin form change, add it to a separate key-item collection with stable IDs. Do not put it in `Run.bag` or `ItemId`: that bag is for equippable items and TMs. If it is only a progression marker, the quest step alone can represent it.
- Save the selected quest scene, newly started quest, or ordinary fallback outcome in the pending event payload, including quest and step IDs where applicable. This preserves the same text and reward after refresh and prevents rerolls, duplicate miss increments, or duplicate claims.
- Add quest-only recruits such as Shaymin, Groudon, Kyogre, and Rayquaza to `SPECIES` and their required move, ability, encounter, and visual content, but keep them out of ordinary `RECRUITS` offers when the story is their only source.

At the 20-Pokémon cap, ask the player which Pokémon to release before a quest reward joins. Reuse the recruitment replacement behavior: return the leaving Pokémon's held item to the bag and transfer its selected party slot to the recruit when applicable. Never silently discard a Pokémon or exceed the cap.

The route already guarantees special nodes in columns 3 and 7. The designated starter must be reachable if the quest is intended to be available in every run. The probabilistic follow-up is intentionally not guaranteed; it can remain unfinished if the player reaches the boss without a successful roll. If route generation changes to ensure the starter or add future special opportunities, keep `routeIsValid` and save migration behavior in sync. Any new saved quest, miss-count, key-item, or event-payload fields need migration defaults; increment the save schema when the persisted shape requires it.

Use `RouteStopScreen` for quest scenes and choices, and use `PrepareScreen` and the existing battle flow for a quest battle. The engine should select one quest check, roll its follow-up chance, and choose any new-quest or ordinary fallback in `selectRouteNode`, then validate the saved outcome and branch in the resolver; the UI should display saved payloads only. Add review coverage for refresh during each scene and battle, duplicate claims and miss increments, skipped nodes, increasing odds resetting between steps, at least three active quests, a three-step quest, round-robin order, each Rayquaza branch's enemies and exclusive reward, battle defeat, a full roster, and migration from a save with no quest fields.

## Review checklist

- Every generated node kind has a readable name, description, icon, and palette.
- Seeded route generation remains deterministic; guaranteed kinds fit the generated column size and every node remains connected.
- Events roll once on entry, persist across save/load, and cannot be claimed twice.
- Positive and negative probabilities add to 100%, and all reward ranges and rounding rules match the displayed copy.
- Recruitment offers contain three valid species, prefer unowned choices, respect the 20-Pokémon cap, return held items on replacement, and transfer a selected party slot.
- Save migrations preserve visited progress and remap the active node whenever the route graph changes.
- Run `npm run build` and `git diff --check`; then play through the changed node, including a refresh while its stop screen is open and a full-roster replacement if recruitment changed.
