# Pokémon Tactics Roguelike — Early Build Plan

For a player-facing description of the game design through the planned artifact system, see the [detailed game description](GAME_DESCRIPTION.md).

## Goal

Build a playable browser prototype of a Pokémon fan game inspired by the tactical battles of Pokémon Conquest and the replayable routes of a roguelike. The player commands several Pokémon on a tile grid, wins short battles, chooses a route, recruits teammates, and faces a final battle. The early build should establish whether positioning, type matchups, and team composition are fun before adding a large roster.

For the current level, HP, move-power, and encounter tuning, see [the early-run balance baseline](BALANCE.md).

For the staged import of Pokémon, moves, abilities, and items from `pokefiles/`, see the [Pokefile content implementation plan](POKEFILE_CONTENT_IMPLEMENTATION_PLAN.md).

For the implemented given and hidden ability slots, Ability Capsule, Ability Patch, temporary hidden assignments, and starting test items, see the [ability overhaul](ABILITY_OVERHAUL_PLAN.md).

For the planned run-wide artifact catalog, rarity tiers, example effects, and implementation decisions, see the [artifacts plan](ARTIFACTS_PLAN.md).

For the proposed fixed starter set, recruitment-based unlocks after wins or losses, and persistence plan, see the [party builder guide](PARTY_BUILDER.md#recruitment-based-starter-unlocks-proposal). These unlock rules are not implemented yet.

The [enemy ranks and initial movesets](#proposed-enemy-ranks-and-automatic-latest-four-movesets) are implemented: encounter counts scale with level, and new Pokémon use their latest four eligible moves. Owned Pokémon retain player-selected moves, manual level-up choices, and TM teaching.

## First playable run

1. Build a starting roster from the available starter and recruit species using six party points. Most Pokémon cost two points, so the default budget buys three. A run can own up to 20 Pokémon total; choose up to six to deploy before each battle.
2. Choose a path through a branching route with ten columns; the boss is always in column ten. See the [route and deployment overhaul](ROUTE_OVERHAUL.md).
3. Before each battle, choose up to six available Pokémon from the run roster and place them on the top-down map. Normal battles, elite battles, full-party healing, stores, and simple special encounters appear along the route.
4. After each battle victory, award XP only to Pokémon deployed in that battle, including deployed battlers that faint. Reserves do not gain battle XP. Offer moves unlocked by participant level gains before the next encounter.
5. Fight the column-ten boss encounter with a distinct map and capture objective.
6. See a win or loss screen. Planned starter progression banks the species recruited during either outcome as permanent choices for future drafts; runtime currently only carries a win count.

Target run length for the ten-column route needs play-session measurement.

## Early build scope

| Area                 | Initial target                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Battle size          | Up to six player Pokémon on an 8×8 square grid; elite and boss enemies can field more than three                                     |
| Run party            | Up to 20 Pokémon; choose up to six to deploy before each solo battle; starting roster drafted from six points                       |
| Maps                 | Three regular map templates and one boss map, reused by route nodes                                                                  |
| Roster               | Six named starting Pokémon and at least two recruitable Pokémon, including a Fire user and a Mega-compatible species                |
| Types in encounters  | Normal, Fire, Water, Grass, Electric, Ground, Rock, and Ice                                                                         |
| Moves                | A growing pool of learned moves, with four equipped for battle and a 1-in-24 critical chance on damaging moves |
| Abilities            | Given ability plus a hidden passive unlocked by Ability Patch; Capsule changes either eligible slot from three saved random choices |
| Growth               | Encounter XP for deployed participants, level-based move learning, and at least one evolution available during a run                |
| Held items           | One slot per Pokémon; Leftovers, Sitrus Berry, Assault Vest, X Attack, and one compatible Mega Stone                                |
| Artifacts            | Planned run-wide collection, separate from held items and the Bag; up to 20 definitions (10 standard and 10 cursed), five rarity tiers, legendary artifacts only from question-mark event nodes; see [artifact plan](ARTIFACTS_PLAN.md) |
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
- Effective Speed is the unit's current Speed after abilities and timed effects. Its next turn is scheduled at `current time + 650,000 / effective Speed`; Speed 65 therefore acts once per 10,000-AV cycle. If Speed changes while a unit waits, the remaining AV is rescaled in proportion to the new interval, preserving the progress it already made. Action-advance effects lower the next-action time of a waiting target or reduce the current actor's next scheduled AV; delay effects raise it.
- A battle cycle is 10,000 AV, matching one turn interval at reference Speed 65. The level-independent base Speeds in the current 11-form catalog average 63.27, close to that reference. Faster units may act more than once in a cycle, while slower units may take more than one cycle between turns. Weather, Burn, lava, and periodic healing resolve at cycle boundaries. Existing effect durations remain authored in the old 100-time-unit scale, where 100 means one cycle, and are converted to AV by the engine.
- Trick Room is a global five-cycle field (50,000 AV). While active, timeline Speed is `4,225 / effective Speed`, keeping Speed 65 unchanged and reversing both action order and action frequency around that reference. Slow Pokémon therefore gain more turns over time; ending or expiring the field proportionally reschedules every waiting unit.
- At the start of its turn a Pokémon gains exactly 3 Action Points (AP), added to any AP banked from earlier turns in that battle. Speed controls how soon the next turn arrives; Movement controls the maximum number of tiles in a Move command.
- **Move** costs exactly 1 AP per command, regardless of the route's length, terrain, or elevation, and can be used once per turn. **Attack** can be used once per turn; a chosen move, including a Status move, is that attack and spends its listed AP cost. **Special** remains available while enough AP remains. **Pass** ends the turn and banks all unused AP for that Pokémon's next turn in the same battle. The next turn adds 3 AP to the bank. Banking does not grant extra Move or Attack commands in a turn, and AP resets between encounters. The turn also ends when AP reaches zero or the Pokémon faints.
- A Move command can cover up to the Pokémon's Movement stat in tiles. Hazards resolve on every entered tile, but path length and terrain do not change its 1 AP cost.
- A unit cannot move through occupied or blocked tiles. Terrain and elevation can restrict traversability, while hazards still affect units entering their tiles.
- Selecting an equipped move highlights its range on the grid before a target is chosen. Targets that can be hit show their combined type effectiveness in both color and text; the move panel lists each reachable enemy's matchup. Selecting a target tile adds the affected area, hit chance, normal and critical damage, and the 1-in-24 critical chance before confirmation.
- A wall, tree, or rock tile cannot be selected as an attack's aim point. For damaging area moves, each defender in the area must also have clear line of sight from the attacker; the area preview and enemy AI use this same rule. Solid cover blocks damage to a defender behind it even when another area tile is visible. Non-damaging area effects still use their authored area after a valid aim point is chosen.
- A fainted Pokémon leaves the grid and remains unavailable until healed or revived at a route node.
- A regular battle ends when one side has no usable deployed Pokémon. If all deployed player Pokémon faint, the battle and run are lost even if healthy reserves remain. The boss battle requires the boss to faint and a player Pokémon to occupy the capture point.

### Run party and deployment

The run party holds at most 20 Pokémon total, including deployed members and reserves. Build the initial roster with six points; species cost two by default, with optional per-species overrides in content. Before each encounter, show the full roster and let the player select up to six with current HP above zero. They may enter with fewer than six; if none are available for a battle, the run ends. Place the selected Pokémon on the rendered top-down map in the ally zone. Reserves take no turns or terrain and weather damage. There is no midbattle swapping in the early build.

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
| Speed           | Sets turn interval: `AV = 650,000 / effective Speed`. Lower AV acts sooner; equal-time ties are randomized. At reference Speed 65, the interval is one 10,000-AV cycle. |
| Movement        | Determines the maximum number of tiles the Pokémon can move in one Move command. Each Move command costs 1 AP regardless of route length.                              |

At level `L`, calculate integer combat stats from the species' base values using `HP = floor(2 × base HP × L / 100) + L + 10`; Attack, Defense, Special Attack, and Special Defense use `floor(2 × base stat × L / 100) + 5`. Speed is copied directly from the species' base Speed and does not change with level; Movement is also copied directly as a fixed tile range. This build does not apply IVs, EVs, or Natures. For example, level-10 Bulbasaur's base [60, 49, 49, 65, 65, 45, 3] becomes [32, 14, 14, 18, 18, 45, 3].

Speed and Movement have distinct roles: Speed sets each unit's next-action time, while Movement sets the tile limit for each Move command. Every Pokémon gains 3 AP at each turn start. Show the current cycle and AV, the upcoming units' remaining AV, and the fixed AP gain.

## Terrain and elevation

Each map tile has an elevation level of 0, 1, or 2 and a terrain kind. Show height through tile edges or shadows as well as a visible height marker when a tile is selected.

| Terrain rule | Early build behavior                                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elevation    | Grounded Pokémon cross a one-level change only through a slope on the higher tile that faces the lower tile. The same slope supports ascent and descent; a change of two levels is impassable. Flying Pokémon ignore slope and height limits. Elevation does not change the fixed 1 AP Move cost. |
| High ground  | A ranged attack from a higher tile gains one tile of range. Obstacles and taller intervening terrain still block line of sight.                                                                                                                               |
| Deep water   | A species or form with swim or fly mobility may enter. Swimmers enter the swimming state while on water and show a ripple. Flyers remain airborne and show a shadow. Others treat deep water as impassable.                                                     |
| Lava         | A nonflying Pokémon takes 10% of its maximum HP, rounded up, when it enters lava, including when pushed onto it. It takes the same damage at each cycle boundary while there. Flyers pass over lava; Stealth Rock still affects them.                            |
| Objects      | Broadleaf/pine trees and rocks occupy plain tiles and block movement for all Pokémon, including flyers, and obstruct shots through their tile. Fallen logs and stumps block movement but leave shots clear. Bushes, ferns, mushrooms, flowers, and grass tufts are passable. Object placement is authored separately from ground kind and elevation; dirt and moss surfaces change art only. |

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

A Pokémon using a damaging move that matches either of its own types gains a separate 1.5× same-type bonus. Store the chart as data rather than hard-coding matchups into moves so it can be reviewed and adjusted in one place.

Launch types should also have a tactical character: Fire creates damage and Burn, Water pushes and controls hazards, Grass heals and roots, Electric reaches or chains to nearby targets, Ground disrupts areas, Rock provides cover and durability, Ice slows enemies and uses snow, and Normal offers flexible utility. These are design tendencies, not restrictions on every move.

## Initial Pokémon and abilities

These six Pokémon are the initial starter choices. Each current species and form starts with four distinct learned and equipped moves; further moves unlock through its level-based learnset and can replace an equipped move on the post-battle XP screen.

The table lists the default given abilities. Each species/form also has a distinct hidden ability, currently selected from the existing catalog as a placeholder. An Ability Patch unlocks the second passive; an Ability Capsule can change the given slot or the unlocked hidden slot. Both chosen abilities persist with the owned Pokémon through ordinary evolution. See [the full assignment table and dual-passive rules](ABILITY_OVERHAUL_PLAN.md).

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

Target shapes for the early build are single unit, small area, and self. The current effect vocabulary includes damage, Burn, paralysis, push and pull, stat stages, chain damage, weather, Trick Room, temporary terrain effects, action advance, and action delay. Action effects alter a unit's next scheduled AV directly; Speed changes rescale its remaining wait. Paralysis halves effective Speed while it lasts and can change the order; AP gain remains fixed at 3. Timed effects use the AV clock, and damage over time resolves at cycle boundaries.

Thunder Shock's chain selects one adjacent enemy of the first target after a successful, non-fainting hit and a 30% effect roll. The chained target receives a separate damage-only hit with its own evasion check, absorption and type immunity check, critical roll, damage variance, defensive stats, held-item modifiers, and weather modifiers. Its calculated damage is halved and rounded up. A chained hit does not apply the move's other on-hit effects, contact reactions, or another chain. An immune or missed chain still uses that one chain opportunity.

Stat stages support Attack, Defense, Special Attack, Special Defense, and Speed; HP and Movement cannot receive stages. Tail Whip, Harden, and Howl each change the relevant stat by one stage. The current move catalog has no Speed-stage move yet, but a `stage` effect can now target `speed`. Stat stages are capped between −6 and +6 and multiply the affected stat as follows (negative values are rounded to two decimals):

| Stage | Multiplier | Stage | Multiplier |
| ---: | ---: | ---: | ---: |
| +6 | 4× | −1 | 0.67× |
| +5 | 3.5× | −2 | 0.5× |
| +4 | 3× | −3 | 0.4× |
| +3 | 2.5× | −4 | 0.33× |
| +2 | 2× | −5 | 0.29× |
| +1 | 1.5× | −6 | 0.25× |
| 0 | 1× |  |  |

A stage change lasts five cycles on the AV clock, equal to five turns at reference Speed 65. Reapplying a change adds its delta to the current net stage and refreshes that stat's full five-cycle timer, including at the cap; an opposing change can reduce or cancel the net stage. For example, Harden gives Defense +1 for five turns; using it again on the fourth turn raises Defense to +2 and restarts the five-turn duration. A stat returns to zero when its expiry is processed on the AV clock. Show the stage and cycles remaining on its buff or debuff icon, and show the affected allies and enemies before confirming an area Status move.

Speed stages multiply the stored base Speed before weather/ability and paralysis modifiers; fractional effective Speed is retained for AV timing. They proportionally reschedule a waiting unit's remaining AV and determine the acting unit's next interval. Speed expiry is an explicit timeline event, including between cycle boundaries. Trick Room inverts the resulting effective Speed, so a positive Speed stage makes the unit wait longer while that field is active. Stage changes never alter HP, maximum HP, or the stored base stats.

Each Pokémon should begin with a reliable low-cost move and a stronger or more tactical move. It can learn more moves as it levels and equips four for a battle. An off-type move gives useful coverage, while the same-type bonus rewards the Pokémon's main identity.

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

New runs also receive one Ability Capsule and one Ability Patch for testing. Use them from the route Bag's Ability items group; neither can be held. Patch unlocks the hidden passive, while Capsule rolls three distinct replacements for the selected eligible slot and consumes only after a choice. Generated choices persist until resolved and block route progression.

| Item                  | Trigger and effect                                                                                         | Use                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Leftovers             | Heals 1/16 of maximum HP, rounded up, at each cycle boundary while deployed.                                 | Passive; remains held.                                |
| Sitrus Berry          | When HP falls to 50% or below but stays above 0, immediately heals 25% of maximum HP, rounded up.          | Automatic; consumed after one trigger.                |
| Assault Vest          | Multiplies Special Defense by 1.5 while held. The holder cannot choose Status-category moves.              | Passive; remains held.                                |
| X Attack              | Doubles the holder's Attack until the current battle ends.                                                 | Choose **Special → Use X Attack**; consumed on use.   |
| Compatible Mega Stone | Changes its holder into its defined Mega form, replacing its active ability profile and applying that form's stat values. | Choose **Special → Mega Evolve**; stone remains held. |

The battle action UI has three primary commands: **Attack**, **Move**, and **Special**, plus **Pass**. Attack opens the Pokémon's four equipped moves around a central Back button, including Status-category moves unless an item such as Assault Vest blocks them. Hover or keyboard focus shows a move description; selecting a move highlights its range and type matchups on the board. Move previews tiles within Movement range and shows its fixed 1 AP cost. Special shows an available held-item action, such as X Attack (2 AP) or Mega Evolve (3 AP). Passive and automatic held items display their effects here but do not require a command. Attack and Move each become unavailable after one use in the turn; Special can still spend remaining AP.

A Mega Stone can be equipped only by its compatible Pokémon. Each Mega form is an individual species record with its own stable ID, types, stats, ability, mobility, moves, and asset key. Future Mega forms should retain their source species' HP stat; the current placeholder form has not yet been aligned to that rule. The form record names its source species and required stone; the source species does not embed Mega stats. Mega Evolution changes the battle unit's species ID immediately, once per holder per battle, and lasts until that battle ends. The run party retains its normal species and current HP after battle. A Speed change, including Mega Evolution, proportionally reschedules that unit's remaining AV. Show the stat and ability changes before the player confirms Mega Evolution.

## Roguelike progression

The AV timeline gives turns according to Speed rather than waiting for every deployed Pokémon to take one turn. After a battle victory, award the encounter XP to each Pokémon deployed in that battle, including deployed Pokémon that faint. Reserves do not gain XP from that battle. Each Pokémon tracks its own level and accumulated XP. Level gains update its stats, and a newly recruited Pokémon starts near the current party level so it is useful in the next battle.

Resolve XP and level gains after the battle, then show the growth report. At the following route choice, an eligible Pokémon can evolve from the party panel or defer until another route choice. Evolution changes its species form, stats, and defined types while preserving both selected ability IDs and the hidden unlock; it remains evolved for the rest of that run. The current route control names the next form; a before-and-after stat preview is still planned. Evolution keeps its held item and preserves its battle damage: an unfainted Pokémon gains only the increase in maximum HP, while a fainted Pokémon stays at 0 HP. Mega Evolution remains a separate temporary battle form that supplies its own ability profile and follows the Pokémon's hidden unlock. Include at least one ordinary evolution line with a threshold reachable during the early run.

After XP gains, check deployed participants that gained a level against their current form's level-based learnset. Newly eligible moves create saved choices on the XP screen: replace one of the four active moves or keep the current set. Resolve every choice before leaving that screen. The Party panel displays active moves but cannot rearrange or replace them. A skipped move remains in the learned history to prevent the same level offer repeating after every battle; a later TM may teach it if that species is compatible. Recruits arrive knowing all moves available to their form at their starting level and equip their latest four distinct eligible moves by default, with fewer slots when unavailable. Ordinary evolution preserves the exact active move slots and learned history; the new form's base and eligible level moves join the history without replacing slots. For the early build, arrange XP thresholds and learnsets so at least one deployed participant receives a move choice after a regular encounter.

Technical Machines are a separate **acquisition category**, independent of Physical, Special, and Status battle move categories. A species lists compatible TM move IDs in `tmMoves`; the item identifies the move it teaches. From the route Bag, select a compatible Pokémon and the active move to replace. TMs are single-use and cannot be held. The initial TM-only move is Swift; TM Swift starts in the bag and is also sold in stores, alongside TM Thunderbolt. A TM does not change active moves until the player confirms its recipient and slot.

## Proposed enemy ranks and automatic latest-four movesets

Status: **implemented 2026-10-05**, including the clarification that latest-four loadouts apply at creation while owned Pokémon retain manual progression. `src/game/enemyRanks.ts` owns rank multipliers, count thresholds, and the independent composition stream; `src/game/movesets.ts` owns initial move selection. Save schema v27 preserves ranks and restarts active older battles at preparation. Related current contracts are in [balance](BALANCE.md), [route/deployment](ROUTE_OVERHAUL.md), and [content/save authoring](SCALING.md). The section heading retains its proposal name so existing links remain stable.

### Requested rules and working assumptions

Give each enemy its own rank, separate from the route node's battle category. A normal enemy accompanying an Elite or Boss retains normal stats.

| Enemy rank | HP, Attack, Defense, Special Attack, Special Defense, Speed | Movement |
| --- | --- | --- |
| Normal | 1× level-derived stats | Unchanged |
| Elite | 2× (+100%) | Unchanged |
| Boss | 3× (+200%) | Unchanged |

Apply the multiplier **after** `statsAtLevel`, including the level-derived HP offset. For example, a normal stat tuple of `[40, 20, 30, 25, 35, 60, 3]` becomes `[80, 40, 60, 50, 70, 120, 3]` for an Elite and `[120, 60, 90, 75, 105, 180, 3]` for a Boss. Enemy current HP starts at the multiplied maximum. Species catalog stats and owned Pokémon do not acquire rank bonuses.

The rank bonus is an intrinsic battle-stat multiplier, independent of temporary +/- stages: stages begin at zero, retain their normal caps and expiry, and buffs/debuffs apply on top of the ranked stats. Stage removal, expiry, and critical-hit stage handling must never remove the rank multiplier. Rank does not grant extra AP per turn; multiplied Speed changes turn frequency through the existing scheduler. Weather, paralysis, abilities, and Trick Room then operate on that Speed normally. Rank must survive an enemy's temporary form change, with stats recalculated once from the new species rather than multiplied again.

Confirmed by the user: Speed is included in the listed six boosted stats, separate from temporary stages; Movement is excluded. The user clarified that “latest four” initializes newly created Pokémon, especially high-level wild Pokémon and recruits, rather than automatically replacing an owned Pokémon's moves after leveling. A level-15 recruit immediately receives the latest eligible level-15 moveset, without replaying earlier level-up prompts. After joining, it retains player-selected slots and offers future level-up moves through the existing replacement/keep-current choices. Initialize from distinct starting/level-up moves, including Status moves; do not equip future unlocks or choose by power. TM teaching remains available.

| Battle category | Normal enemies | Elite enemies | Boss enemies | Total |
| --- | ---: | ---: | ---: | ---: |
| Normal | 3–8 | 0 | 0 | 3–8 |
| Elite | 3–5 | 1–3 | 0 | 4–8 |
| Boss | 2–5 | 0–2 | Exactly 1 | 3–8 |

Keep the current ten-column route, six-ally deployment cap, maps, node rewards, and defeat/capture objectives as the starting integration baseline. Preserve the existing normal-level formula, Elite +3 level offset, and level-21 Boss initially; applying rank bonuses as well is a deliberate additional difficulty increase and requires play tuning. The separate higher-floor/over-100 proposal remains future work.

### Preimplementation snapshot (historical)

- `encounterDefinition` in `src/game/engine.ts` returns three enemies for normal nodes, appends one enemy for Elite nodes, and overrides the Boss to four level-21 enemies. `Encounter.enemies` in `src/game/types.ts` stores species IDs only; there is no unit-rank field.
- `makeUnit` uses ordinary `statsAtLevel` for both sides. `effectiveSpeed` combines the unit's stored Speed, temporary Speed stage, weather/ability, and paralysis effects for the scheduler. `useSpecial` replaces stats during Mega Evolution and therefore needs rank-aware recalculation.
- `defaultLoadoutAtLevel` preserves the first two starting moves before selecting recent unlocks. Drafted units, recruits, wild opponents, and Battle Lab use this default at creation; owned battle units copy `PartyMon.equipped`.
- `completeBattle` queues manual level-up choices; `resolveLevelMove`, `advanceRoute`, `IntermissionScreen`, and `App` manage those choices. `teachTm` and `RouteScreen` allow manual TM slot replacement. Ordinary/item evolution retains equipped slots, and Mega Evolution currently retains battle moves.
- `validateCatalog` requires exactly four starting moves. Deployment can fall back to legal zone cells beyond authored defaults, but existing capacity checks use template lengths and the old Elite +1 rule. `edgeSpawns` in `src/content/maps.ts` authors at most six default starts, so eight-enemy support needs explicit validation.
- Saves currently write schema v26; restoration fills slots from starting/learned history and can preserve manual moves. Active battle snapshots include stats, HP, moves, and action scheduling. These need a deliberate migration to the new contracts.

### Level-based compositions (implemented initial curve)

`enemyCounts` calculates rank counts from the encounter's resolved enemy level. `COMPOSITION_LEVELS` names the level-9 start and level-21 saturation point so the curve can be tuned without altering battle rules. The implemented initial curve is:

```text
progress = clamp((enemyLevel - 9) / 12, 0, 1)
Normal: normal = 3 + floor(5 * progress)
Elite:  elite = 1 + floor(2 * progress), normal = 3 + floor(2 * progress)
Boss:   boss = 1, elite = floor(2 * progress), normal = 2 + floor(3 * progress)
```

Examples: Normal levels 9/15/21 produce 3/5/8 Normals; Elite levels 12/15/21 produce 1+3 / 2+4 / 3+5 Elite+Normal teams; Boss levels 9/15/21 produce 1+0+2 / 1+1+3 / 1+2+5 Boss+Elite+Normal teams. Current floor-1 levels use only part of these ranges for normal and Elite encounters. The level-21 Boss fields eight enemies. These thresholds are implemented tuning defaults, not a claim of tested difficulty.

Resolved enemies are ordered `{ species, rank }` entries. Templates have explicit Normal and Elite species pools; the final template's Boss is Charmander, with Geodude/Pikachu Elites and Lapras/Geodude/Pikachu Normal escorts. A pool is drawn without repeats until exhausted, then refilled if more units are required; each unit has its own ID. Temporary Mega forms cannot spawn directly.

Resolve the roster deterministically using the run seed, stable node ID, category, and resolved level through a separate encounter stream. Reading preparation details, changing ally placement, canceling/re-entering preparation, refreshing, and computing rewards must produce the same roster without advancing combat RNG. All enemies initially share the encounter's resolved level; rank supplies the stat difference. Use this same resolved definition for preparation counts, deployment, battle creation, and rewards.

### Latest-four initial movesets; manual progression after joining

1. Normalize the current species' starting moves into ordered baseline entries, then append level-up entries sorted by required level and a stable authored tie order. With current catalogs, `Species.moves` array order is the baseline chronology; it is a fallback convention because starting moves lack authored unlock levels. Future imported learnsets must provide explicit level/order metadata.
2. Filter level-up entries to `requiredLevel <= currentLevel`. Scan eligible entries from newest to oldest and keep the first occurrence of each distinct move ID; take up to four. Display the retained slots in chronological order, oldest retained to newest. Fewer than four eligible distinct moves means fewer equipped moves; never fabricate padding or future unlocks. Invalid move IDs should fail catalog validation.
3. Use one shared selector to initialize starter/draft Pokémon, new recruits and full-roster replacements, every wild/enemy rank, and fresh Battle Lab Pokémon on both sides. Species IDs plus encounter/recruit level determine the initial moveset, avoiding hand-authored encounter loadouts. Once a Pokémon joins the owned roster, stop applying this selector to it.
4. Preserve the existing XP flow: newly eligible moves create saved offers to replace an equipped slot, fill an open slot, or keep the current set. Multi-level gains offer each newly eligible distinct move under the existing learned-history rules. Keep replacement/skip controls, pending-choice persistence, and the unresolved-choice navigation gate. Do not replace moves automatically during XP awards.
5. Treat `PartyMon.equipped` as the authoritative player-chosen moveset after creation. Owned battle units copy those slots; starting a battle, returning to the route, refreshing/loading a save, ordinary/item evolution, and Mega form changes must not reset them to the latest-four default. Preserve current evolution/form move behavior and learned history. Rank-aware form changes recalculate enemy stats without discarding current battle moves.

Current-catalog initial-loadout examples: a newly recruited or wild level-11 Pikachu equips Tackle, Quick Attack, Tail Whip, Thunderbolt; a newly created level-13 Geodude equips Tackle, Harden, Stealth Rock, Sandstorm. The first two starting moves receive no special protection during initialization. By contrast, an already-owned Pikachu reaching level 11 keeps its previous slots until the player decides whether and where to equip Thunderbolt. Owned Pokémon of the same species and level can therefore have different chosen movesets.

Keep existing TM compatibility, recipient/slot selection, consumption, shop stock, and starting-bag items. The latest-four selector uses only starting and level-up moves to generate an initial default; it must not erase subsequently taught TM moves or override player choices. No TM disablement or inventory conversion is part of this plan.

When fewer than four moves are eligible, the Attack menu shows only available choices. Catalog validation accepts one or more distinct starting moves and positive integer unlock levels; initialization and save validation limit equipped moves to four distinct IDs. For imported data, define an authoritative game/version learnset before ordering unlocks: the current reference CSV merges levels across versions and is not an authoritative single-game chronology.

### Implemented integration and main files

1. **Contracts/helpers:** `types.ts` defines ranked enemies and pool-based encounter templates; `enemyRanks.ts` resolves counts, seeded pools, and intrinsic multipliers; `movesets.ts` selects eligible initial moves. Catalog validation checks categories, species pools, Boss identity, learnset references/levels, and short starting lists.
2. **Combat:** `engine.ts` uses the resolved roster for preparation, deployment, rewards, and battle creation. Ranked stats are derived once at creation and again from fresh species stats during Mega Evolution. The existing damage, stat-stage, AP, and AV rules remain in use. Battle Lab's opponent rank selector defaults to Normal.
3. **Deployment/UI:** catalog checks cover every template on every campaign arena at maximum size, all pool species' reachability, and at least eight legal enemy cells per pool species. Existing zone fallback supports enemies seven/eight without changing maps or default spawn arrays. Preparation exposes actual species, rank counts, and initial moves; board labels distinguish Elite/Boss, HUD badges identify ranks, and inspection shows multiplied stats.
4. **Progression:** `defaultLoadoutAtLevel` delegates to the latest-four selector only for fresh Pokémon. Level-up offers, replacement/skip controls, TMs, evolution/form moves, and owned battle slots remain player-controlled. Existing Attack rendering already handles fewer moves.
5. **Persistence:** v27 stores and validates rank and intrinsic stats. Active pre-v27 battles restart once at preparation with a report; owned party data and valid pending offers are retained. New-schema battles resume HP, stats, moves, RNG, and AV scheduling without reranking. Valid owned open slots also survive refresh; repair only fills malformed or legacy loadouts. Current/backup IndexedDB recovery is retained.
6. **Verification:** `scripts/ranked-encounters-checks.ts` runs inside the existing playthrough and covers ranks/counts, seeded previews, maximum deployment, Speed/Mega interactions, initial moves, manual progression/TMs/evolution, and v25/v26/v27 saves. Effect smoke cases use levels where their requested test moves remain equipped. The project record reports executed checks and remaining balance limits.

### Acceptance checks and tuning evidence

- Check count boundaries at levels 1, 9, 12, 15, 18, 21, 100 and just before/after each threshold. Every composition stays within the requested rank ranges; every Boss battle has exactly one Boss. Repeated reads/reloads preserve species, ranks, count, and combat RNG.
- Compare same-species/same-level Normal, Elite, and Boss units: the first six stats and maximum HP are exactly 1×/2×/3×; Movement and AP gain stay constant. Buffs, debuffs, their expiry, critical damage, and form changes preserve the intrinsic multiplier without stacking it twice. Check weather, paralysis, Trick Room, and scheduled turns using multiplied Speed.
- Check initial defaults at one level below/at/above unlocks, duplicate moves, ties, short learnsets, level-15 recruitment, full-roster replacement, every enemy rank, and fresh Battle Lab Pokémon. All creation paths produce the same selector result for the same species/level; no future or unsupported move appears. Separately verify owned single/multi-level gains offer replacement/open-slot/keep-current choices, declined moves stay declined, pending offers block Continue until resolved, and selected/TM moves survive deployment, evolution/items, temporary forms, and refresh.
- Check maximum eight-enemy deployments on every normal map, the Elite lake, and the 8×8 Boss arena, including mixed swimming/flying species, occupied-cell rejection, and capture connectivity. Never silently reduce an encounter to fit a map.
- Round-trip new preparation, active battle, and intermission saves; migrate representative v26 and older fixtures, pending move choices, manually/TM-equipped Pokémon, active battles, and backup fallback. Migration must retain valid owned moves and pending offers. New-schema refreshes must not heal enemies, reroll the roster, reset moves to initial defaults, or multiply stats a second time.
- When code ships, run `npm run build`, `npm run playthrough`, `npm run verify:targeting`, `npm run verify:forest`, `npm run measure:save`, and `git diff --check`, updating assumptions in existing scripts to the new rules. Visually review rank labels, short Attack menus, retained level-up/TM choices, and save reloads.
- Play early three-ally drafts through normal/Elite/Boss paths and six-ally late encounters. Record win rate, cycles, fainted allies, damage taken, AP banking, and turns per rank. Doubling/tripling both offense and Speed can substantially raise pressure; tune the proposed count thresholds and existing level offsets from that evidence while retaining the requested rank multipliers and count limits. Balance is not verified by deterministic smoke checks alone.

## Run artifacts

Artifacts are planned as powerful, global run modifiers collected in a dedicated artifact collection, separate from Pokémon-held items and the Bag. The catalog is capped at 20 unique definitions: 10 standard and 10 cursed. Every artifact has a common, uncommon, rare, epic, or legendary rarity; legendary artifacts are only obtainable from question-mark event nodes. Acquired artifacts are intended to remain active for that run and may affect progression, the roster, battle rules, or resources. The sample concepts and open effect decisions are documented in the [artifacts plan](ARTIFACTS_PLAN.md). Exp Share could extend XP to reserves and apply its proposed bonus to that shared XP.

Generate a ten-column route from seeded node templates so each run offers different choices while every branch reaches the column-ten boss. Normal battles award XP to deployed participants and coins; elites have stronger teams and larger rewards. Healing nodes fully restore and revive the whole owned party. Stores sell held items for coins. Recruitment nodes offer three Pokémon and require a valid roster replacement at the 20-owned cap; special nodes resolve separate weighted events. Boss completion currently increments the win count. The proposed starter rewards would bank recruitment history when a run ends in victory or defeat. See [route behavior and prices](ROUTE_OVERHAUL.md).

Planned starter progression begins with six fixed choices and adds species successfully recruited during each finished run, whether won or lost. The catalog, recruitment-history, profile-save, restart, and legacy-migration rules are in the [party builder guide](PARTY_BUILDER.md#recruitment-based-starter-unlocks-proposal); runtime currently records a numeric victory count without changing available content. Other permanent rewards, such as maps or items, remain later scope. Store profile progression separately from the replaceable run so New Run and browser refresh retain earned starter choices.

## Screens and interaction

| Screen                   | Needed information and actions                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start                    | New run, continue run, settings                                                                                                                                             |
| Starter choice           | Searchable, six-point party draft, selected roster, point costs, and hovered/focused species stats                                                                           |
| Route map                | Ten connected columns, visible node types, current path, coins, the column-ten boss, read-only active moves, held items, active run artifacts, and eligible evolution |
| Battle preparation       | Full party, HP and status, six deployment slots on the rendered top-down map, terrain, and weather                                                                            |
| Battle                   | Grid, terrain height and hazards, weather effects and remaining cycles, next Sandstorm tick, Trick Room cycles, level and status-stage details, upcoming AV queue, current cycle and AV, objective, selected Pokémon and action readiness, Attack / Move / Special commands, range preview, effectiveness, and action log |
| XP and moves             | XP gained by deployed battle participants, level increases, saved choices for each eligible level-up move, and an evolution prompt at the next route choice                                  |
| Reward / recruit         | Clear comparison of available choices                                                                                                                                       |
| Result                   | Run outcome and newly unlocked content                                                                                                                                      |

Use crisp pixel rendering, consistent tile size, and readable icons. Type and status information must appear in text or symbols as well as color. The initial build uses the original generic placeholder sheets in `public/assets/animations/`. The [animation asset guide](ANIMATION_ASSETS.md) defines every file name, direction row, frame range, playback trigger, and replacement step. Record the source and permission of any later artwork intended for distribution.

On the grid, face a Pokémon toward its next movement tile or attack target. Play movement between tile centers, attack toward the target, hurt on a successful damaging hit, and a separate one-shot effect for buffs, debuffs, healing, weather, and Mega Evolution. Return to directional idle after an action; play faint before removing a Pokémon. Finish the visible action sequence before showing the next AV-queue activation, while keeping animation timing separate from combat calculations.

## Technical approach

- **Vite + TypeScript** for the web project and typed game data.
- **Phaser** for the tile board, sprites, selection, and battle animation.
- **React** for menus, route choices, move panels, and other interface elements.
- **Pure TypeScript combat rules** that receive an action and return the next game state. Rendering should read that state rather than own the rules.
- **JSON or TypeScript data files** for Pokémon, ordinary evolution and Mega forms, abilities, moves and level-based learnsets, held items, run artifacts, XP thresholds, type matchups, encounters, and maps.
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
- [ ] **5. One complete run:** add the 20-Pokémon owned-run roster, six-point starting draft, six-Pokémon battle selection, participant-only XP, level gains, between-encounter evolution and move learning, move loadouts, ten-column route choices, rewards, recruitment, healing, stores, a separate run-wide artifact collection and effects, boss objective, and result screens.
- [ ] **6. Presentation and persistence:** load the named placeholder animation sheets and manifest, animate directional grid actions and effects, add terrain and UI placeholders, sound, readable UI, browser saving, and a small set of unlocks.

## Early build completion criteria

The build is ready for broader content work when a player can draft a starting roster within six points, grow to a maximum of 20 owned Pokémon, choose up to six for each battle, and finish a ten-column run in the browser. Award XP only to battle participants, evolve an eligible Pokémon without losing its moves, choose replacements for level-up moves, teach compatible TM moves from the Bag, equip and use held items including one Mega Stone, collect and review separate run-wide artifacts, command the deployed Pokémon through Attack / Move / Special without confusing turn rules, read terrain and weather effects before choosing an action, understand why a move will help or hurt, make meaningful route choices, and return after a refresh with the roster, artifacts, and unlocks intact.

After that milestone, expand the roster and maps, introduce the remaining types, and tune encounter difficulty from actual play sessions.
