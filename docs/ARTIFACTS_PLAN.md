# Run-wide artifacts plan

## Status

This document records a proposed system. Artifacts are not implemented, and the sample effects below are design examples rather than final balance values.

## Core design

Artifacts are powerful modifiers attached to the current run. They are acquired and displayed separately from the Pokémon roster, the Bag, Technical Machines, and Pokémon-held items. They do not occupy a Pokémon's held-item slot. An acquired artifact is intended to affect the run globally and remain active for the rest of that run; a run reset clears the collection.

The planned catalog has a hard maximum of **20 unique artifact definitions**:

| Category | Maximum definitions | Intent |
| --- | ---: | --- |
| Standard | 10 | Beneficial run-wide effects. |
| Cursed | 10 | Powerful or unusual effects with a meaningful drawback or condition. |

Each artifact belongs to one of five rarity tiers: **common, uncommon, rare, epic,** or **legendary**. Apply a rarity to every artifact when the catalog is authored. Legendary artifacts may only be acquired from question-mark event nodes (the current `special` route nodes). The distribution and odds for the other tiers, and whether those nodes offer a choice or a single reward, remain to be designed.

Artifacts can affect any part of a run: XP, battle stats and damage, team condition between battles, coins, or route choices. Their screen copy must make global scope, timing, conditions, and any curse cost clear before the player accepts one. The active collection should be visible from the route and available for review before battles.

## Sample artifact concepts

These examples establish the intended range of effects. Their rarity assignments and exact numbers are not final.

| Category | Sample | Proposed rule and design note |
| --- | --- | --- |
| Standard | Exp Share | The sample grants XP to nonparticipants and increases that XP by 1.1×. The current game awards encounter XP only to deployed participants, so sharing XP with reserves would have a distinct effect. Whether the 1.1× multiplier should apply only to shared reserve XP remains a balance decision. |
| Standard | Eevee Plush | If every Pokémon selected for deployment is Eevee or an Eeveelution when battle starts, multiply each deployed ally's Attack, Defense, Special Attack, Special Defense, and Speed by 2 for that battle. This is a separate modifier from stat-stage changes; HP is not increased. |
| Standard | Pokéblocks | After each battle, restore up to 50% of maximum HP to Pokémon in the run roster, including reserves. Confirm whether this means 50% of maximum HP or half of missing HP, and whether it can revive a fainted Pokémon. |
| Standard | Coin Case | For each 100 coins held, grant a 10% damage bonus and a 10% damage-resistance bonus, with no artifact-side scaling cap. Define the exact damage formulas and minimum damage rule before implementation so resistance above 100% cannot produce unintended healing or negative damage. |
| Cursed | Odd Keystone | After battle, if the owned run roster contains no Ghost-type Pokémon, the roster loses 50% HP. “Team” here means all owned Pokémon, not just the battle deployment. Define whether the loss is half of current HP or maximum HP and how rounding works. |
| Cursed | Magma Stone | At the start of battle, Burn the entire deployed player team. This treats “team” as the selected battle lineup; confirm whether reserves should be affected before implementation. |

## Acquisition, state, and UI plan

- Store artifact ownership in a dedicated run artifact collection, separate from `Run.bag` and each `PartyMon.item`. Artifact names should use stable content IDs.
- Resolve an artifact offer when its route reward is entered, save the offer and result with the run, and prevent refreshes from rerolling or claiming it twice. Legendary eligibility must be checked against a question-mark event node in the game rules, not only hidden from other screens.
- Show category, rarity, full effect, activation timing, affected group, and downside in the offer and collection views. Make the active effects inspectable on the route screen and in battle preparation.
- The route selector has a temporary Artifact Bag entry point that opens a “coming soon” window. It does not display an inventory or apply effects; replace this placeholder when artifact collection is implemented.
- Apply effects through explicit run, between-battle, or battle-start rules. Specify whether multiple copies are allowed and how identical or interacting effects stack before content is added.
- Extend save validation and migration when this plan is implemented so existing runs load with an empty artifact collection and active offers survive a refresh.

## Decisions before implementation

1. Assign a rarity to each of the maximum 20 entries and define acquisition odds and non-legendary sources.
2. Decide how many artifacts a run can acquire, whether duplicates are possible, and whether an artifact can be removed or replaced.
3. Set the effect timing and stacking rule for each artifact, including whether effects apply to all owned Pokémon or only deployed Pokémon.
4. Resolve the example-specific ambiguities recorded above, especially how Exp Share extends XP to reserves and applies its proposed bonus, plus Pokéblocks' revive behavior, Coin Case's resistance formula, and Odd Keystone's HP-loss basis.
5. Define how cursed artifacts are offered and accepted so the downside is visible and the choice is intentional.

## Implementation outline

1. Add a typed artifact catalog with stable IDs, the 10-per-category cap, category, rarity, display text, and authored effect data.
2. Add separate collection and pending-offer state to the run save, with migration from existing saves.
3. Add artifact rewards to route/event flow and validate legendary rewards against question-mark nodes.
4. Implement and resolve each effect at its specified game lifecycle point; add focused rule coverage for stacking, party scope, and save/reload behavior.
5. Add artifact offer, collection, route summary, and battle-preparation UI plus matching visual assets.
6. Tune rarity weights and effect values from complete-run play data.
