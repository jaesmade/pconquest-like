# Point-budget party builder

## Purpose and visual reference

The New Run selection screen follows the supplied 3.png layout: an aqua grid background, a large gray frame with a raspberry border, a removable **Your Party** column at left, and a white **Create a Party** catalog at right. The screenshot is a visual reference for layout and styling; current content IDs, stats, and game rules remain authoritative.

## Rules

- A new run starts with **6 party points**.
- Standard species cost **2 points**. Species.partyCost can override this for later balance/content work; the shared default is in src/content/roster.ts.
- The selected starting roster costs no more than the point budget and contains no duplicate species.
- A run may own up to **20 Pokémon total**, including deployed members and reserves. Special route nodes can add a recruit while under the cap.
- Solo preparation deploys at most **6 Pokémon** per encounter after the player recruits enough members. Point budget and owned-roster capacity do not change the starting draft.
- Candidate stats use the run's starting level (currently level 10) and the authoritative statsAtLevel calculation. Movement remains its species tile-range value.

## Screen layout and interaction

| Region | Behavior |
| --- | --- |
| Back arrow | Returns to the title menu before committing the draft. |
| Your Party | Lists selected Pokémon, their type and point cost, and a remove action. Shows owned limit progress out of 20. |
| Search | Filters current eligible starter/recruit species by name, type, or ability. |
| Point balance | Shows six starting points minus the selected species costs. Unaffordable catalog entries are disabled until points are freed. |
| Species catalog | Displays a portrait, name, and cost. Click, Enter, or Space toggles selection. The catalog is paged in groups of 20 for future roster growth. |
| Stats inspector | Updates on mouse hover or keyboard focus with level, type, ability, HP, Attack, Defense, Special Attack, Special Defense, Speed, and Movement. |
| Start Run | Commits the draft, creates the selected Pokémon at the run start level, and enters the route. Disabled until at least one species is chosen. |

On narrow screens, the party list moves above the catalog and can scroll independently. The catalog remains searchable and paged. Focusable controls use native buttons and inputs; the stats inspector also updates on keyboard focus.

## Data and save behavior

- src/content/roster.ts owns STARTING_PARTY_POINTS, MAX_RUN_POKEMON, and the default/override cost lookup.
- src/content/species.ts defines the eligible species and may set optional partyCost.
- src/ui/PartyBuilder.tsx renders the draft without mutating the run until Start Run.
- src/game/engine.ts validates draft points and enforces the 20-owned cap during creation/recruitment.
- src/persistence/save.ts writes schema v17 and migrates existing saves without dropping any of their Pokémon. Existing v14 and v15 rosters were already below the new cap.

The initial catalog combines unique starter and recruit IDs and excludes temporary Mega forms. Ordinary evolutions appear later through progression rather than as separate initial draft choices. To add more choices, add species content and register the ID in STARTERS or RECRUITS; set a positive integer partyCost only when its cost should differ from two.

## Review checklist

- The screenshot's left/right structure remains legible at desktop size; at mobile widths the panels stack and the catalog stays reachable.
- Three standard species exactly spend six points. Adding a fourth is blocked until a species is removed or an override makes the selected costs fit.
- Hover and focus both update the same stat inspector, with values taken from the actual game stat calculation.
- No draft mutates the run until Start Run. Back returns to the title screen.
- Recruit, save validation, and roster display all use the shared 20-Pokémon cap; battle preparation caps deployment at six.
