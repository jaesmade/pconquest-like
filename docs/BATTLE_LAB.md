# Battle Lab

Battle Lab is a disposable 1v1 test battle reached from the title screen. It uses a 5×5 square arena with ally deployment in the bottom two rows, enemy deployment in the top two rows, and a neutral middle row. In zero-based grid coordinates, the ally starts at (2, 3) and the opponent at (2, 1). Allies initially face north and enemies face south. You command whichever Pokémon is active, including the opponent. Enemy AI does not act in this mode.

## Setup

Choose each Pokémon's species, level (1–100), and compatible held item, then choose starting weather and a positive numeric seed. Both Pokémon begin at full HP. Each has four equipped moves at the chosen level, favoring its first two species moves and then its most recent level unlocks.

## Inspecting results

- Select **Attack**, hover or focus a move to see its description, then choose it. The board shows range and type effectiveness; click a valid tile to attack. Back returns to move choice without spending AP.
- The **Damage lab** panel shows current HP and AP for both sides, starting seed, weather, noncritical and critical damage ranges for the selected move, and the combat log. Damage ranges use the same pure calculator as the battle engine and do not consume RNG.
- **Replay seed** resets HP, statuses, items, weather, and turn order. With the same choices and command sequence, seeded combat rolls repeat. Animation playback and unique visual event IDs do not affect combat RNG.
- The battle menu returns to setup. Battle Lab state is not written to the campaign save; the current run remains available from **Continue**.

The arena is deliberately plain and flat. Campaign maps remain the place to inspect terrain, elevation, and hazard interactions. The lab is for quick move, item, ability, animation, and damage comparisons.

## Scripted gameplay smoke playthrough

Run `npm run playthrough` locally to exercise a deterministic three-Pokémon draft, first route node, preparation, battle against the solo enemy planner, XP and coin rewards, and return to the route. The script also uses Battle Lab state to check the current effect families: weather, stat stages, displacement, timed cover, Burn, and a Thunder Shock chain against a Ground-type secondary target. It checks that the enemy chooses useful weather and declines to recast it while active. Its player commands use a simple damage-first policy; the script is a rules and progression check, not an assertion that this is optimal play or a rendered UI check. The latest result is recorded in [the project master record](PROJECT_MASTER.md).
