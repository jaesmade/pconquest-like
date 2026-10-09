# Ability overhaul

**Status:** Implemented on 2026-10-06. Pokémon have a given ability and a hidden slot; an Ability Patch unlocks the hidden passive, and an Ability Capsule replaces either eligible slot. Hidden assignments currently reuse existing runtime abilities as temporary game-specific choices.

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

[Capsule dialog preview](ABILITY_OVERHAUL_PREVIEW.jpg) · [Game scope and rules](PLAN.md) · [Game description](GAME_DESCRIPTION.md) · [Pokefile rollout](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md)
