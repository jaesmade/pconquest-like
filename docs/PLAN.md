# Pokémon Tactics Roguelike — Early Build Plan

## Goal

Build a playable browser prototype of a Pokémon fan game inspired by the tactical battles of Pokémon Conquest and the replayable routes of a roguelike. The player commands several Pokémon on a tile grid, wins short battles, chooses a route, recruits teammates, and faces a final battle. The early build should establish whether positioning, type matchups, and team composition are fun before adding a large roster.

## First playable run

1. Choose one of six starting Pokémon: Bulbasaur, Squirtle, Lapras, Geodude, Pikachu, or Meowth. Two companions from that pool complete the initial run party of three; recruitment can grow it to six.
2. Choose a path through a small branching route map.
3. Before each battle, choose three available Pokémon from the run party to deploy. Fight three regular encounters, with a choice of a rest or recruit node between battles.
4. After each encounter, give XP to every Pokémon in the run party, offer any eligible evolutions, and teach moves unlocked by their new levels before the next encounter.
5. Fight a boss encounter with a distinct map and objective.
6. See a win or loss screen. Save an unlock that changes a future run.

Target run length: about 15–25 minutes once the player understands the controls.

## Early build scope

| Area                 | Initial target                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Battle size          | Three Pokémon per side on an 8×8 square grid                                                                                        |
| Run party            | Up to six Pokémon; choose three to deploy before each battle                                                                        |
| Maps                 | Two regular maps and one boss map                                                                                                   |
| Roster               | Six named starting Pokémon and at least two recruitable Pokémon, including a Fire user and a Mega-compatible species                |
| Types in encounters  | Normal, Fire, Water, Grass, Electric, Ground, Rock, and Ice                                                                         |
| Moves                | A growing pool of learned moves, with two equipped for battle, one passive ability, and a 1-in-24 critical chance on damaging moves |
| Growth               | Shared encounter XP for the whole run party, level-based move learning, and at least one evolution available during a run           |
| Held items           | One slot per Pokémon; Leftovers, Sitrus Berry, Assault Vest, X Attack, and one compatible Mega Stone                                |
| Battle animation     | Replaceable four-direction pixel sheets for idle, move, attack, hurt, buff, debuff, special, and faint states                         |
| Terrain              | Elevation, deep water, and lava hazards                                                                                             |
| Weather              | Sun, rain, snow, and sandstorm                                                                                                      |
| Encounter objectives | Defeat all opponents; boss battle adds a capture point                                                                              |
| Route nodes          | Battle, rest, recruit, and boss                                                                                                     |
| Persistence          | Local browser save for settings and unlocks                                                                                         |
| Controls             | Mouse or touch selection; keyboard shortcuts can follow                                                                             |

The rules and content format should accept all 18 Pokémon types even though the first roster is small. The two recruitable Pokémon beyond the named starters need final species choices. Later roster additions should be content work rather than a combat rewrite.

For future implementation, use stable content IDs, authored encounter definitions, map-defined spawns, a versioned save, and a battle renderer that reads map dimensions. See [the extension guide](SCALING.md) for the current code layout and the steps needed when adding content or new rule families.

## Battle rules

- Battles use rounds. Each living deployed Pokémon takes one turn per round, in descending effective Speed order; ties use the run's seeded random stream. Fainted Pokémon leave future orders.
- At the start of its turn a Pokémon gains `max(1, floor(effective Speed))` Action Points (AP). Sun, paralysis, and Mega form Speed changes affect this gain on its next turn. A Pokémon with Speed 10 gains ten AP per turn while one with Speed 1 gains one, so the faster Pokémon can take many actions during its turn without taking extra turns.
- **Move**, **Attack**, and **Special** each spend AP. Movement may be repeated while AP remains, including before or after an attack. A Pokémon may use exactly one Attack command per turn; Status moves count as that attack. Special remains available with sufficient AP. **Pass** ends the turn; unused AP carries into that Pokémon's next turn, capped at the highest defined move or item AP cost (four in the initial content). The turn also ends when AP reaches zero or the Pokémon faints.
- A move command can cover up to the Pokémon's Movement stat in tiles. Each traversed tile costs one AP, plus one AP for uphill elevation and one for active mud; hazards resolve on every entered tile.
- A unit cannot move through occupied or blocked tiles. Terrain may increase movement cost or block attacks.
- Selecting an equipped move highlights its range on the grid before a target is chosen. Targets that can be hit show their combined type effectiveness in both color and text; the move panel lists each reachable enemy's matchup. Selecting a target tile adds the affected area, hit chance, normal and critical damage, and the 1-in-24 critical chance before confirmation.
- A fainted Pokémon leaves the grid and remains unavailable until healed or revived at a route node.
- A regular battle ends when one side has no usable deployed Pokémon. If all deployed player Pokémon faint, the battle and run are lost even if healthy reserves remain. The boss battle requires the boss to faint and a player Pokémon to occupy the capture point.

### Run party and deployment

The run party holds at most six Pokémon. Before each encounter, show the full party and let the player select three with current HP above zero. If only one or two are available, they may enter with fewer than three; if none are available, the run ends. The selected Pokémon start on the battle grid, while the others remain reserves and take no turns or terrain and weather damage. There is no midbattle swapping in the early build.

Current HP, fainted state, level, XP, evolution stage, learned and equipped moves, and held item persist between encounters. Recruitment fills empty party slots until the party reaches six. Recruiting while full requires choosing one existing party member to replace. Save both the party and the selected deployment with the run so the next battle can show the previous selection by default.

### Pokémon stats

| Stat            | Purpose                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| HP              | Total health when the Pokémon starts at full health. Track current HP separately as it takes damage or heals.     |
| Attack          | Offensive stat used to calculate Physical move damage.                                                            |
| Defense         | Defensive stat used to calculate damage received from Physical moves.                                             |
| Special Attack  | Offensive stat used to calculate Special move damage.                                                             |
| Special Defense | Defensive stat used to calculate damage received from Special moves.                                              |
| Speed           | Determines turn order and AP gained at the start of each turn. Equal Speed ties are randomized.                   |
| Movement        | Maximum number of tiles the Pokémon can move in one Move command; AP pays the path's terrain cost.                 |

Speed and Movement are independent: a Pokémon can gain many AP without traveling far in one Move command, or travel farther per command while gaining fewer AP. Show the current round's remaining turn order and each Pokémon's AP gain.

## Terrain and elevation

Each map tile has an elevation level of 0, 1, or 2 and a terrain kind. Show height through tile edges or shadows as well as a visible height marker when a tile is selected.

| Terrain rule | Early build behavior                                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elevation    | Grounded Pokémon may cross a one-level change. Climbing one level costs one extra AP; a change of two levels is impassable. Flying Pokémon ignore these height limits and extra costs.                                                                           |
| High ground  | A ranged attack from a higher tile gains one tile of range. Obstacles and taller intervening terrain still block line of sight.                                                                                                                               |
| Deep water   | A species or form with swim or fly mobility may enter. Swimmers enter the swimming state while on water and show a ripple. Flyers remain airborne and show a shadow. Others treat deep water as impassable.                                                     |
| Lava         | A nonflying Pokémon takes 10% of its maximum HP, rounded up, when it enters lava, including when pushed onto it. It takes the same damage at each round boundary while there. Flyers pass over lava; Stealth Rock still affects them.                            |

The unit's saved mobility state updates on each tile entry and forced displacement. Mega forms may change flight or swim capability immediately. Terrain damage and timed effects resolve on tile entry or at the next round boundary. Display reachable tiles, movement cost, height, and expected hazard damage during movement preview.

## Weather

One weather state can be active at a time. An encounter chooses its starting weather from that map's allowed weather states. Weather damage modifiers multiply move damage after the type matchup; defensive boosts modify the relevant Defense stat during damage calculation. For this plan, “snow type” means **Ice type**.

| Weather   | Effect                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sun       | Fire move damage ×1.5; Water move damage ×0.5.                                                                                                                                             |
| Rain      | Water move damage ×1.5; Fire move damage ×0.5.                                                                                                                                             |
| Snow      | Defense ×1.5 for Pokémon with Ice as one of their types.                                                                                                                                   |
| Sandstorm | Special Defense ×1.5 for Pokémon with Rock as one of their types. Every 100 battle-time units, Pokémon without Rock, Steel, or Ground as a type lose 1/16 of their maximum HP, rounded up. |

Weather starts at battle time 0 and lasts 300 battle-time units in the early build, then returns to clear weather. Resolve sandstorm damage before an action scheduled at the same time. Show the active weather, remaining duration, and next sandstorm damage tick beside the turn queue. Weather never changes a type's immunity.

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

These six Pokémon are the initial starter choices. Their two listed moves are suggested starting loadouts; additional moves can unlock through the level-based learnset.

| Pokémon   | Type          | Ability                                                                                                                          | Starting moves         |
| --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Bulbasaur | Grass         | **Chlorophyll:** effective Speed ×2 while sun is active.                                                                         | Vine Whip, Tackle      |
| Squirtle  | Water         | **Torrent:** Water move damage ×1.5 while current HP is below 50% of maximum HP.                                                 | Water Pulse, Tackle    |
| Lapras    | Ice / Water   | **Water Absorb:** when hit by a Water move, take no damage or secondary effect and heal 25% of maximum HP, capped at maximum HP. | Ice Shard, Water Pulse |
| Geodude   | Ground / Rock | **Sand Veil:** while sandstorm is active, enemy moves targeting it have an 80% chance to hit.                                    | Rock Throw, Mud Slap   |
| Pikachu   | Electric      | **Static:** when hit by a contact move, has a chance to paralyze the attacker.                                                   | Thunder Shock, Tackle  |
| Meowth    | Normal        | **Technician:** damaging moves costing at most 2 AP deal 50% more damage.                                                         | Tackle, Tail Whip      |

Paralysis halves effective Speed for 200 battle-time units. Keep the chance for Static, Thunderbolt, Ember's Burn, and Thunder Shock's chain in move and ability data for balance tuning. An attack that misses applies neither damage nor effects; Water Absorb intercepts a Water move after it hits and before damage. A Fire Pokémon for Ember and Sunny Day, plus one additional recruitable Pokémon that can use the initial Mega Stone, still need species choices.

## Move design

Each move record has a type, category, power, range, target shape, AP cost, contact tag, and optional effects. Category is **Physical**, **Special**, or **Status**. Physical damage uses Attack and Defense; Special damage uses Special Attack and Special Defense. Status moves normally have no damage calculation. Moves have 100% base accuracy unless an effect such as Sand Veil modifies hit chance. A move must hit before it rolls for a critical hit or secondary effect.

The former cooldown tiers are AP costs in the early build: standard moves cost 1 AP, Stealth Rock costs 2, Thunderbolt costs 3, and major weather moves cost 4. A Pokémon chooses one equipped move for its single Attack command each turn. Speed determines the AP gained each round.

Each hit from a damaging Physical or Special move has a **1-in-24 critical chance** (about 4.17%). On a critical hit, multiply the final nonzero move damage by **1.5**, after stats, type effectiveness, same-type bonus, and weather are applied. Roll separately for each target of an area move. Type immunity still results in 0 damage. Status moves and damage from weather, terrain, or ongoing conditions cannot critically hit in the early build. Mark critical hits in the battle animation and action log.

Target shapes for the early build are single unit, small area, and self. The current effect vocabulary includes damage, Burn, paralysis, push and pull, stat stages, chain damage, weather, and temporary terrain effects; the data model can add more effect families later. Paralysis halves effective Speed while it lasts and therefore lowers AP gained at the next turn. Status and hazard durations use battle time, which advances by 100 after each round. Damage over time resolves at round boundaries.

Tail Whip, Harden, and Howl each change the relevant stat by one stage. For the early build, each stage is a 1.25× multiplier, stages are capped between −2 and +2, and each change lasts 200 battle-time units. Reapplying a change at the cap refreshes its duration. Show the affected allies and enemies before confirming an area Status move.

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
| 1        | Tail Whip     | Normal / Status    | Self-centered 3×3 area                              | Lowers Defense of **all** Pokémon in the area, including allies and the user. |
| 1        | Harden        | Normal / Status    | Self                                                | Raises the user's Defense.                                                    |
| 1        | Howl          | Normal / Status    | Self-centered 3×3 area                              | Raises Attack of allied Pokémon in the area, including the user.              |
| 2        | Stealth Rock  | Rock / Status      | Place a 3×3 zone within 3 tiles                     | Pokémon entering the zone take hazard damage.                                 |
| 3        | Thunderbolt   | Electric / Special | 2×2 area placed within 4 tiles on the square grid   | Strong damage; chance to paralyze each hit target, halving its Speed.         |
| 4        | Sandstorm     | Rock / Status      | Whole battlefield                                   | Replaces the current weather with sandstorm and resets its duration.          |
| 4        | Sunny Day     | Fire / Status      | Whole battlefield                                   | Replaces the current weather with sun and resets its duration.                |

Stealth Rock lasts 200 battle-time units and deals 1/8 of maximum HP, rounded up, when a Pokémon enters any tile in its 3×3 zone. It affects both teams and Flying Pokémon; one active zone per caster can exist, and a new placement replaces the old one. Sandstorm and Sunny Day use the weather effects above. Thunderbolt uses a 2×2 target area that can be placed within four tiles on the square grid.

Mark contact separately from damage category: Tackle and Vine Whip are contact moves for effects such as Static. Move names, power, and chance values can be tuned after battles are playable.

Use level-based learnsets to introduce the stronger and utility moves during the run: Pikachu can learn Thunderbolt, Geodude can learn Harden, Stealth Rock, and Sandstorm, Meowth can learn Howl, and the Fire recruit can learn Sunny Day. The final learnset levels should let players see new options across the regular encounters without giving every move at the start.

## Held items and battle commands

Each Pokémon may hold one item. The run also has a small bag for unequipped items; the player assigns or swaps held items during battle preparation. A consumed item leaves its slot empty and is removed from the run. Passive and automatic items work only while their holder is deployed and alive.

| Item                  | Trigger and effect                                                                                         | Use                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Leftovers             | Heals 1/16 of maximum HP, rounded up, every 100 battle-time units while deployed.                          | Passive; remains held.                                |
| Sitrus Berry          | When HP falls to 50% or below but stays above 0, immediately heals 25% of maximum HP, rounded up.          | Automatic; consumed after one trigger.                |
| Assault Vest          | Multiplies Special Defense by 1.5 while held. The holder cannot choose Status-category moves.              | Passive; remains held.                                |
| X Attack              | Doubles the holder's Attack until the current battle ends.                                                 | Choose **Special → Use X Attack**; consumed on use.   |
| Compatible Mega Stone | Changes its holder into its defined Mega form, replacing its ability and applying that form's stat values. | Choose **Special → Mega Evolve**; stone remains held. |

The battle action UI has three primary commands: **Attack**, **Move**, and **Special**, plus **Pass**. Attack opens the Pokémon's two equipped moves, including Status-category moves unless an item such as Assault Vest blocks them. Selecting a move shows its AP cost, range, and type matchups before confirmation. Move previews tiles reachable with current AP and Movement. Special shows an available held-item action, such as X Attack (2 AP) or Mega Evolve (3 AP). Passive and automatic held items display their effects here but do not require a command. Attack becomes unavailable after one move use; movement and Special can still spend remaining AP.

A Mega Stone can be equipped only by its compatible Pokémon. For the early build, include one Pokémon with a defined Mega form and its matching stone. Mega Evolution is available once per holder per battle, takes effect immediately, and lasts until that battle ends. The Pokémon then returns to its normal form with the same current HP. Each Mega form defines its own higher stats and replacement ability; if Speed changes, use the new Speed when scheduling its next turn. Show the stat and ability changes before the player confirms Mega Evolution.

## Roguelike progression

Combat rounds contain one turn for every living deployed Pokémon. After every encounter, award the same encounter XP to every Pokémon currently in the run party, including reserves and fainted Pokémon. Each Pokémon tracks its own level and accumulated XP. Level gains update its stats, and a newly recruited Pokémon starts near the current party level so it is useful in the next battle.

Resolve XP and level gains after the battle, then show an evolution step before the next encounter. If a Pokémon meets its species-specific evolution requirement, the player can evolve it then or defer the choice to a later intermission. Evolution changes its species form, stats, and any defined type or ability; it remains evolved for the rest of that run. Show a before-and-after preview, keep its held item, and preserve its battle damage: an unfainted Pokémon gains only the increase in maximum HP, while a fainted Pokémon stays at 0 HP. Mega Evolution remains a separate temporary battle form. Include at least one ordinary evolution line with a threshold reachable during the early run.

After XP and any evolution choice, check every party Pokémon's current form and level against its level-based learnset. Teach all newly eligible moves, including moves from an evolved form that the Pokémon already qualifies for. This check happens after every encounter for deployed Pokémon, reserves, and fainted Pokémon alike. Show each new move and let the player equip it in one of two battle move slots, replacing an equipped move if necessary; declining to equip does not erase the learned move. The player may change the two equipped moves during battle preparation. Recruits arrive knowing all moves available to their form at their starting level. For the early build, arrange XP thresholds and learnsets so at least one party member can learn a move after each regular encounter.

Generate a short route from authored node templates so each run offers different choices while every branch remains viable. After the XP, evolution, and move-learning steps, a won battle awards one choice from a small set of healing, recruitment, held items, upgrades to already learned moves, or team improvements. A recruit node offers a choice of Pokémon, with the player replacing a teammate if the party already has six. A rest node heals or revives one teammate. The boss rewards completion and a permanent unlock.

Permanent unlocks should add variety, such as a new starter, recruit, map, or item. The first release needs only a few unlocks and one region. Store the current run and unlocks locally so a browser refresh does not erase progress.

## Screens and interaction

| Screen                   | Needed information and actions                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start                    | New run, continue run, settings                                                                                                                                             |
| Starter choice           | The six named starter options, their types, abilities, starting moves, and two accompanying party members                                                                   |
| Route map                | Upcoming node choices and current health of all six party slots                                                                                                             |
| Battle preparation       | Full party, HP and status, learned and equipped moves, held items and bag, three deployment slots, and encounter terrain and weather                                        |
| Battle                   | Grid, terrain height and hazards, weather, upcoming turn queue, objective, selected Pokémon, Attack / Move / Special commands, range preview, effectiveness, and action log |
| XP, evolution, and moves | XP gained by every party member, level increases, optional evolution previews, newly learned moves, and two-move loadout choices before the next encounter                  |
| Reward / recruit         | Clear comparison of available choices                                                                                                                                       |
| Result                   | Run outcome and newly unlocked content                                                                                                                                      |

Use crisp pixel rendering, consistent tile size, and readable icons. Type and status information must appear in text or symbols as well as color. The initial build uses the original generic placeholder sheets in `public/assets/animations/`. The [animation asset guide](ANIMATION_ASSETS.md) defines every file name, direction row, frame range, playback trigger, and replacement step. Record the source and permission of any later artwork intended for distribution.

On the grid, face a Pokémon toward its next movement tile or attack target. Play movement between tile centers, attack toward the target, hurt on a successful damaging hit, and a separate one-shot effect for buffs, debuffs, healing, weather, and Mega Evolution. Return to directional idle after an action; play faint before removing a Pokémon. Finish the visible action sequence before showing the next Speed-queue activation, while keeping animation timing separate from combat calculations.

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
- [ ] **5. One complete run:** add the six-Pokémon party, three-Pokémon battle selection, shared XP, level gains, between-encounter evolution and move learning, move loadouts, route choices, rewards, recruitment, rest, boss objective, and result screens.
- [ ] **6. Presentation and persistence:** load the named placeholder animation sheets and manifest, animate directional grid actions and effects, add terrain and UI placeholders, sound, readable UI, browser saving, and a small set of unlocks.

## Early build completion criteria

The build is ready for broader content work when a player can start with one of the six named Pokémon and finish a run in the browser, recruit up to six Pokémon and choose three for each battle, award XP to the entire party, evolve an eligible Pokémon, learn level-based moves after encounters and equip two for battle, equip and use held items including one Mega Stone, command the deployed Pokémon through Attack / Move / Special without confusing turn rules, read terrain and weather effects before choosing an action, understand why a move will help or hurt, make meaningful route choices, and return after a refresh with the party and unlocks intact.

After that milestone, expand the roster and maps, introduce the remaining types, and tune encounter difficulty from actual play sessions.
