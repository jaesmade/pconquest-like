# Early-run balance baseline

The early run is tuned around the standard-style calculation in `src/game/damage.ts`. Damage rules, the 1-in-24 critical chance, type chart, weather, abilities, one Attack command per turn, and Speed-to-AP conversion remain unchanged. Content values supply the pacing.

## Current curve

| Encounter | Player level when entering after normal XP | Enemy level | Pressure |
| --- | ---: | ---: | --- |
| Verdant Crossing | 10 | 9 | First battle; neutral targets and no Ground immunity wall |
| Cinder Ford | 11 | 11 | Sun and mixed type coverage |
| Storm Ridge | 12 | 12 | Rain, Water Absorb, and tougher terrain |
| Crown Citadel | 13 | 14 | Sandstorm and capture objective |

Each encounter awards 65 XP to every owned Pokémon, enough for one level under the current `xpForLevel` curve. New runs begin at level 10. Recruits arrive at the highest level already in the party, so a late recruit is useful immediately. Bulbasaur and Squirtle can evolve at level 12, after the second encounter. Early learned moves unlock at levels 11–13 rather than being granted immediately at level 10.

Base HP is lower than in the pre-v9 content. HP and offensive/defensive stats still share the same 7% per-level scaling, preserving approximately stable hit counts as level rises. At level 10 the current base HP span of 52–78 becomes roughly 81–122 HP. Basic damaging moves have 42–50 power; Thunderbolt is the 75-power, 4-AP area move. For a level-10 attacker with equal attacking and defending stats, a 50-power STAB attack deals 9–12 neutral damage or 18–24 damage on a 2× target before weather, abilities, or critical hits. This example uses the real damage rounding order and 85–100 random range; individual matchups vary by stats and effects.

The first enemy trio is Meowth, Vulpix, and Squirtle. It offers multiple type answers without opening with Geodude's Electric immunity and high physical Defense. Later encounters retain stronger coverage and weather pressure. No opponent is given a hidden damage bonus.

Unused AP now banks in full within each battle, for either side. A unit adds its Speed-based gain when it next acts; the one-Attack-per-turn limit still applies. This changes the value of passing early, so future balance reviews should record banked AP and whether delayed movement or item use changes encounter outcomes.

## Save behavior

Schema v9 migrates older parties from the previous level-2 starting curve by adding eight levels, preserving progress within a level and each Pokémon's HP percentage using frozen old HP bases. An older active battle returns to preparation; this prevents a pre-balance battle snapshot from mixing old unit stats with new move content. New v9 battles and run saves use the updated values. The current and recovery copies remain in IndexedDB.

## Next tuning evidence

This is a data pass, not a claim of final difficulty. When play sessions are requested, record win rate by starter and companion set, rounds and elapsed time per encounter, damage taken, fainted allies, chosen recruit/rest routes, and how often a move or item is selected. Look especially at Lapras under snow/rain, Pikachu's 2×2 Thunderbolt, and the sandstorm boss. Tune encounter data and move power from those observations before changing the damage formula.
