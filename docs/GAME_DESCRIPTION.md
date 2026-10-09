# Pokémon Tactics Roguelike — Detailed Game Description

This document describes the game design through the planned run-wide artifact system. It brings together the current game scope, route and party decisions, battle rules, progression, and artifact proposal. It is a design overview rather than a claim that every planned feature is already in the build.

**Status:** The project is a playable browser prototype. Run-wide artifacts are design-only: they have no runtime catalog, save state, rewards, or effects yet. Artifact examples and numbers below are proposals, and several rules remain open.

## The game in brief

Pokémon Tactics Roguelike is a single-player tactical roguelike about leading a small Pokémon squad through a branching campaign. The player drafts a team, picks a route through battles and resource stops, positions Pokémon on tile-based battlefields, and shapes the team through experience, recruitment, items, and evolution. A run builds toward a final boss whose defeat is not enough on its own: a Pokémon must also claim the battlefield's capture point.

The central challenge is to turn a limited deployment into a flexible squad. Type matchups matter, but so do movement, attack range, terrain, action timing, health carried between encounters, and decisions about where to spend coins or which route risks to take. The route and encounter generation use seeded randomness so a run can vary while remaining consistent once it has been created.

The campaign's story and setting are not defined by the current design documents. Its focus is the tactical expedition and the changing team built over one run.

## Starting a run and building a team

At the start of a run, the player drafts Pokémon from an eligible catalog using six party points. Most species cost two points, so the standard budget usually buys three Pokémon. The draft has no duplicate species. A run can eventually own up to 20 Pokémon, but only six can enter a battle. This makes the opening choice a starting core, not a requirement to fill every deployment slot immediately.

**Planned starter progression:** New profiles would begin with the six fixed starters: Bulbasaur, Squirtle, Lapras, Geodude, Pikachu, and Meowth. Pokémon successfully recruited during a finished run would become permanent starter choices after either victory or defeat. They would start fresh when drafted in a later run. The current build still offers all eight starter/recruit species immediately; the [party builder plan](PARTY_BUILDER.md#recruitment-based-starter-unlocks-proposal) covers the proposed unlock, restart, and save rules.

The run party includes both the battle lineup and reserves. Before each battle, the player chooses up to six healthy Pokémon and places them in the ally deployment zone on the top-down battlefield. The opposing team enters from the other side. There is no mid-battle swapping in the early design, so deployment and unit choice matter before the first action. Reserves stay out of combat and avoid battle terrain and weather damage, but their HP and fainted state persist from earlier encounters.

Each Pokémon has HP, Attack, Defense, Special Attack, Special Defense, Speed, and Movement. Speed controls how frequently it gets an action; Movement controls how far it can travel in a Move command. They are separate strengths. Species types, abilities, learned moves, held item, level, and current condition all contribute to a Pokémon's role in the squad.

## Choosing a path

A run follows a seeded, branching route of ten progression columns. The route is shown as a map that climbs toward a boss in column ten. In each step, only connected nodes in the next column are available, so the player chooses among reachable opportunities rather than freely jumping ahead.

The route combines several kinds of stop:

- **Battle nodes** pit the team against 3–8 Normal opponents by level (3–5 on this floor). A win awards 65 XP to each Pokémon deployed in that battle, including battlers that faint; reserves receive no battle XP. The reward is 10 coins.
- **Elite battles** field 1–3 Elites plus 3–5 Normal escorts and award 85 XP to each Pokémon deployed in that battle, including battlers that faint; reserves receive no battle XP. The reward is 20 coins.
- **Healing nodes** restore HP and revive every owned Pokémon, including reserves.
- **Stores** let the player spend coins on held items and single-use Technical Machines. The Bag holds unequipped items and TMs; held items occupy a separate slot on each Pokémon.
- **Special events** have a 75% chance of a positive result and a 25% chance of a negative result. Positive outcomes grant 50–100 coins in 10-coin steps, a Sitrus Berry, or 25% roster-wide healing. Negative outcomes remove half the coins or deal 20% HP damage across the roster. The result is saved when entered and claimed from its event screen.
- **Recruitment nodes** offer a choice of three Pokémon. A recruit joins the owned roster, and a full roster requires the player to release one member first; that member's held item returns to the Bag.
- **The boss node** ends the route and tests the squad on a dedicated battlefield.

The route design guarantees opportunities such as healing, shopping, special events, and recruitment while the exact links and other node placements vary by seed. Taking a battle can strengthen the team and earn currency; taking a stop can stabilize the run or broaden its options. Because damage and fainting carry over, route choice also manages the squad's ability to survive later encounters.

## Tactical battles

Battles take place on square tile grids rendered from a non-isometric top-down view. Maps use authored terrain and deployment areas. Height, blocked tiles, deep water, lava, temporary hazards, and line of sight can change which routes are safe and which targets can be reached. Weather such as sun, rain, snow, or sandstorm can alter battle conditions. The boss encounter adds a capture tile as a second objective.

### Speed-based action order

Combat uses a continuous Action Value timeline instead of alternating complete team turns. Each living unit has a scheduled next action; the unit with the lowest scheduled value acts next. Speed determines the wait until its following action, so a fast Pokémon may act more often over time while a slower one waits longer. If Speed changes while a unit is waiting, its remaining time is recalculated. A field effect such as Trick Room can reverse the usual relationship and make slower Pokémon act sooner and more often while it lasts.

At the start of each action, the Pokémon gains three Action Points (AP), added to AP it saved from an earlier action in the same battle. It can issue one Move command per action, costing one AP regardless of distance, up to its Movement range. It can also make one Attack command: choosing one of its equipped moves, including a Status move, is that attack, and the move spends its listed AP cost. Special actions, such as using X Attack or Mega Evolving, can use remaining AP. Passing ends the action and banks unused AP for that Pokémon's next action. Banking AP never grants another Move or Attack command during the same action.

### Attacks, positioning, and matchups

Every battle-ready Pokémon has four equipped moves and a given passive ability. Its hidden ability starts locked; using an Ability Patch activates both passives together. An Ability Capsule replaces the given slot or unlocked hidden slot with one of three saved random choices. New runs receive one of each item in the Bag for testing. Hidden assignments currently reuse existing abilities as temporary choices; the [ability guide](ABILITY_OVERHAUL_PLAN.md) lists them. Damaging moves are Physical or Special, which determines the offensive and defensive stats used. Status moves can change stats, apply conditions, alter weather or the field, create hazards, or affect action timing. Attacks can target a unit or an area, and some can push or pull targets or otherwise alter the board.

The 18-type effectiveness chart applies to single and dual types, with type immunity preserved. Same-type attacks receive a bonus, and each damaging move has a 1-in-24 chance to critically hit. Before committing, the player can inspect move range, reachable enemies, type effectiveness, affected tiles, hit chance, and estimated normal and critical damage. Solid walls, trees, and rocks block aim points and can obstruct attacks through them; area previews and enemy decisions follow the same visibility rules.

Abilities, held items, terrain, weather, and timed effects add tactical conditions to those choices. For example, an ability might become stronger in a specific weather, a held item might heal its wearer once, and a hazard might punish units that cross a marked area. Passive and automatic held items work while their holder is deployed and alive. A fainted Pokémon leaves the battlefield and cannot return until revived at a route stop.

Regular encounters are won by defeating the opposing deployed team. If all of the player's deployed Pokémon faint, the run is lost even when healthy reserves remain. The boss must be defeated and a surviving player Pokémon must occupy the capture point to complete the campaign.

## Growing and managing the roster

After a battle victory, each Pokémon deployed in that battle receives the encounter's XP award, including deployed battlers that faint. Reserves do not gain battle XP. Level gains improve applicable combat stats and can unlock moves. New recruits begin at the highest owned level and arrive with their latest four distinct level-eligible moves (fewer if unavailable), as do wild opponents at their encounter level. Owned Pokémon keep their selected moves after joining.

When a Pokémon becomes eligible to learn a move, the post-battle growth screen offers the move. The player may replace one of the four active moves or keep the current moves; all pending choices must be resolved before moving on. At a later route choice, an eligible Pokémon can evolve or defer evolution. Ordinary evolution lasts for the rest of the run and updates the Pokémon's form, stats, and defined types while retaining its chosen abilities, hidden unlock, move slots, and held item. Mega Evolution is different: a compatible stone temporarily changes the Pokémon's battle form and ability profile for one battle, including the Mega form's hidden passive if unlocked, then the run party returns to its ordinary species form and chosen abilities.

HP, fainted state, level, experience, evolution, active moves, learned-move history, chosen abilities, hidden unlocks, and held items connect one encounter to the next. A healing node can restore the whole owned party, while other route rewards can help the player conserve that recovery for later. The Bag holds unequipped held items, TMs, evolution items, and ability items; a Pokémon's held-item slot is separate. Single-use upgrades are consumed only after a valid choice. A pending Capsule offer must be resolved before route progression and retains its choices after reload.

## The final encounter and run outcome

Normal encounters scale from three to eight Normal enemies with level. Elite encounters contain one to three Elites and three to five Normals; Boss encounters always contain one Boss, zero to two Elites, and two to five Normals. Normal, Elite, and Boss units have intrinsic 1×, 2×, and 3× HP, Attack, Defense, Special Attack, Special Defense, and Speed respectively; temporary buffs/debuffs apply separately and Movement is unchanged. Preparation shows the actual roster, ranks, and moves before entry.

The route culminates in a level-21 fight on Ancient Heartwood with one Charmander Boss, two Elites, and five Normals. A victory awards 100 XP to each deployed participant, including a deployed battler that faints, and 30 coins. Reserves receive no battle XP. Defeating every opponent completes only the first half of the objective: the player must also move a living Pokémon onto the capture tile. Winning produces the run result and increments the permanent win counter. Losing ends the current attempt. Recruitment-based starter rewards after either outcome remain planned, as described above. Save v28 preserves rank, owned moves, pending level-up choices, chosen abilities, hidden unlocks, and pending Capsule offers. Active v27 battles continue with hidden slots locked; pre-v27 battles restart at preparation for the encounter rules. Party and route progress remain.

## Run-wide artifacts — planned system

Artifacts are proposed as powerful modifiers collected during a run. An artifact belongs to a dedicated collection and affects the run globally; it does not occupy a Pokémon's held-item slot or the Bag. Once acquired, it is intended to remain active until that run ends, when the collection resets. The route and preparation screens are planned to let the player inspect active artifacts and their effects.

The proposed catalog has up to 20 unique artifact definitions: 10 standard artifacts with beneficial effects and 10 cursed artifacts with a meaningful drawback or condition. Each definition would have one of five rarities: common, uncommon, rare, epic, or legendary. Legendary artifacts could only come from question-mark special-event nodes. The odds for the other rarities, other acquisition sources, duplicate rules, and how many artifacts can be held in one run still need decisions.

The current examples show the range of possible effects, not a finalized reward list:

| Example | Proposed run effect |
| --- | --- |
| Exp Share | Give battle XP to Pokémon not deployed in a battle and apply a bonus to that shared XP. The exact bonus remains open; the base reward currently goes only to deployed participants. |
| Eevee Plush | If the full deployed lineup consists of Eevee or its evolutions, double their Attack, Defense, Special Attack, Special Defense, and Speed for that battle; HP is unaffected. |
| Pokéblocks | Restore up to 50% of maximum HP to the roster after battle. Whether it restores missing HP or can revive fainted Pokémon is undecided. |
| Coin Case | Grant damage and damage-resistance bonuses based on the coins held. The formula and safety cap need definition. |
| Odd Keystone | If the owned roster has no Ghost type after battle, impose an HP penalty. Whether the penalty uses current or maximum HP is undecided. |
| Magma Stone | Burn the deployed player team at the start of battle. Whether reserves are affected is undecided. |

An artifact offer is intended to be saved as soon as it is generated, so refreshing cannot reroll or claim it twice. Its category, rarity, complete effect, timing, affected Pokémon, and any downside should be clear before the player accepts. Effects may apply at run, between-battle, or battle-start timing, so the implementation will need explicit stacking, scope, and save rules before artifacts enter the playable campaign.

## Design references

- [Game scope and rules](PLAN.md)
- [Ability overhaul](ABILITY_OVERHAUL_PLAN.md) — given and hidden abilities, Ability Capsule, Ability Patch, temporary assignments, and save behavior
- [Ten-column route and deployment](ROUTE_OVERHAUL.md)
- [Starting party draft](PARTY_BUILDER.md)
- [Run-wide artifact proposal](ARTIFACTS_PLAN.md)
- [Current prototype and project record](PROJECT_MASTER.md)
