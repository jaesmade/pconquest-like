# Pokémon experience growth and battle reward plan

**Status:** Proposal only, updated 2026-10-06. Neither the species growth curves nor the battle reward formulas below are implemented.

## Goal

Give each Pokémon a species growth curve so the same battle reward advances different species at different rates. Separately, replace flat per-participant battle rewards with enemy contributions divided among deployed participants: more enemies increase the reward, and more participants reduce each Pokémon's share. Keep the campaign's existing level-based stats, learn-move levels, fainted-participant eligibility, reserve exclusion, and level-100 cap. The growth curve controls how much XP is needed to reach a level; it does not directly change stats or multiply the battle reward.

The user's fourth label, “faast,” is ambiguous and repeats “fast” as written. The checked Pokémon reference already contains six source labels, so this plan supports all six and treats the repeated label as a typo rather than inventing a new curve. If the intent is exactly four curves or a custom fourth curve, choose that label before implementation.

## Current behavior and data

- `src/game/engine.ts` uses one shared threshold, `(level - 1) * 65`, for every species. New runs start at level 10; recruits join at the highest party level. A win grants the encounter's fixed 65, 85, or 100 XP to each deployed participant, including one that fainted. Reserves gain none.
- `src/content/species.ts` has no growth-rate field. `PartyMon.xp` stores cumulative XP, and level-ups compare it with `xpForLevel(level)`.
- `src/ui/IntermissionScreen.tsx` derives each card's level bar from that same shared threshold.
- `src/persistence/save.ts` clamps saved XP using the shared curve; saves are schema v27.
- The checked [Pokémon reference CSV](../pokefiles/for%20checking/Pokemon%20Reference.csv) already records the growth rate for each species/form from the pinned PokeAPI data. Among the 11 current ordinary/runtime species, Bulbasaur, Ivysaur, Charmander, Squirtle, Wartortle, and Geodude are Medium Slow; Pikachu, Meowth, Vulpix, and Ninetales are Medium Fast; Lapras is Slow. The temporary Mega form should inherit its base species' rate. None of these 11 is currently Fast, so a Fast curve is ready for later species but assigning it to a current Pokémon would need an intentional override.

## Proposed battle reward formulas

### Simple shared pool

For a victorious battle, let `E` be the number of defeated enemies and `P` the number of distinct deployed player Pokémon. Start with:

```text
XP_each = floor(65 × E / P)
```

The constant 65 is a campaign tuning value, not a canonical Pokémon EXP yield. It preserves the opening battle's current 65 XP per Pokémon when three participants defeat three enemies. Each extra enemy contributes another 65 XP to the shared pool. Division preserves the pool before rounding; equal integer awards discard a remainder smaller than `P`.

| Defeated normal enemies | 1 participant | 3 participants | 6 participants |
| ---: | ---: | ---: | ---: |
| 3 | 195 XP | 65 XP | 32 XP |
| 5 | 325 XP | 108 XP | 54 XP |
| 8 | 520 XP | 173 XP | 86 XP |

### Recommended starting variant: rank-weighted pool

Account for this game's stronger ranked enemies without multiplying reward by every combat-stat bonus:

```text
pool = 65 × (normalCount + 1.5 × eliteCount + 2 × bossCount)
XP_each = floor(pool / P)
```

Normal, Elite, and Boss contributions are provisionally 1×, 1.5×, and 2×. These XP weights are intentionally gentler than the implemented 1×/2×/3× combat-stat multipliers and still need playtesting. Three participants defeating three Normals and one Elite each earn 97 XP. Against the current level-21 boss roster of five Normals, two Elites, and one Boss, three participants each earn 216 XP, or six each earn 108 XP. This replaces the fixed 65/85/100 encounter reward; do not add those old rewards or another encounter-tier multiplier on top.

### Closer to the older Pokémon reward calculation

[Emerald's reconstructed EXP calculation](https://github.com/pret/pokeemerald/blob/master/src/battle_script_commands.c#L3112-L3149) derives each defeated enemy's reward from its species EXP yield and level, then divides among eligible participants when there is no Exp. Share. Its basic term is `baseExpYield × enemyLevel / 7`; its additional held-item and Trainer rules are outside this simplified proposal. A game adaptation would be:

```text
XP_each = floor(K / P × sum(baseExpYield_e × enemyLevel_e / 7 × rankWeight_e))
```

`K` is a global pacing constant, and the sum includes every defeated enemy. The rank weights are custom to this game. Species EXP yield belongs to the defeated enemy and is distinct from the recipient's growth curve. The current `Species` type has neither field, and the checked Pokémon reference CSV's `exp gain` column records growth labels, not numeric defeat yields. This variant therefore needs separately sourced numeric yield data before implementation. Emerald excludes fainted recipients; the proposed adaptation retains this game's existing fainted-participant eligibility.

While the runtime still needs only 65 XP for every level, multiplying rewards directly by increasing enemy levels can accelerate progression sharply. Start with the rank-weighted pool; revisit species yields and `K` alongside the proposed growth curves.

### Optional catch-up modifier

For mixed-level teams, a bounded custom level-gap modifier can help weaker participants catch up without unbounded enemy-level rewards:

```text
gap_i = clamp((meanEnemyLevel + 10) / (participantStartLevel_i + 10), 0.5, 1.5)
XP_i = floor(pool / P × gap_i)
```

Use levels captured at battle start and calculate the award once, before processing any level-ups. This modifier gives individual awards and no longer conserves a fixed total pool across mixed-level teams. It is optional and changes the opening calibration: level-10 participants fighting level-9 enemies receive 61 XP each instead of 65 under the simple three-versus-three baseline. The ratio and bounds are proposed game tuning, not the exact mainline level-scaling formula.

### Gentler alternative to strict sharing

If strict sharing makes bringing six Pokémon too costly, soften only the participant penalty:

```text
weightedEnemies = normalCount + 1.5 × eliteCount + 2 × bossCount
XP_each = floor(65 × weightedEnemies / 3 × (3 / P)^0.75)
```

This retains the three-participant baseline and still reduces individual XP as participants increase. Three normal enemies give 148/65/38 XP per Pokémon with one/three/six participants. Total party XP increases with party size, so this is a deliberate team incentive rather than a fixed shared pool.

### Eligibility, progression, and implementation notes

- Count distinct deployed participants, including fainted battlers. Use the completed battle's player `partyId` values rather than the owned roster of up to 20. Reserves earn zero and do not increase `P`; support Pokémon qualify without landing an attack or a finishing blow.
- Award only after victory, including completion of the boss capture objective. Count defeated enemy units retained in the battle snapshot; counting only surviving enemies at victory would return zero. No summons or repeat-defeat rewards are proposed.
- Keep level-100 participants in `P`, cap their stored XP, and do not redistribute their unused share. A valid victory must have `P >= 1`.
- Strict sharing encourages solo training: the opening fight gives a solo participant 195 XP, enough for three levels under the current linear curve. Recruitment currently copies the highest owned level, which amplifies this benefit. Compare one-, three-, and six-participant route progression and late recruits before selecting a final formula. The boss example also raises the three-participant reward from 100 to 216 XP; preserving the opening reward does not preserve the whole route's pacing.
- If implemented, retain an explicit reward breakdown with pre-award XP/level and actual capped gain for every participant. `IntermissionScreen.tsx` currently reconstructs progress by subtracting one flat encounter reward; that assumption fails for variable awards and capped gains. Save any new intermission reward state so refresh preserves the report; use the next available schema where necessary.
- The growth-curve work below can be implemented independently. Replacing only the reward formula does not require converting existing cumulative XP while the 65-XP level thresholds stay unchanged.

## Recommended growth-curve implementation

1. **Add typed growth-rate data.** Define a `GrowthRate` union for the six labels in the reference CSV: Fast, Medium Fast, Medium Slow, Slow, Slow Then Very Fast, and Fast Then Very Slow. Add a required `growthRate` field to `Species`, map each playable species to its reference row, and preserve the base species' rate for temporary battle forms. Ordinary evolution families must share a rate unless a future migration explicitly handles a change.
2. **Centralize level thresholds.** Add a pure `xpForLevel(speciesId, level)` (or growth-rate equivalent) that returns cumulative XP required to be at that level. Build and validate integer threshold tables from the canonical curves through level 100, with level 1 at zero, monotonic thresholds, and an explicit cap. Check those values against the pinned PokeAPI growth-rate data; do not approximate the named curves with arbitrary multipliers.
3. **Keep growth and rewards separate.** Use the selected battle reward formula above for eligible participants. Growth rate alone must not multiply the award: fast-growing species reach thresholds sooner, and slower curves need more XP. Reserves receive no battle XP and keep their existing XP; level 100 gains no XP beyond its cap. `newRun`, recruitment, level-up resolution, and any species creation must initialize XP to that species' threshold for its current level.
4. **Update every threshold consumer.** Use the species-aware lookup in `completeBattle`, recruitment/new-run initialization, save validation/migration, and the XP screen's starting level, progress bar, and next-level total. Show the growth label on the XP card so players can understand why progress differs even when raw XP awards match.
5. **Migrate saved runs.** Bump the save schema from v27 to the next available version (v28 if no other migration ships). Preserve each party member's current level and fraction of progress within that level: measure the fraction between the old shared thresholds at the saved level, then apply that fraction between the new species-specific thresholds. At level 100, clamp to the new level-100 total. This avoids resetting runs or granting/erasing a whole level when the scale changes. No active-battle restart is needed because the growth curve does not alter battle stats or saved unit state.
6. **Retune campaign XP after measuring it.** Canonical cumulative curves are much larger and become steeper than the current linear 65-XP-per-level scale. Keeping current 65/85/100 awards or the provisional shared-pool constant unchanged would make later level-ups increasingly rare. Use the current level-10 start, ten-column route, move unlocks around levels 11–14, and level-21 boss as the baseline; tune the chosen reward formula and rank weights until a normal route still reaches an appropriate boss-level band. Record the chosen rewards in the balance guide after that pass.

## Files to change when implementation is approved

| Area | Main files | Change |
| --- | --- | --- |
| Growth data and validation | `src/game/types.ts`, `src/content/species.ts`, `src/content/catalog.ts` | Add valid growth-rate IDs, species assignments, and checks for known rates and compatible evolution links. |
| XP rules | `src/game/engine.ts` or a focused `src/game/experience.ts` | Add per-curve thresholds; route all level checks and XP initialization through them. |
| Saves | `src/persistence/save.ts` | Bump to the next available schema and preserve level/progress when converting old XP totals. |
| Reward UI | `src/ui/IntermissionScreen.tsx` | Calculate per-species level bars, display the growth rate, and consume explicit individual battle awards. |
| Content/balance record | `src/content/encounters.ts`, `docs/BALANCE.md` | Replace flat encounter rewards if sharing is implemented; tune enemy contributions only after comparing a full route against the current progression baseline. |

## Checks for the implementation task

- Compare all six threshold tables, including level 1, levels around curve breakpoints, and level 100, with the pinned source data; reject unknown growth-rate labels at catalog validation.
- Check that every current runtime species has a source-backed rate, ordinary evolution links preserve its rate, and the Mega battle form does not change its owner's XP curve.
- Check one level-up just below, exactly at, and above a threshold for each curve; check multi-level awards, recruitment, the level-100 cap, and XP-screen progress for deployed and reserve Pokémon.
- Load schema-v27 and older saves at several levels and progress fractions, then confirm migration preserves level, approximate bar progress, HP, learned moves, and the rest of the run.
- Check the selected reward formula with one, three, and six participants; three, five, and eight enemies; mixed ranks; fainted participants; reserves; level caps; losses; and an incomplete boss objective. If a catch-up modifier is enabled, check mixed levels and fixed pre-award levels. Verify saved intermission awards and UI totals match actual XP changes.
- Run a representative ten-column campaign with typical route choices and compare level-up timing and boss readiness with `docs/BALANCE.md` before finalizing encounter XP rewards.

## Open decision

Does “faast” mean “fast” again, or did you intend a separate fourth category such as Slow? The implementation can support all six source curves either way; choosing a Fast-rated current Pokémon is a separate species-balance decision because none of the current 11 ordinary/runtime species has that source rate.
