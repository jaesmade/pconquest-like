# Early-run balance baseline

The early run uses the standard-style damage calculation in `src/game/damage.ts` and derives HP, Attack, Defense, Special Attack, Special Defense, and Speed from base values and level. Movement remains a fixed species tile range. Damage rules, the 1-in-24 critical chance, type chart, weather, abilities, and one Attack command per turn remain unchanged. The former encounter balance baseline predates this stat change and needs fresh play data.

## Current curve

| Encounter | Player level when entering after normal XP | Enemy level | Pressure |
| --- | ---: | ---: | --- |
| Verdant Crossing | 10 | 9 | First battle; neutral targets and no Ground immunity wall |
| Cinder Ford | 11 | 11 | Sun and mixed type coverage |
| Storm Ridge | 12 | 12 | Rain, Water Absorb, and tougher terrain |
| Crown Citadel | 13 | 14 | Sandstorm and capture objective |

Each encounter awards 65 XP to every owned Pokémon, enough for one level under the current `xpForLevel` curve. New runs begin at level 10. Recruits arrive at the highest level already in the party, so a late recruit is useful immediately. Bulbasaur and Squirtle can evolve at level 12, after the second encounter. Early learned moves unlock at levels 11–13 rather than being granted immediately at level 10.

At level `L`, HP is `floor(2 × base HP × L / 100) + L + 10`; Attack, Defense, Special Attack, Special Defense, and Speed are each `floor(2 × base stat × L / 100) + 5`. Movement stays at its species tile-range value at every level. At level 10 the current base HP span of 52–78 becomes 30–35 HP. Basic damaging moves have 42–50 power; Thunderbolt is the 75-power, 4-AP area move. With equal attacking and defending stats, a 50-power STAB attack at level 10 deals 9–12 neutral damage or 18–24 damage on a 2× target before weather, abilities, or critical hits. These numbers imply much shorter fights than the prior HP curve. Speed increases with level and changes AP gain; Movement does not.

The first enemy trio is Meowth, Vulpix, and Squirtle. It offers multiple type answers without opening with Geodude's Electric immunity and high physical Defense. Later encounters retain stronger coverage and weather pressure. No opponent is given a hidden damage bonus.

Unused AP now banks in full within each battle, for either side. A unit adds its Speed-based gain when it next acts; the one-Attack-per-turn limit still applies. This changes the value of passing early, so future balance reviews should record banked AP and whether delayed movement or item use changes encounter outcomes.

## Save behavior

Schema v12 keeps the v11 HP rescaling for older saves. A v11 battle resumes with each unit's Movement restored from its species record; battles saved before v11 return to preparation because their other stats used the older formula. Versions before v9 also retain their earlier level and XP migration. Current and recovery copies remain in IndexedDB.

## Next tuning evidence

This is a data pass, not a claim of final difficulty. When play sessions are requested, record win rate by starter and companion set, rounds and elapsed time per encounter, damage taken, fainted allies, chosen recruit/rest routes, and how often a move or item is selected. Look especially at Lapras under snow/rain, Pikachu's 2×2 Thunderbolt, and the sandstorm boss. Tune encounter data and move power from those observations before changing the damage formula.
