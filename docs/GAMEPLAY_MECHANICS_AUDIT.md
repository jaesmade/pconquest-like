# Gameplay mechanics audit

Static review of the early build on 2026-09-27. Compared `PLAN.md` and `BALANCE.md` with battle rules, map authoring, items, abilities, AI, previews, and the run flow. No gameplay session or automated test was run for this audit. The examples below follow the current code paths; they are not measured play outcomes.

## Resolved since the review

- **Ability overhaul follow-up (2026-10-06):** New Capsule offers now save before random names are revealed, with retry and failed-use cancellation. Simultaneous ability callouts are grouped, battle saves reject Bag-only held items, and engine evolution/TM actions wait for pending Capsule choices. See the [ability gap review](ABILITY_OVERHAUL_PLAN.md#2026-10-06-implementation-gap-review) for corrected gaps, regression checks, and remaining content/testing work.

- **Participation-based battle XP:** Victory rewards now go only to player Pokémon deployed in the battle, including deployed Pokémon that faint. Reserves keep their XP and cannot gain levels or level-up move offers from that battle. The growth screen shows zero XP for reserves. See `src/game/engine.ts` and `src/ui/IntermissionScreen.tsx`.

- **Full-roster special recruitment:** At 20 owned Pokémon, the special screen now asks which roster member to replace and requires confirmation. Resolution checks the offered species and replacement ID, returns the leaving Pokémon's held item to the bag, and transfers its selected party slot to the recruit. See `src/game/engine.ts` and `src/ui/RouteStopScreen.tsx`.

- **Thunder Shock chain damage:** The chained target now gets its own evasion, absorption, type, critical, variance, stat, weather, and item checks. Damage is half of that target's calculated hit, rounded up. The chain applies no further on-hit effects or contact reactions. See `src/game/engine.ts` and `docs/PLAN.md`.
- **Area damage through solid blockers:** Walls, trees, and rocks cannot be aim points. Each defender in a damaging area must have clear line of sight from the attacker. Targeting preview, AI, visual effect tiles, and damage resolution use that rule. See `src/game/grid.ts`, `src/game/engine.ts`, `src/game/enemyPlanner.ts`, `src/ui/MovePreview.tsx`, and `src/battle/Board.tsx`.
- **Stealth Rock zone ownership:** Each caster's active zone has a source ID, zone ID, tiles, and expiry. Recasting removes only that caster's old zone, while overlapping zones from others remain. The derived tile expiry handles a single hazard trigger per entry. Save v13 keeps zone ownership and migrates old tile expiries as temporary legacy zones. See `src/game/hazards.ts` and `src/persistence/save.ts`.
- **Timed stat stages:** Attack, Defense, Special Attack, Special Defense, and Speed support ±6 stages; HP and Movement are excluded. Tail Whip, Harden, and Howl refresh a per-stat five-cycle expiry on the AV timeline. Speed stages rescale waiting actions, expire at their scheduled AV timestamp, and interact with paralysis and Trick Room; no current move targets Speed yet. Stage icons show cycles remaining, and the damage calculator and enemy AI use the same cap. Save v26 adds inactive Speed stages to v25 battles while preserving their existing state; pre-v14 active stages receive the current five-cycle duration. See `src/game/stages.ts`, `src/game/damage.ts`, and `src/persistence/save.ts`.
- **Grounded map routes:** Map creation now checks every plain deployment cell and capture tile with battle terrain movement rules. Encounter validation checks legal swimmer and flyer placements, and enemy water placements need a reachable shore. See `src/game/grid.ts`, `src/content/maps.ts`, and `src/content/catalog.ts`.

## Rule defects to fix first

| Priority | Finding and player impact | Evidence | Repair |
| --- | --- | --- | --- |
| P1 | **Rock Throw cover does not protect its current target.** Cover is placed on the hit target's tile, but line of sight checks only intervening tiles. As long as the target occupies that tile, direct shots ignore its new cover. Cover matters mainly after the unit leaves and another shot crosses the empty tile. | `src/content/moves.ts` `rockThrow`; `src/game/engine.ts` on-hit tile effect; `src/game/grid.ts` `hasLineOfSight`. | Define cover as a defender benefit, an adjacent spawned obstacle, or an intervening tile effect. Match placement, targeting, and preview to that rule. |

## Deferred

Mega HP conversion is deferred by the user. Future Mega forms are intended to retain their source HP stat; the current placeholder form still differs. Revisit the transformation and party HP writeback when replacing that form.

## Missing gameplay and encounter safeguards

| Priority | Gap | Evidence and next step |
| --- | --- | --- |
| P2 | **The ten-column route has limited event variety and unlock effects.** Seeded battle, elite, heal, store, special, and boss nodes now branch, but the special event has one script and a win increments `unlocks` without changing future available content. | `src/game/route.ts`; `src/game/engine.ts`; `src/ui/RouteStopScreen.tsx`. Add data-driven special encounter variants and implement the [recruitment-based starter plan](PARTY_BUILDER.md#recruitment-based-starter-unlocks-proposal): fixed initial choices, successful recruitment history, and permanent choices banked after wins or losses. |
| P2 | **Movement previews omit hazard damage.** Move preview shows AP and destination height but not hazard damage along the route. Weather duration, weather move effects, and the next Sandstorm tick are now exposed in the battle HUD. | `src/ui/BattleScreen.tsx` path preview; `docs/PLAN.md` battle rules. Derive hazard forecasts from the selected path and current battle state; do not consume RNG. |
| Future target | **20 owned Pokémon and six deployed are supported locally; competitive 8v8 is not implemented.** Local AI has no authoritative match ownership or turn deadline. Competitive 8v8 remains future scope. | `docs/SCALABILITY_TARGETS.md`; `src/game/engine.ts`; `src/app/App.tsx`. Keep this as a separate multiplayer milestone, including server validation, replayable IDs, reconnect, AP-bank policy, and timeout rules. |

## Specification drift to resolve while fixing rules

- `PLAN.md` calls for a 1.2× same-type bonus and later asks for standard Pokémon damage. `src/game/damage.ts` applies 1.5×. The later standard-calculation request supports 1.5×; update the earlier plan text to avoid tuning against the wrong number.
- `PLAN.md` lists Thunderbolt as 3 AP in its move table and 4 AP in its cost summary. The move data uses 4 AP. Use one canonical cost in documentation.
- `PLAN.md` describes critical damage as a final multiplier; `src/game/damage.ts` applies it before random, same-type, type, and Burn modifiers. Confirm the intended standard generation and document the actual modifier order.

## Suggested order

Settle cover semantics next. Address recruit/reward decisions and the missing forecasts before expanding move and map content. Revisit Mega HP with the future Mega form content pass.
