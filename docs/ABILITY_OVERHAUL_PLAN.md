# Ability overhaul

**Ability-slot overhaul status:** Implemented on 2026-10-06. Pokémon have a given ability and a hidden slot; an Ability Patch unlocks the hidden passive, and an Ability Capsule replaces either eligible slot. Hidden assignments currently reuse existing runtime abilities as temporary game-specific choices.

The [detailed CSV proposals added on 2026-10-15](#detailed-csv-proposals-2026-10-15-design-only) are design work. They do not expand the nine runtime abilities or change these implemented slot/item rules.

## Playing with the ability items

Every new run starts with **one Ability Capsule and one Ability Patch** in the Bag for testing. Open Bag from the route screen, then use either item under **Ability items**. These are single-use Bag items; they cannot be equipped or used as battle Special actions. Store stock and event rewards have not been extended with them.

A new drafted or recruited Pokémon has its given ability active and its hidden ability locked. Using a Patch asks for a Pokémon and confirmation, then consumes one Patch and activates the second passive. Both abilities work together in battle. A Pokémon whose hidden ability is already unlocked is ineligible for another Patch. Fainted owned Pokémon can also receive these between-battle upgrades; the items do not change HP.

A Capsule asks for a Pokémon, then the **given** slot or the **hidden** slot if unlocked. Selecting the slot rolls three distinct random replacements from the nine implemented abilities. Both currently assigned IDs are excluded, including the locked hidden value, so a Capsule always changes the selected slot and cannot create duplicate abilities. Choosing an offered ability consumes one Capsule and changes only that slot. Closing before the roll cancels freely.

Selecting a slot reserves the target, slot, three choices, and advanced run RNG. The campaign saves that reservation immediately and shows the random choices only after storage confirms success. While saving, the dialog shows progress. If saving fails, **Retry saving** retries the same offer; **Cancel use** releases the unrevealed reservation without consuming a Capsule or rewinding RNG. A successfully saved offer cannot be cancelled to roll again.

**Choose later** dismisses the dialog; **Resume choices** shows the same offer or its save status. Reloading preserves a successfully saved offer. Complete that choice before continuing the route or using other upgrades; both the UI and engine block those actions. Invalid uses and repeated confirmations consume no item.

## Temporary hidden assignments

These are placeholders from the existing ability catalog, not official hidden-ability assignments. Replacing them with reviewed species data remains future content work.

| Species/form | Given ability | Hidden ability |
| --- | --- | --- |
| Bulbasaur, Ivysaur | Chlorophyll | Technician |
| Squirtle, Wartortle | Torrent | Water Absorb |
| Lapras | Water Absorb | Torrent |
| Geodude | Sand Veil | Tough Claws |
| Pikachu | Static | Technician |
| Meowth | Technician | Tough Claws |
| Vulpix, Ninetales | Flash Fire | Blaze |
| Charmander | Blaze | Flash Fire |
| Mega Charizard | Tough Claws | Blaze |

Ordinary enemies and fresh Battle Lab units use their given ability with the hidden slot locked. This change adds no enemy hidden-ability unlock rule or Battle Lab selector.

## Combat resolution

All current ability families read both active slots through shared helpers. Previews, the pure damage calculator, enemy damage scoring, board matchup cues, inspection, and engine resolution use the same active profile.

- Eligible damage bonuses multiply together. For example, Technician and Tough Claws combine on an eligible contact move.
- Speed modifiers and weather evasion factors multiply across active abilities.
- Absorption checks the given slot first, then hidden; the first matching absorption intercepts the hit once. It prevents damage and secondary effects as before.
- Contact reactions check active slots in order and draw their chances from battle RNG. Chained damage still omits contact reactions and secondary effects.
- Feedback uses the exact ability that triggered, including hidden abilities, for callouts and existing sounds. Multiple eligible damage abilities can each produce feedback for one attack. Simultaneous names form one readable block per Pokémon; multi-target feedback is not truncated to four events.

Ordinary evolution, including Fire Stone use, retains both chosen IDs and the unlock flag. Mega Evolution temporarily uses the Mega form's given ability and, if unlocked, its hidden ability. The owned Pokémon retains its ordinary profile after battle.

## Data and engine contracts

- Species retain `ability` as their default given ID and add required `hiddenAbility`. Catalog validation rejects unknown or duplicate assignments.
- `PartyMon` saves `givenAbility`, `hiddenAbility`, and `hiddenAbilityUnlocked` independently of species defaults.
- Battle `Unit.ability` is the active given ID; optional `Unit.hiddenAbility` exists only when the second passive is active.
- `Run.pendingAbilityChange` saves `monId`, `slot`, and exactly three valid, distinct choices.
- `startAbilityCapsule`, `chooseCapsuleAbility`, and `useAbilityPatch` validate phase, ownership, inventory, slot eligibility, and IDs. Replacement/unlock and consumption commit together.
- Ability items use explicit `abilityUse` metadata and are excluded by `itemCanEquip`.

Main files are `src/content/{abilities,species,items,catalog}.ts`, `src/game/{types,engine,damage,enemyPlanner}.ts`, `src/persistence/save.ts`, `src/ui/{RouteScreen,PartyBuilder,BattleScreen,MovePreview}.tsx`, `src/app/App.tsx`, and the board's absorption preview. The two icons are `public/assets/ui/icons/item-ability-capsule.svg` and `item-ability-patch.svg`.

## Save compatibility

Saves now write **v28** and accept the existing v7–v27 snapshot formats. Older party members receive their species' given and placeholder hidden assignments with the hidden slot locked. Active v27 battles retain their saved ability, action queue, and RNG and can continue. Earlier active battles retain the existing enemy-rank migration back to preparation.

v28 validates both party slots, the boolean unlock flag, and ordinary/Mega battle profiles. Battle held items must be equippable for the unit's ordinary species; compatible Mega Stones remain valid after transformation. Malformed party profiles use the existing recovery path; malformed battles return to preparation. Invalid pending offers are cleared without consuming Bag items. New starting items are granted when a new run is drafted, not on migration of an existing run.

## Checks and remaining content work

The production build and scripted campaign/Battle Lab smoke checks pass. Focused checks in `scripts/ability-overhaul-checks.ts` cover slot eligibility, exactly-once consumption, fixed seeded offers, hidden passive effects and feedback, evolution, Mega profiles, v28 round trips, and active v27 migration. The isolated UI gallery covers item selection, locked/unlocked slots, Patch confirmation, Capsule dismissal/resume, choice application, and desktop/390px layout without modifying the campaign save.

Future decisions are store/event acquisition and prices, reviewed official hidden assignments, and balance tuning for arbitrary Capsule combinations. No new ability definitions were added in this implementation.

## 2026-10-06 implementation gap review

Reviewed item UI, engine transactions, every existing passive family, previews/AI, evolution/Mega, and save migration. Four gaps were corrected:

| Gap | Implemented correction |
| --- | --- |
| Random choices were visible before the debounced save committed, allowing a reload or failed write to lose a revealed reservation. | `src/app/App.tsx` saves new offers immediately and gates choice display/selection on success. `RouteScreen.tsx` hides names while saving or failed, retries the same offer, and allows cancelling only an unrevealed failed reservation. |
| Two ability callouts on one unit overlapped; the board also discarded feedback beyond four queued events. | `src/battle/Board.tsx` groups names per unit and consumes all queued feedback. |
| Battle save validation accepted Bag-only items as held equipment, which battle completion could write back to the party. | `src/persistence/save.ts` applies `itemCanEquip` using the ordinary/base species, including transformed Mega units. |
| Direct engine callers could evolve or teach a TM while a Capsule choice was pending. | Ordinary evolution, evolution-item use, and TM use now reject pending offers. |

Focused regressions cover those engine guards, rejected Bag-only battle equipment, preserved ordinary/Mega equipment, and static rendering of saving/failed/ready dialogs without leaking random names. Production build, campaign/Battle Lab playthrough, save restoration measurements, and whitespace checks passed. The async App save path and Phaser callout grouping were inspected in code; this follow-up did not simulate browser termination or capture a new battle animation. Ordinary Patch use and Capsule confirmation retain the game's general autosave window, so abrupt termination can still undo the latest uncommitted action; a revealed Capsule offer itself is already durable.

Remaining content/testing gaps are shop/reward acquisition beyond the starting test items, official hidden assignments, a Battle Lab slot selector, and player-session balance checks for unrestricted combinations. These remain future work.

## Detailed CSV proposals, 2026-10-15 (design only)

The checked [Abilities CSV](../pokefiles/for%20checking/Abilities.csv) has 314 records. This pass fills `proposed game implementation(detailed)` for the 240 records whose `Game Implementation` was empty. The other 74 records already have game decisions, including the explicit exclusion of Battle Bond; their detailed cells remain empty in this pass. All existing columns, row order, duplicate names, and custom game decisions are retained. A populated proposal is not an implemented or approved ability.

The existing `Game Implementation` notes guide the tactical direction. Examples are Compound Eyes increasing range, Dazzling blocking long-range moves, Intimidate and trapping abilities using five-tile auras, Battery helping the entire team, and Speed Boost triggering on personal turns. The generic older `Proposed` text is not authoritative when it conflicts with those choices. `Exact Description` remains reference information, including mechanics this game does not support.

Each new cell specifies an ability's trigger, recipients, numerical effect, timing, repetition limits, and important exceptions. `ADAPTATION` identifies a suggested tactical substitute for an absent main-series command. `DEPENDENCY` identifies concrete support needed before the ability can become selectable. These are proposals for review, not permission to silently change other existing notes. Technician, Torrent, and Tough Claws already run in the game despite having empty game-note cells; their detailed cells distinguish the current rules from suggested extensions. The remaining 237 target records propose abilities absent from the runtime catalog.

### Verified runtime baseline

The baseline was checked in `src/content/abilities.ts`, `src/game/{types,engine,damage,moveEffects,stages,actionValue,grid,mobility}.ts`, and `src/persistence/save.ts`:

- There are nine runtime ability definitions and two simultaneously active slots. Passive helpers check the given slot before the unlocked hidden slot and remove duplicate IDs. The Capsule currently draws from those nine definitions.
- Existing outgoing ability damage bonuses multiply move power in the shared calculator. Attack/Defense multipliers, changed STAB, critical chance, and final incoming-damage reductions need their own calculation stages; adding every new effect to the current power-bonus list would change its meaning and rounding.
- A personal turn grants 3 AP plus banked AP, permits one Move command costing 1 AP and one Attack command at its listed cost, and can end with Pass. An ability must not accidentally reset either action-use flag or create AP by repeatedly previewing/cancelling a command.
- One global cycle is **10,000 AV**. A normal action interval is `650,000 / effective Speed`; Speed 65 therefore acts once per cycle. All units initially have `nextAction = 0`, so an ability triggered only at battle start must resolve before the initial actor is selected. An authored duration of 100 legacy units means one cycle; 500 means five cycles. Older 2,000-AV examples in `PLAN.md` are stale and are not the timing baseline for these proposals.
- Stageable stats are Attack, Defense, Special Attack, Special Defense, and Speed, capped at -6/+6. The multiplier is `(2 + stage) / 2` at nonnegative stages and `2 / (2 - stage)` at negative stages. The usual expiry is five cycles after application. The current model stores one net stage and one expiry per stat; another change refreshes that stat's timer, rather than creating an independent timed stack. HP and Movement have no stages.
- Range and the proposed radius auras use **Manhattan tile distance**, `abs(dx) + abs(dy)`. Adjacent means the four orthogonal neighbors. Existing rectangular move areas can include diagonals and are a separate shape. Current aiming adds one tile when the source is higher than the aim tile and checks line of sight. A proposal's local aura ignores line of sight unless its cell says otherwise.
- Existing fractional HP effects use `max(1, ceil(maxHp * fraction))`; healing is capped at max HP and cannot revive. Proposal cells follow that convention unless they explicitly specify another rounding rule. Direct damage retains the shared damage calculator's existing rounding.
- Existing weather is clear, sun, rain, snow, or sandstorm. Encounter weather lasts three cycles; currently authored weather moves also set three cycles. Snow is the proposed counterpart for hail-based abilities. There is no independent Electric/Grassy/Misty/Psychic Terrain state yet.
- Current functional status effects are timed Burn and paralysis, plus the Flash Fire charge marker. Party saves do not store persistent major statuses. Sleep, poison/toxic, confusion, infatuation, flinch, freeze, move locks, and accuracy/evasion stages need explicit handlers; a string in `Unit.status` alone does not implement them.
- There is no mid-battle switching, fleeing, ordinary recall/redeployment, gender/weight system, general move-priority system, or natural form-change framework. Existing movement, forced displacement, Mega Evolution, and AV shifts are useful extension points; they do not supply those absent systems automatically.

### Shared rules proposed for the rollout

The following contracts accompany the row proposals. They are not current engine features except where identified above.

1. **Eligibility and state.** Only living deployed units supply ongoing abilities or auras. A faint event may still resolve its explicitly authored on-faint effect from a snapshot of its source. Retain saved given/hidden assignments separately from temporary copied, swapped, replaced, or suppressed effective abilities. Temporary state clears at battle end unless a row explicitly proposes run progression. Same named continuous modifiers/auras do not multiply from repeated sources; distinct named eligible modifiers multiply unless a row specifies a shared cap. Discrete reactions retain each source's authored trigger limits. Dedupe reactions by event ID, affected unit, emitting source, and ability family so replay cannot duplicate a reaction and different sources can still react legitimately.
2. **Timing.** A cycle is global elapsed battle time; a personal turn is that unit's activation. Timed durations use AV deadlines. A proposal that counts own turns needs its own saved counter, rather than a guessed AV duration. Default stage changes use the existing five-cycle net-stage expiry. Speed changes and their expiry immediately rescale waiting action times, including under Trick Room. An AV advance is clamped at the current battle time and never grants another Attack in the action that caused it. Copied actions must be explicitly marked so they cannot recursively copy themselves.
3. **Determinism.** Use battle RNG for combat chances and run RNG for awarded campaign items. Consume randomness only when an eligible event commits, never in previews, target inspection, or enemy scoring. Process tied passive sources in stable battle-unit order and slots given then hidden unless a cell supplies a more specific order. Persist random results or pending transactions where reloads could otherwise reroll them. Randomly selected targets use a specified eligible set and stable ordering before the draw.
4. **Statuses and stages.** Centralize status eligibility, protection, source attribution, application, cure, and reflection. Preserve the current ability for distinct major statuses such as Burn and paralysis to coexist; ordinary poison and bad poison share one mutually exclusive poison state, and an ordinary reapplication cannot downgrade bad poison. Default new major statuses to battle-only until a separate persistent-status design is approved. This default does not reinterpret the existing untouched notes requesting paralysis/poison for the rest of the game. Contrary/Simple transform a requested stage delta before caps; prevention and actual-change reactions must see the final accepted change. Reflected statuses cannot reflect recursively. Specify whether a chance happens per move, per target, or per hit.
5. **Weather and terrain.** Route every consumer through an effective-weather view before enabling Air Lock/Cloud Nine or their interactions with the new proposals: damage, stat defenses, Speed, evasion, weather healing/chip, and move effects. Suppression leaves the stored weather and expiry advancing, consistent with the existing cosmetic-weather notes. Primal weather requires source ownership and overwrite rules; terrain needs its own state, duration, combat-grounded eligibility, renderer, previews, and save validation. The combat-grounded query must include ability overrides such as Levitate independently of physical traversal permissions. Do not represent either field by changing physical ground tiles alone.
6. **Move and item metadata.** Classify new wind, dance, bite, slicing, healing, recoil, explosion, OHKO, multi-hit, priority, protection, and secondary-effect traits explicitly. Do not infer them from a move's name or animation. Make damage provenance distinguish direct hits, chains, ability damage, weather, terrain, status, recoil, and item effects before enabling their prevention/reaction rules. Berry reuse needs consumed-item history and an effect replay that does not duplicate the item or recursively trigger another consumption. The [curated Pickup/Ball Fetch list](../pokefiles/for%20checking/Ability%20Item%20Drop%20Curated%20List%20%28Pickup%2C%20Ball%20Fetch%29.csv) currently contains only its header; author and validate its actual entries and weights before enabling random drops.
7. **Targeting and presentation.** Shared pure queries must supply effective range, typing, STAB, immunity, accuracy, critical chance, damage, grounding, and aura influence to the engine, enemy planner, damage preview, and board. Show the source ability and meaningful duration/charge/once-per-battle state. An unimplemented ability must stay out of species assignments, enemy selection, and Capsule offers even if its description is browsable. Species-dependent form/partner abilities also need compatibility restrictions before unrestricted Capsule selection can expose them.

**Move-type precedence proposal:** first derive a pre-ability move type from the move's authored rules, weather, and held item. Check the given ability, then the hidden ability, for move-type replacement; the first eligible replacement wins, and only that replacement's associated power bonus applies. Normalize always qualifies; a Normal-to-another-type ability qualifies only when that pre-ability type is Normal; Liquid Voice qualifies on explicit sound metadata. Preserve the original catalog type separately for inspection. For example, Normalize given plus Dragonize hidden produces Normal with one 1.2x bonus; Dragonize given plus Normalize hidden produces Dragon with one 1.2x bonus on an initially Normal move. Libero/Protean change the holder's type after the final move type is known and belong to a separate effect channel. This ordering is a proposed rule for this game's dual abilities.

Construct every deployed unit and register all ongoing field modifiers before resolving one-shot deployment effects in stable unit/slot order. Download/Frisk and initial weather effects must not see an accidentally incomplete roster or partially registered continuous aura set.

Copying or swapping an ability can run explicitly authored acquisition hooks, such as reconciling a continuous aura or curing a status that the acquired protection cures. It does not replay deployment-only effects such as an initial Intrepid Sword bonus. Huge Power and Pure Power are proposed to share one nonstacking Attack-doubling family, for a total 2x multiplier if both are active; this is an explicit exception to distinct-name multiplication.

### Resolution phases proposed for new hooks

Keep one committed move transaction, with a bounded event queue for reactions:

1. Derive the effective ability profile and move, including type, category, traits, and range, without mutating catalog definitions. Use that result to validate ownership, AP, Attack use, move locks, target/range/line of sight, and global prohibitions such as Damp. Only a valid committed command spends AP and the Attack action.
2. Resolve target redirection/reflection and determine affected targets in stable order; recheck their legality after redirection. Intercept hostile Status effects for protection/reflection before mutating each recipient, including effects the current engine applies on cast. Apply once-per-cast global weather/field effects once. A blocked/absorbed target does not make the command free.
3. For each direct target, resolve hit chance, target immunity/absorption/protection, permitted critical roll, shared damage modifiers, survival shields, and HP loss. Maintain actual damage and move/source tags in the event snapshot. Immunity and absorption terminate that target's damage/secondary branch; the first eligible interception in slot order wins.
4. Snapshot `hpBefore`, `hpAfter`, actual HP loss, critical result, and damage provenance before threshold healing such as Sitrus Berry can erase evidence of a crossing. Resolve immediate HP-threshold and on-hit reactions in a fixed documented order, with survival checks appropriate to each effect. Use a distinct faint/KO event so on-faint abilities are not lost by the current early return after a lethal hit. Credit a KO once to its direct cause, and drain the bounded reaction queue before final battle-result evaluation. Shield Dust-like secondary prevention must not accidentally suppress a primary move effect or an independent ability reaction.
5. Resolve move completion and one-per-move copied actions/charge consumption. A multi-target move must not spend a single-use offensive charge once per target. Revalidate living sources before queued optional reactions; preserve explicitly allowed on-faint snapshots. A move's completion is separate from the end of a personal turn: resolve own-turn-end hooks only when `endCurrentTurn` runs, since movement, Specials, and Pass may follow an attack. At global cycle boundaries, preserve the current final weather tick at its expiry and define new chip/heal ordering beside the existing sandstorm, Burn, Leftovers, and lava sequence. Resolve time-based hooks once per timestamp/cycle, including after reload.

### Implementation batches and checks proposed

| Batch | Scope | Required evidence before availability |
| --- | --- | --- |
| 1 | Parameterized damage/stat modifiers, critical prevention, typed absorption, weather Speed, and simple contact reactions | Pure queries agree with damage previews and AI; exact threshold/rounding boundaries; both active slots and seeded combat checks. |
| 2 | Central stage/status pipeline, HP thresholds, KO/faint/cycle/turn hooks, local/team auras, range changes, suppression and bypass | Repeated-entry and source-loss checks; lethal/reaction ordering; once-per-event guards; AV rescheduling and Trick Room; immunity/cure/status-duration checks. |
| 3 | Explicit move traits, charges, multi-hit, item consumption/reuse, redirection/reflection/protection | Per-hit versus per-move checks; no reaction/copy/reuse loops; no duplicated Bag/held items; simultaneous targets and seeded replay. |
| 4 | Terrain, primal weather, natural forms, partner compatibility, and row-specific tactical substitutes | Complete form/stat/asset mappings, valid movement and occupied tiles, dependency-specific UI/AI, compatibility-gated species/Capsule pools, and balance sessions. |

Every batch that adds state needs a save-schema decision, active-battle validation/migration, and updates to `cloneBattleForCommand` for new nested objects. Current battle completion copies only HP and held item back to deployed party members; it does not copy temporary abilities, stages, statuses, types, stats, or move sets. Item consumption persists because the held item is copied back. Form/progression proposals must explicitly preserve ordinary species identity, level/rank scaling, chosen abilities, and max-HP rules, rather than relying on temporary battle fields being written to the party.

Acceptance should include event ordering on lethal hits and final enemy KOs, full/half/one-third HP boundaries, zero effective stage changes, range/aura entry and exit, all-source loss/suppression, same- and different-name dual passives, multi-target charge consumption, pending random rewards, save/load at each delayed trigger, and consistent UI/AI forecasts without RNG consumption. These checks are planned implementation gates; this CSV/documentation pass does not claim they have run for unimplemented abilities.

[Capsule dialog preview](ABILITY_OVERHAUL_PREVIEW.jpg) · [Game scope and rules](PLAN.md) · [Game description](GAME_DESCRIPTION.md) · [Pokefile rollout](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md)
