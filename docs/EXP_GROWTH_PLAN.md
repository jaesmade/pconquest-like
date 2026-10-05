# Pokémon experience growth plan

**Status:** Proposal only, 2026-10-03. No runtime behavior has changed.

## Goal

Give each Pokémon a species growth curve so the same battle reward advances different species at different rates. Keep the campaign's existing level-based stats, learn-move levels, participant rules, and level-100 cap. The growth curve controls how much XP is needed to reach a level; it does not directly change stats or multiply the battle reward.

The user's fourth label, “faast,” is ambiguous and repeats “fast” as written. The checked Pokémon reference already contains six source labels, so this plan supports all six and treats the repeated label as a typo rather than inventing a new curve. If the intent is exactly four curves or a custom fourth curve, choose that label before implementation.

## Current behavior and data

- `src/game/engine.ts` uses one shared threshold, `(level - 1) * 65`, for every species. New runs start at level 10; recruits join at the highest party level. A win grants the encounter's fixed 65, 85, or 100 XP to each deployed participant, including one that fainted. Reserves gain none.
- `src/content/species.ts` has no growth-rate field. `PartyMon.xp` stores cumulative XP, and level-ups compare it with `xpForLevel(level)`.
- `src/ui/IntermissionScreen.tsx` derives each card's level bar from that same shared threshold.
- `src/persistence/save.ts` clamps saved XP using the shared curve; saves are schema v26.
- The checked [Pokémon reference CSV](../pokefiles/for%20checking/Pokemon%20Reference.csv) already records the growth rate for each species/form from the pinned PokeAPI data. Among the 11 current ordinary/runtime species, Bulbasaur, Ivysaur, Charmander, Squirtle, Wartortle, and Geodude are Medium Slow; Pikachu, Meowth, Vulpix, and Ninetales are Medium Fast; Lapras is Slow. The temporary Mega form should inherit its base species' rate. None of these 11 is currently Fast, so a Fast curve is ready for later species but assigning it to a current Pokémon would need an intentional override.

## Recommended implementation

1. **Add typed growth-rate data.** Define a `GrowthRate` union for the six labels in the reference CSV: Fast, Medium Fast, Medium Slow, Slow, Slow Then Very Fast, and Fast Then Very Slow. Add a required `growthRate` field to `Species`, map each playable species to its reference row, and preserve the base species' rate for temporary battle forms. Ordinary evolution families must share a rate unless a future migration explicitly handles a change.
2. **Centralize level thresholds.** Add a pure `xpForLevel(speciesId, level)` (or growth-rate equivalent) that returns cumulative XP required to be at that level. Build and validate integer threshold tables from the canonical curves through level 100, with level 1 at zero, monotonic thresholds, and an explicit cap. Check those values against the pinned PokeAPI growth-rate data; do not approximate the named curves with arbitrary multipliers.
3. **Keep the award rule simple.** Continue granting each eligible participant the same raw encounter XP. Fast-growing species reach thresholds sooner; slower curves need more XP. Reserves receive no battle XP and keep their existing XP; level 100 gains no XP beyond its cap. `newRun`, recruitment, level-up resolution, and any species creation must initialize XP to that species' threshold for its current level.
4. **Update every threshold consumer.** Use the species-aware lookup in `completeBattle`, recruitment/new-run initialization, save validation/migration, and the XP screen's starting level, progress bar, and next-level total. Show the growth label on the XP card so players can understand why progress differs even when raw XP awards match.
5. **Migrate saved runs.** Bump the save schema from v26 to the next available version (v27 if no other migration ships). Preserve each party member's current level and fraction of progress within that level: measure the fraction between the old shared thresholds at the saved level, then apply that fraction between the new species-specific thresholds. At level 100, clamp to the new level-100 total. This avoids resetting runs or granting/erasing a whole level when the scale changes. No active-battle restart is needed because the growth curve does not alter battle stats or saved unit state.
6. **Retune campaign XP after measuring it.** Canonical cumulative curves are much larger and become steeper than the current linear 65-XP-per-level scale. Keeping current 65/85/100 awards unchanged would make later level-ups increasingly rare. Use the current level-10 start, ten-column route, move unlocks around levels 11–14, and level-21 boss as the baseline; adjust authored encounter XP values until a normal route still reaches an appropriate boss-level band. Record the chosen rewards in the balance guide after that pass.

## Files to change when implementation is approved

| Area | Main files | Change |
| --- | --- | --- |
| Growth data and validation | `src/game/types.ts`, `src/content/species.ts`, `src/content/catalog.ts` | Add valid growth-rate IDs, species assignments, and checks for known rates and compatible evolution links. |
| XP rules | `src/game/engine.ts` or a focused `src/game/experience.ts` | Add per-curve thresholds; route all level checks and XP initialization through them. |
| Saves | `src/persistence/save.ts` | Bump to the next available schema and preserve level/progress when converting old XP totals. |
| Reward UI | `src/ui/IntermissionScreen.tsx` | Calculate per-species level bars and display the growth rate. |
| Content/balance record | `src/content/encounters.ts`, `docs/BALANCE.md` | Tune encounter XP only after comparing a full route against the current progression baseline. |

## Checks for the implementation task

- Compare all six threshold tables, including level 1, levels around curve breakpoints, and level 100, with the pinned source data; reject unknown growth-rate labels at catalog validation.
- Check that every current runtime species has a source-backed rate, ordinary evolution links preserve its rate, and the Mega battle form does not change its owner's XP curve.
- Check one level-up just below, exactly at, and above a threshold for each curve; check multi-level awards, recruitment, the level-100 cap, and XP-screen progress for deployed and reserve Pokémon.
- Load schema-v26 and older saves at several levels and progress fractions, then confirm migration preserves level, approximate bar progress, HP, learned moves, and the rest of the run.
- Run a representative ten-column campaign with typical route choices and compare level-up timing and boss readiness with `docs/BALANCE.md` before finalizing encounter XP rewards.

## Open decision

Does “faast” mean “fast” again, or did you intend a separate fourth category such as Slow? The implementation can support all six source curves either way; choosing a Fast-rated current Pokémon is a separate species-balance decision because none of the current 11 ordinary/runtime species has that source rate.
