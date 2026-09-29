# Pokémon Tactics Roguelike — Early Build Plan

## Goal

Build a playable browser prototype of a Pokémon fan game inspired by the tactical battles of Pokémon Conquest and the replayable routes of a roguelike. The player commands several Pokémon on a tile grid, wins short battles, chooses a route, recruits teammates, and faces a final battle. The early build should establish whether positioning, type matchups, and team composition are fun before adding a large roster.

For the current level, HP, move-power, and encounter tuning, see [the early-run balance baseline](BALANCE.md).

## First playable run

1. Build a starting roster from the available starter and recruit species using six party points. Most Pokémon cost two points, so the default budget buys three. A run can own up to 20 Pokémon total; choose up to six to deploy before each battle.
2. Choose a path through a branching route with ten columns; the boss is always in column ten. See the [route and deployment overhaul](ROUTE_OVERHAUL.md).
3. Before each battle, choose up to six available Pokémon from the run roster and place them on the isometric map. Normal battles, elite battles, full-party healing, stores, and simple special encounters appear along the route.
4. After each encounter, give XP to every Pokémon in the run party, offer any eligible evolutions, and teach moves unlocked by their new levels before the next encounter.
5. Fight the column-ten boss encounter with a distinct map and capture objective.
6. See a win or loss screen. Save an unlock that changes a future run.

Target run length for the ten-column route needs play-session measurement.

## Early build scope

| Area                 | Initial target                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Battle size          | Up to six player Pokémon on an 8×8 square grid; elite and boss enemies can field more than three                                     |
| Run party            | Up to 20 Pokémon; choose up to six to deploy before each solo battle; starting roster drafted from six points                       |
| Maps                 | Three regular map templates and one boss map, reused by route nodes                                                                  |
| Roster               | Six named starting Pokémon and at least two recruitable Pokémon, including a Fire user and a Mega-compatible species                |
| Types in encounters  | Normal, Fire, Water, Grass, Electric, Ground, Rock, and Ice                                                                         |
| Moves                | A growing pool of learned moves, with four equipped for battle, one passive ability, and a 1-in-24 critical chance on damaging moves |
| Growth               | Shared encounter XP for the whole run party, level-based move learning, and at least one evolution available during a run           |
| Held items           | One slot per Pokémon; Leftovers, Sitrus Berry, Assault Vest, X Attack, and one compatible Mega Stone                                |
| Battle animation     | Replaceable four-direction pixel sheets for idle, move, attack, hurt, buff, debuff, special, and faint states                         |
| Terrain              | Elevation, deep water, and lava hazards                                                                                             |
| Weather              | Sun, rain, snow, and sandstorm                                                                                                      |
| Encounter objectives | Defeat all opponents; boss battle adds a capture point                                                                              |
| Route nodes          | Ten columns: battle, elite battle, full heal, store, special, and a column-ten boss                                                  |
| Persistence          | Local browser save for settings and unlocks                                                                                         |
| Controls             | Mouse or touch selection; keyboard shortcuts can follow                                                                             |

The rules and content format should accept all 18 Pokémon types even though the first roster is small. The two recruitable Pokémon beyond the named starters need final species choices. Later roster additions should be content work rather than a combat rewrite.

For future implementation, use stable content IDs, authored encounter definitions, map-defined spawns, a versioned save, and a battle renderer that reads map dimensions. See [the extension guide](SCALING.md) for the current code layout and the steps needed when adding content or new rule families.

## Battle rules

- Battles use a continuous Action Value (AV) timeline. Every deployed unit starts with `nextAction = 0`; the living unit with the smallest `nextAction` acts next, with equal values broken by the run's seeded random stream. The battle clock advances to that value before the unit acts. Fainted Pokémon leave future orders.
- Effective Speed is the unit's current Speed after abilities and timed effects. Its next turn is scheduled at `current time + 10,000 / effective Speed`. If Speed changes while a unit waits, the remaining AV is rescaled in proportion to the new interval, preserving the progress it already made. Action-advance effects lower the next-action time of a waiting target or reduce the current actor's next scheduled AV; delay effects raise it.
- A battle cycle is 2,000 AV, matching one turn interval at Speed 5, near the current roster's typical level-10 Speed. Faster units may act more than once in a cycle, with breakpoints based on how many intervals fit. Weather, burn, lava, and periodic healing resolve at cycle boundaries. Existing effect durations remain authored in the old 100-time-unit scale, where 100 means one cycle, and are converted to AV by the engine.
- At the start of its turn a Pokémon gains exactly 3 Action Points (AP), added to any AP banked from earlier turns in that battle. Speed controls how soon the next turn arrives; Movement controls the maximum number of tiles in a Move command.
- **Move** costs exactly 1 AP per command, regardless of the route's length, terrain, or elevation, and can be used once per turn. **Attack** can be used once per turn; a chosen move, including a Status move, is that attack and spends its listed AP cost. **Special** remains available while enough AP remains. **Pass** ends the turn and banks all unused AP for that Pokémon's next turn in the same battle. The next turn adds 3 AP to the bank. Banking does not grant extra Move or Attack commands in a turn, and AP resets between encounters. The turn also ends when AP reaches zero or the Pokémon faints.
- A Move command can cover up to the Pokémon's Movement stat in tiles. Hazards resolve on every entered tile, but path length and terrain do not change its 1 AP cost.
- A unit cannot move through occupied or blocked tiles. Terrain and elevation can restrict traversability, while hazards still affect units entering their tiles.
- Selecting an equipped move highlights its range on the grid before a target is chosen. Targets that can be hit show their combined type effectiveness in both color and text; the move panel lists each reachable enemy's matchup. Selecting a target tile adds the affected area, hit chance, normal and critical damage, and the 1-in-24 critical chance before confirmation.
- A wall, tree, or rock tile cannot be selected as an attack's aim point. For damaging area moves, each defender in the area must also have clear line of sight from the attacker; the area preview and enemy AI use this same rule. Solid cover blocks damage to a defender behind it even when another area tile is visible. Non-damaging area effects still use their authored area after a valid aim point is chosen.
- A fainted Pokémon leaves the grid and remains unavailable until healed or revived at a route node.
- A regular battle ends when one side has no usable deployed Pokémon. If all deployed player Pokémon faint, the battle and run are lost even if healthy reserves remain. The boss battle requires the boss to faint and a player Pokémon to occupy the capture point.

### Run party and deployment

The run party holds at most 20 Pokémon total, including deployed members and reserves. Build the initial roster with six points; species cost two by default, with optional per-species overrides in content. Before each encounter, show the full roster and let the player select up to six with current HP above zero. They may enter with fewer than six; if none are available for a battle, the run ends. Place the selected Pokémon on the rendered isometric map in the ally zone. Reserves take no turns or terrain and weather damage. There is no midbattle swapping in the early build.

On the top-down deployment grid, allies choose starting tiles in the bottom two rows and enemies use the top two rows. The center four rows are neutral on the initial 8×8 campaign maps. Default allies enter from the bottom edge facing north; default enemies enter from the top edge facing south. Each team may reposition within its own zone before battle when deployment selection is available.

Current HP, fainted state, level, XP, evolution stage, learned and equipped moves, and held item persist between encounters. Special-node recruitment adds a Pokémon while the roster has fewer than 20 members. At capacity, the recruit choice is disabled. Save both the roster and selected deployment with the run so the next battle can show the previous selection by default.

### Pokémon stats

| Stat            | Purpose                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| HP              | Total health when the Pokémon starts at full health. Track current HP separately as it takes damage or heals.     |
| Attack          | Offensive stat used to calculate Physical move damage.                                                            |
| Defense         | Defensive stat used to calculate damage received from Physical moves.                                             |
| Special Attack  | Offensive stat used to calculate Special move damage.                                                             |
| Special Defense | Defensive stat used to calculate damage received from Special moves.                                              |
| Speed           | Sets turn interval: `AV = 10,000 / effective Speed`. Lower AV acts sooner; equal-time ties are randomized. |
| Movement        | Determines the maximum number of tiles the Pokémon can move in one Move command. Each Move command costs 1 AP regardless of route length.                              |

At level `L`, calculate integer combat stats from the species' base values using `HP = floor(2 × base HP × L / 100) + L + 10` and `Attack, Defense, Special Attack, Special Defense, and Speed = floor(2 × base stat × L / 100) + 5`. Movement is a fixed tile-range value taken directly from the species record; it does not scale with level. This build does not apply IVs, EVs, or Natures. For example, level-10 Bulbasaur's base `[60, 49, 49, 65, 65, 4, 3]` becomes `[32, 14, 14, 18, 18, 5, 3]`.

Speed and Movement have distinct roles: Speed sets each unit's next-action time, while Movement sets the tile limit for each Move command. Every Pokémon gains 3 AP at each turn start. Show the current cycle and AV, the upcoming units' remaining AV, and the fixed AP gain.

## Terrain and elevation

Each map tile has an elevation level of 0, 1, or 2 and a terrain kind. Show height through tile edges or shadows as well as a visible height marker when a tile is selected.

| Terrain rule | Early build behavior                                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elevation    | Grounded Pokémon cross a one-level change only through a slope on the higher tile that faces the lower tile. The same slope supports ascent and descent; a change of two levels is impassable. Flying Pokémon ignore slope and height limits. Elevation does not change the fixed 1 AP Move cost. |
| High ground  | A ranged attack from a higher tile gains one tile of range. Obstacles and taller intervening terrain still block line of sight.                                                                                                                               |
| Deep water   | A species or form with swim or fly mobility may enter. Swimmers enter the swimming state while on water and show a ripple. Flyers remain airborne and show a shadow. Others treat deep water as impassable.                                                     |
| Lava         | A nonflying Pokémon takes 10% of its maximum HP, rounded up, when it enters lava, including when pushed onto it. It takes the same damage at each cycle boundary while there. Flyers pass over lava; Stealth Rock still affects them.                            |
| Objects      | Trees and rocks occupy plain tiles and block movement for all Pokémon, including flyers. They also block shots through their tile. Bushes, flowers, and grass tufts are passable details. Object placement is authored separately from ground kind and elevation. |

The unit's saved mobility state updates on each tile entry and forced displacement. Mega forms may change flight or swim capability immediately. Terrain damage and timed effects resolve on tile entry or at the next cycle boundary. Display reachable tiles, the fixed 1 AP Move cost, height, and expected hazard damage during movement preview.

Map authoring must keep every ground-eligible ally and enemy deployment cell, plus any capture objective, connected by a grounded route using the same water, slope, elevation, and solid-object rules as battle movement. Encounter validation must also check legal placements for swimmers and flyers against their mobility profiles. Water-only enemy placements need a reachable adjacent shore for grounded opponents.

## Weather

One weather state can be active at a time. An encounter chooses its starting weather from that map's allowed weather states. Weather damage modifiers multiply move damage after the type matchup; defensive boosts modify the relevant Defense stat during damage calculation. For this plan, “snow type” means **Ice type**.

| Weather   | Effect                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sun       | Fire move damage ×1.5; Water move damage ×0.5.                                                                                                                                             |
| Rain      | Water move damage ×1.5; Fire move damage ×0.5.                                                                                                                                             |
| Snow      | Defense ×1.5 for Pokémon with Ice as one of their types.                                                                                                                                   |
| Sandstorm | Special Defense ×1.5 for Pokémon with Rock as one of their types. At each 2,000-AV cycle boundary, Pokémon without Rock, Steel, or Ground as a type lose 1/16 of their maximum HP, rounded up. |

Weather starts at battle time 0 and lasts three cycles (6,000 AV), then returns to clear weather. Resolve cycle damage before an action scheduled at the same time. Show the active weather, remaining duration, and next sandstorm damage tick beside the AV queue. Weather never changes a type's immunity.

## Types and effectiveness

Support the standard set: Normal, Fire, Water, Electric, Grass, Ice, Fighting, Poison, Ground, Flying, Psychic, Bug, Rock, Ghost, Dragon, Dark, Steel, and Fairy.

The move's type determines effectiveness against each of the defender's types. Use the following chart supplied for this project. An interaction absent from the strengths, resistances, and immunity lists is neutral.

The workspace also contains `pokemon_single_type_chart.csv` and `pokemon_dual_type_chart.csv`. Both use defending types as rows and attacking move types as columns. The dual-type values match the product of their two single-type rows; use the single-type chart as the data source and the dual-type chart as a reference when implementing matchups.

| Attacking move type | Super effective against             | Not very effective against                          |
| ------------------- | ----------------------------------- | --------------------------------------------------- |
| Normal              | None                                | Rock, Steel                                         |
| Fire                | Grass, Ice, Bug, Steel              | Fire, Water, Rock, Dragon                           |
| Water               | Fire, Ground, Rock                  | Water, Grass, Dragon                                |
| Grass               | Water, Ground, Rock                 | Fire, Grass, Poison, Flying, Bug, Dragon, Steel     |
| Electric            | Water, Flying                       | Electric, Grass, Dragon                             |
| Ice                 | Grass, Ground, Flying, Dragon       | Fire, Water, Ice, Steel                             |
| Fighting            | Normal, Ice, Rock, Dark, Steel      | Poison, Flying, Psychic, Bug, Fairy                 |
| Poison              | Grass, Fairy                        | Poison, Ground, Rock, Ghost                         |
| Ground              | Fire, Electric, Poison, Rock, Steel | Grass, Bug                                          |
| Flying              | Grass, Fighting, Bug                | Electric, Rock, Steel                               |
| Psychic             | Fighting, Poison                    | Psychic, Steel                                      |
| Bug                 | Grass, Psychic, Dark                | Fire, Fighting, Poison, Flying, Ghost, Steel, Fairy |
| Rock                | Fire, Ice, Flying, Bug              | Fighting, Ground, Steel                             |
| Ghost               | Psychic, Ghost                      | Dark                                                |
| Dragon              | Dragon                              | Steel                                               |
| Dark                | Psychic, Ghost                      | Fighting, Dark, Fairy                               |
| Steel               | Ice, Rock, Fairy                    | Fire, Water, Electric, Steel                        |
| Fairy               | Fighting, Dragon, Dark              | Fire, Poison, Steel                                 |

Defensive immunities take priority over strengths and resistances:

| Defending type | Takes zero damage from |
| -------------- | ---------------------- |
| Normal         | Ghost                  |
| Ground         | Electric               |
| Flying         | Ground                 |
| Ghost          | Normal, Fighting       |
| Dark           | Psychic                |
| Steel          | Poison                 |
| Fairy          | Dragon                 |

Use 2× for a super effective interaction, 0.5× for a resisted interaction, 1× for neutral, and 0× for an immunity. For a dual-type defender, multiply the two interactions: two weaknesses give **4×**, one weakness gives **2×**, one weakness plus one resistance gives **1×**, two resistances give **0.25×**, and either type's immunity gives **0×**. Do not cap the 4× result. The attack preview should show the combined type multiplier before the player confirms a move.

A Pokémon using a damaging move that matches either of its own types gains a separate 1.2× same-type bonus. Store the chart as data rather than hard-coding matchups into moves so it can be reviewed and adjusted in one place.

Launch types should also have a tactical character: Fire creates damage and Burn, Water pushes and controls hazards, Grass heals and roots, Electric reaches or chains to nearby targets, Ground disrupts areas, Rock provides cover and durability, Ice slows enemies and uses snow, and Normal offers flexible utility. These are design tendencies, not restrictions on every move.

## Initial Pokémon and abilities

These six Pokémon are the initial starter choices. Each current species and form starts with four distinct learned and equipped moves; further moves unlock through its level-based learnset and can replace an equipped move on the post-battle XP screen.

| Pokémon   | Type          | Ability                                                                                                                          | Starting moves                                    |
| --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Bulbasaur | Grass         | **Chlorophyll:** effective Speed ×2 while sun is active.                                                                         | Vine Whip, Tackle, Razor Leaf, Tail Whip          |
| Squirtle  | Water         | **Torrent:** Water move damage ×1.5 while current HP is below 50% of maximum HP.                                                 | Water Pulse, Tackle, Bubble, Tail Whip            |
| Lapras    | Ice / Water   | **Water Absorb:** when hit by a Water move, take no damage or secondary effect and heal 25% of maximum HP, capped at maximum HP. | Ice Shard, Water Pulse, Bubble, Tackle            |
| Geodude   | Ground / Rock | **Sand Veil:** while sandstorm is active, enemy moves targeting it have an 80% chance to hit.                                    | Rock Throw, Mud Slap, Rock Smash, Tackle          |
| Pikachu   | Electric      | **Static:** when hit by a contact move, has a chance to paralyze the attacker.                                                   | Thunder Shock, Tackle, Quick Attack, Tail Whip    |
| Meowth    | Normal        | **Technician:** damaging moves costing at most 2 AP deal 50% more damage.                                                         | Tackle, Tail Whip, Scratch, Quick Attack          |

Paralysis halves effective Speed for two cycles (4,000 AV), immediately rescheduling the target's waiting action. Keep the chance for Static, Thunderbolt, Ember's Burn, and Thunder Shock's chain in move and ability data for balance tuning. An attack that misses applies neither damage nor effects; Water Absorb intercepts a Water move after it hits and before damage. A Fire Pokémon for Ember and Sunny Day, plus one additional recruitable Pokémon that can use the initial Mega Stone, still need species choices.

## Move design

Each move record has a type, category, power, range, target shape, AP cost, tags, and optional effects. Category is **Physical**, **Special**, or **Status**. Physical damage uses Attack and Defense; Special damage uses Special Attack and Special Defense. Every damaging move also has an attack **delivery** of **Melee** or **Ranged**. Melee describes a direct body, limb, or held-part strike; it can reach beyond one tile, as Vine Whip does. Ranged describes a launched, projected, or distant-area attack; Physical moves such as Rock Throw and Ice Shard can be Ranged. Delivery does not change the damage stat, tile range, contact tag, line of sight, or animation sheet style by itself. Status moves have no attack delivery. Moves have 100% base accuracy unless an effect such as Sand Veil modifies hit chance. A move must hit before it rolls for a critical hit or secondary effect.

The former cooldown tiers are AP costs in the early build: standard moves cost 1 AP, Stealth Rock costs 2, Thunderbolt costs 4, and major weather moves cost 4. A Pokémon chooses one equipped move for its single Attack command each turn. Every Pokémon gains 3 AP at each turn start; a Move command costs 1 AP and is limited to once per turn.

Each hit from a damaging Physical or Special move has a **1-in-24 critical chance** (about 4.17%). On a critical hit, multiply the final nonzero move damage by **1.5**, after stats, type effectiveness, same-type bonus, and weather are applied. Roll separately for each target of an area move. Type immunity still results in 0 damage. Status moves and damage from weather, terrain, or ongoing conditions cannot critically hit in the early build. Mark critical hits in the battle animation and action log.

Target shapes for the early build are single unit, small area, and self. The current effect vocabulary includes damage, Burn, paralysis, push and pull, stat stages, chain damage, weather, temporary terrain effects, action advance, and action delay. Action effects alter a unit's next scheduled AV directly; Speed changes rescale its remaining wait. Paralysis halves effective Speed while it lasts and can change the order; AP gain remains fixed at 3. Timed effects use the AV clock, and damage over time resolves at cycle boundaries.

Thunder Shock's chain selects one adjacent enemy of the first target after a successful, non-fainting hit and a 30% effect roll. The chained target receives a separate damage-only hit with its own evasion check, absorption and type immunity check, critical roll, damage variance, defensive stats, held-item modifiers, and weather modifiers. Its calculated damage is halved and rounded up. A chained hit does not apply the move's other on-hit effects, contact reactions, or another chain. An immune or missed chain still uses that one chain opportunity.

Tail Whip, Harden, and Howl each change the relevant stat by one stage. The standard Pokémon stage ratios apply, capped between −3 and +3. A stat's current net stage lasts two cycles from its latest change, then returns to zero at the next cycle boundary after expiry. Reapplying a change, including at the cap, refreshes that stat's full timer; an opposing change can reduce or cancel the net stage. Show the stage and cycles remaining on its buff or debuff icon, and show the affected allies and enemies before confirming an area Status move.

Each Pokémon should begin with a reliable low-cost move and a stronger or more tactical move. It can learn more moves as it levels, but equips only two for a battle in the early build. An off-type move gives useful coverage, while the same-type bonus rewards the Pokémon's main identity.

The initial move list is grouped by AP cost and intended power. Exact damage power and secondary-effect chances remain balance values in the move data.

| AP cost  | Move          | Type / category    | Grid use                                            | Effect                                                                        |
| -------- | ------------- | ------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1        | Ember         | Fire / Special     | One target within 3 tiles                           | Weak damage; chance to Burn.                                                  |
| 1        | Vine Whip     | Grass / Physical   | One target within 2 tiles                           | Weak damage; pulls target 1 tile.                                             |
| 1        | Water Pulse   | Water / Special    | One target within 3 tiles                           | Weak damage; pushes target 1 tile.                                            |
| 1        | Thunder Shock | Electric / Special | One target within 3 tiles                           | Weak damage; may chain to one adjacent enemy.                                 |
| 1        | Rock Throw    | Rock / Physical    | One target within 3 tiles                           | Weak damage; creates temporary cover nearby.                                  |
| 1        | Mud Slap      | Ground / Special   | One target within 3 tiles                           | Weak damage; leaves slowing terrain.                                          |
| 1        | Ice Shard     | Ice / Physical     | One target within 6 tiles                           | Weak damage.                                                                  |
| 1        | Tackle        | Normal / Physical  | Adjacent target                                     | Weak damage.                                                                  |
| 1        | Scratch       | Normal / Physical  | Adjacent target                                     | Direct claw damage.                                                           |
| 1        | Quick Attack  | Normal / Physical  | One target within 2 tiles                           | A short rushing strike; no separate priority rule.                            |
| 1        | Razor Leaf    | Grass / Physical   | One target within 3 tiles                           | Ranged leaf damage.                                                           |
| 1        | Bubble        | Water / Special    | 2×2 area within 2 tiles                             | Close-range splash damage.                                                    |
| 1        | Rock Smash    | Fighting / Physical| Adjacent target                                     | Fighting-type contact damage.                                                 |
| 1        | Tail Whip     | Normal / Status    | Self-centered 3×3 area                              | Lowers Defense of **all** Pokémon in the area, including allies and the user. |
| 1        | Harden        | Normal / Status    | Self                                                | Raises the user's Defense.                                                    |
| 1        | Howl          | Normal / Status    | Self-centered 3×3 area                              | Raises Attack of allied Pokémon in the area, including the user.              |
| 2        | Stealth Rock  | Rock / Status      | Place a 3×3 zone within 3 tiles                     | Pokémon entering the zone take hazard damage.                                 |
| 4        | Thunderbolt   | Electric / Special | 2×2 area placed within 4 tiles on the square grid   | Strong damage; chance to paralyze each hit target, halving its Speed.         |
| 4        | Sandstorm     | Rock / Status      | Whole battlefield                                   | Replaces the current weather with sandstorm and resets its duration.          |
| 4        | Sunny Day     | Fire / Status      | Whole battlefield                                   | Replaces the current weather with sun and resets its duration.                |

The initial damaging moves are classified by delivery independently of their damage category and `contact`/`projectile` tags:

| Delivery | Moves |
| -------- | ----- |
| Melee | Tackle, Scratch, Quick Attack, Rock Smash, Vine Whip |
| Ranged | Ember, Razor Leaf, Water Pulse, Bubble, Thunder Shock, Rock Throw, Mud Slap, Ice Shard, Thunderbolt |

Stealth Rock lasts two cycles and deals 1/8 of maximum HP, rounded up, when a Pokémon enters any tile in its 3×3 zone. It affects both teams and Flying Pokémon. Each zone has a stable caster ID and a distinct zone ID; one active Stealth Rock zone per caster can exist, and a new placement replaces only that caster's old zone. Zones from different casters may overlap, but a Pokémon takes Stealth Rock damage only once per tile entry. A zone remains after its caster faints until it expires or is replaced. Sandstorm and Sunny Day use the weather effects above. Thunderbolt uses a 2×2 target area that can be placed within four tiles on the square grid.

Mark contact separately from damage category: Tackle and Vine Whip are contact moves for effects such as Static. Move names, power, and chance values can be tuned after battles are playable.

Use level-based learnsets to introduce the stronger and utility moves during the run: Pikachu can learn Thunderbolt, Geodude can learn Harden, Stealth Rock, and Sandstorm, Meowth can learn Howl, and the Fire recruit can learn Sunny Day. The final learnset levels should let players see new options across the regular encounters without giving every move at the start.

## Held items and battle commands

Each Pokémon may hold one item. The run also has a small bag for unequipped items; the player assigns or swaps held items from the party panel while choosing a route node. A consumed item leaves its slot empty and is removed from the run. Passive and automatic items work only while their holder is deployed and alive.

| Item                  | Trigger and effect                                                                                         | Use                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Leftovers             | Heals 1/16 of maximum HP, rounded up, at each cycle boundary while deployed.                                 | Passive; remains held.                                |
| Sitrus Berry          | When HP falls to 50% or below but stays above 0, immediately heals 25% of maximum HP, rounded up.          | Automatic; consumed after one trigger.                |
| Assault Vest          | Multiplies Special Defense by 1.5 while held. The holder cannot choose Status-category moves.              | Passive; remains held.                                |
| X Attack              | Doubles the holder's Attack until the current battle ends.                                                 | Choose **Special → Use X Attack**; consumed on use.   |
| Compatible Mega Stone | Changes its holder into its defined Mega form, replacing its ability and applying that form's stat values. | Choose **Special → Mega Evolve**; stone remains held. |

The battle action UI has three primary commands: **Attack**, **Move**, and **Special**, plus **Pass**. Attack opens the Pokémon's four equipped moves around a central Back button, including Status-category moves unless an item such as Assault Vest blocks them. Hover or keyboard focus shows a move description; selecting a move highlights its range and type matchups on the board. Move previews tiles within Movement range and shows its fixed 1 AP cost. Special shows an available held-item action, such as X Attack (2 AP) or Mega Evolve (3 AP). Passive and automatic held items display their effects here but do not require a command. Attack and Move each become unavailable after one use in the turn; Special can still spend remaining AP.

A Mega Stone can be equipped only by its compatible Pokémon. Each Mega form is an individual species record with its own stable ID, types, stats, ability, mobility, moves, and asset key. Future Mega forms should retain their source species' HP stat; the current placeholder form has not yet been aligned to that rule. The form record names its source species and required stone; the source species does not embed Mega stats. Mega Evolution changes the battle unit's species ID immediately, once per holder per battle, and lasts until that battle ends. The run party retains its normal species and current HP after battle. A Speed change, including Mega Evolution, proportionally reschedules that unit's remaining AV. Show the stat and ability changes before the player confirms Mega Evolution.

## Roguelike progression

The AV timeline gives turns according to Speed rather than waiting for every deployed Pokémon to take one turn. After every encounter, award the same encounter XP to every Pokémon currently in the run party, including reserves and fainted Pokémon. Each Pokémon tracks its own level and accumulated XP. Level gains update its stats, and a newly recruited Pokémon starts near the current party level so it is useful in the next battle.

Resolve XP and level gains after the battle, then show the growth report. At the following route choice, an eligible Pokémon can evolve from the party panel or defer until another route choice. Evolution changes its species form, stats, and any defined type or ability; it remains evolved for the rest of that run. The current route control names the next form; a before-and-after stat preview is still planned. Evolution keeps its held item and preserves its battle damage: an unfainted Pokémon gains only the increase in maximum HP, while a fainted Pokémon stays at 0 HP. Mega Evolution remains a separate temporary battle form. Include at least one ordinary evolution line with a threshold reachable during the early run.

After XP gains, check every party Pokémon's current form and level against its level-based learnset, including deployed Pokémon, reserves, and fainted Pokémon. Newly eligible moves create saved choices on the XP screen: replace one of the four active moves or keep the current set. Resolve every choice before leaving that screen. The Party panel displays active moves but cannot rearrange or replace them. A skipped move remains in the learned history to prevent the same level offer repeating after every battle; a later TM may teach it if that species is compatible. Recruits arrive knowing all moves available to their form at their starting level and equip four by default, favoring their first two signature moves and recent level unlocks. Ordinary evolution preserves the exact active move slots and learned history; the new form's base and eligible level moves join the history without replacing slots. For the early build, arrange XP thresholds and learnsets so at least one party member receives a move choice after each regular encounter.

Technical Machines are a separate **acquisition category**, independent of Physical, Special, and Status battle move categories. A species lists compatible TM move IDs in `tmMoves`; the item identifies the move it teaches. From the route Bag, select a compatible Pokémon and the active move to replace. TMs are single-use and cannot be held. The initial TM-only move is Swift; TM Swift starts in the bag and is also sold in stores, alongside TM Thunderbolt. A TM does not change active moves until the player confirms its recipient and slot.

Generate a ten-column route from seeded node templates so each run offers different choices while every branch reaches the column-ten boss. Normal battles award shared XP and coins; elites have stronger teams and larger rewards. Healing nodes fully restore and revive the whole owned party. Stores sell held items for coins. The initial special encounter offers one of two free recruits while under the 20-owned cap or a coin cache. The boss rewards completion and a permanent unlock. See [route behavior and prices](ROUTE_OVERHAUL.md).

Permanent unlocks should add variety, such as a new starter, recruit, map, or item. The first release needs only a few unlocks and one region. Store the current run and unlocks locally so a browser refresh does not erase progress.

## Screens and interaction

| Screen                   | Needed information and actions                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start                    | New run, continue run, settings                                                                                                                                             |
| Starter choice           | Searchable, six-point party draft, selected roster, point costs, and hovered/focused species stats                                                                           |
| Route map                | Ten connected columns, visible node types, current path, coins, the column-ten boss, read-only active moves, held items, and eligible evolution                    |
| Battle preparation       | Full party, HP and status, six deployment slots on the rendered isometric map, terrain, and weather                                                                            |
| Battle                   | Grid, terrain height and hazards, weather, upcoming AV queue, current cycle and AV, objective, selected Pokémon, Attack / Move / Special commands, range preview, effectiveness, and action log |
| XP and moves             | XP gained by every party member, level increases, saved choices for each eligible level-up move, and an evolution prompt at the next route choice                                  |
| Reward / recruit         | Clear comparison of available choices                                                                                                                                       |
| Result                   | Run outcome and newly unlocked content                                                                                                                                      |

Use crisp pixel rendering, consistent tile size, and readable icons. Type and status information must appear in text or symbols as well as color. The initial build uses the original generic placeholder sheets in `public/assets/animations/`. The [animation asset guide](ANIMATION_ASSETS.md) defines every file name, direction row, frame range, playback trigger, and replacement step. Record the source and permission of any later artwork intended for distribution.

On the grid, face a Pokémon toward its next movement tile or attack target. Play movement between tile centers, attack toward the target, hurt on a successful damaging hit, and a separate one-shot effect for buffs, debuffs, healing, weather, and Mega Evolution. Return to directional idle after an action; play faint before removing a Pokémon. Finish the visible action sequence before showing the next AV-queue activation, while keeping animation timing separate from combat calculations.

## Technical approach

- **Vite + TypeScript** for the web project and typed game data.
- **Phaser** for the tile board, sprites, selection, and battle animation.
- **React** for menus, route choices, move panels, and other interface elements.
- **Pure TypeScript combat rules** that receive an action and return the next game state. Rendering should read that state rather than own the rules.
- **JSON or TypeScript data files** for Pokémon, ordinary evolution and Mega forms, abilities, moves and level-based learnsets, held items, XP thresholds, type matchups, encounters, and maps.
- **Browser storage** for run progress, settings, and unlocks. A server is unnecessary for this first build.

Suggested source layout:

```text
src/
  game/          combat rules, turn flow, pathfinding, enemy decisions
  content/       Pokémon, evolutions, Mega forms, items, moves, type chart, maps, encounters
  battle/        Phaser scene and visual effects
  ui/            React screens and panels
  persistence/   browser save and load
public/assets/animations/   named battle sheets, effects, weather, manifest
public/assets/              future terrain tiles, icons, audio
```

## Initial content still to define

The core rules and named content are covered above. These data choices remain before the early build can be populated:

- [ ] **Finish the playable roster:** name the Fire recruit that uses Ember and Sunny Day, and name the second recruit plus its compatible Mega form, stone, and replacement ability. The six named starters do not currently cover Fire or a defined Mega form.
- [ ] **Assign species numbers:** set starting HP, Attack, Defense, Special Attack, Special Defense, Speed, and Movement for each playable species, its ordinary evolutions, the Mega form, and enemies.
- [ ] **Finish move data:** set damage power, secondary-effect chances for Ember, Thunder Shock, and Thunderbolt, Static's paralysis chance, Mud Slap's line length and slowing terrain strength, and Rock Throw's cover size and duration. Define what happens when a push or pull meets an occupied or blocked tile.
- [ ] **Set progression data:** choose starting level, XP earned per encounter, level thresholds, evolution stages and requirements, and exact level-based learnsets for the initial roster.
- [ ] **Author encounters and maps:** define the three map layouts with elevation, water, and hazards; enemy teams and boss Pokémon; allowed starting weather for each map; spawn points; and the boss capture tile.
- [ ] **Complete remaining placeholder art:** the six starter battle sheets, shared fallback, attack and status effects, and weather loops are already under `public/assets/animations/`. Add named terrain tiles and UI icons, plus battle sheets for the Fire recruit, second recruit, ordinary evolutions, and Mega form after those forms are chosen.

## Build milestones

- [ ] **1. Battlefield:** render an 8×8 map with elevation, deep water, and lava; select one Pokémon, preview reachable tiles and hazard damage, move, and attack.
- [ ] **2. Complete battle:** add three units per side, the continuous Speed scheduler with random equal-Speed tie breakers, enemy decisions, HP, fainting, and win/loss handling.
- [ ] **3. Initial roster, moves, and items:** add the six named starters and abilities, listed move set and AP costs, type table, hit and critical rolls, status effects, held items, Mega Evolution, and clear action previews.
- [ ] **4. Weather:** add sun, rain, snow, and sandstorm with battle-time duration and damage ticks.
- [ ] **5. One complete run:** add the 20-Pokémon owned-run roster, six-point starting draft, six-Pokémon battle selection, shared XP, level gains, between-encounter evolution and move learning, move loadouts, ten-column route choices, rewards, recruitment, healing, stores, boss objective, and result screens.
- [ ] **6. Presentation and persistence:** load the named placeholder animation sheets and manifest, animate directional grid actions and effects, add terrain and UI placeholders, sound, readable UI, browser saving, and a small set of unlocks.

## Early build completion criteria

The build is ready for broader content work when a player can draft a starting roster within six points, grow to a maximum of 20 owned Pokémon, choose up to six for each battle, and finish a ten-column run in the browser. Award XP to the entire roster, evolve an eligible Pokémon without losing its moves, choose replacements for level-up moves, teach compatible TM moves from the Bag, equip and use held items including one Mega Stone, command the deployed Pokémon through Attack / Move / Special without confusing turn rules, read terrain and weather effects before choosing an action, understand why a move will help or hurt, make meaningful route choices, and return after a refresh with the roster and unlocks intact.

After that milestone, expand the roster and maps, introduce the remaining types, and tune encounter difficulty from actual play sessions.
