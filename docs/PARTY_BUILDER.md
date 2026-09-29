# Point-budget party builder

## Purpose and visual reference

The New Run selection screen uses the supplied 3.png layout as its broad guide: an aqua grid background, a raspberry-bordered frame, a removable **Your Party** column at left, and a light Pokémon catalog at right. The frame now uses the game's paper and aqua palette, with a shared header and a persistent stat inspector. Current content IDs, stats, and game rules remain authoritative.

## Rules

- A new run starts with **6 party points**.
- Standard species cost **2 points**. Species.partyCost can override this for later balance/content work; the shared default is in src/content/roster.ts.
- The selected starting roster costs no more than the point budget and contains no duplicate species.
- A run may own up to **20 Pokémon total**, including deployed members and reserves. Recruitment route nodes add one of three Pokémon, including rare non-starters; special encounter nodes do not recruit.
- Solo preparation deploys at most **6 Pokémon** per encounter after the player recruits enough members. Point budget and owned-roster capacity do not change the starting draft.
- Candidate stats use the run's starting level (currently level 10) and the authoritative statsAtLevel calculation. Movement remains its species tile-range value.

## Screen layout and interaction

The opening draft now uses a full-width header, a compact team column, and a larger catalog. The six-point meter stays visible beside the selected roster. Every current starter fits in one desktop row at a typical 1265-pixel viewport; larger catalogs scroll within the panel. A persistent stats panel shows the first visible choice until a Pokémon is hovered, focused, or selected. Type-colored edges and labels distinguish species while the art is still a shared placeholder.

| Region | Behavior |
| --- | --- |
| Back arrow | Returns to the title menu before committing the draft. |
| Your Party | Lists selected Pokémon, their type and point cost, and a remove action. A six-segment meter shows spent draft points. Text explains that the owned roster may later grow to 20. |
| Search | Filters current eligible starter/recruit species by name, type, or ability. |
| Type filter | Narrows choices by one of their types and returns to page one. |
| Point balance | Shows six starting points minus the selected species costs. Unaffordable entries remain focusable for inspection but cannot be added until points are freed. |
| Species catalog | Displays a portrait, name, type, selection mark, and cost. Click, Enter, or Space toggles an affordable choice. The catalog is paged in groups of 20 for future roster growth. |
| Stats inspector | Updates on mouse hover or keyboard focus with level, type, ability, HP, Attack, Defense, Special Attack, Special Defense, Speed, and Movement. Selection keeps the most recently selected Pokémon visible when hover/focus ends. |
| Start Run | Commits the draft, creates the selected Pokémon at the run start level, and enters the route. Disabled until at least one species is chosen. |

On narrow screens, the party list moves above the catalog and scrolls horizontally while the catalog scrolls vertically. The seven stats wrap to four columns on phone widths. The catalog remains searchable, filterable, and paged. Focusable controls use native buttons and inputs; the stats inspector also updates on keyboard focus. Each Pokémon's placeholder portrait is differentiated by its name and type color until species-specific art is added.

## Data and save behavior

- src/content/roster.ts owns STARTING_PARTY_POINTS, MAX_RUN_POKEMON, and the default/override cost lookup.
- src/content/species.ts defines the eligible species and may set optional partyCost.
- src/ui/PartyBuilder.tsx renders the draft without mutating the run until Begin Run. Its layout is isolated in src/styles/party-builder.css rather than the title menu stylesheet.
- src/game/engine.ts validates draft points and enforces the 20-owned cap during creation/recruitment.
- src/persistence/save.ts writes schema v17 and migrates existing saves without dropping any of their Pokémon. Existing v14 and v15 rosters were already below the new cap.

The initial catalog combines unique starter and recruit IDs and excludes temporary Mega forms. Ordinary evolutions appear later through progression rather than as separate initial draft choices. To add more choices, add species content and register the ID in STARTERS or RECRUITS; set a positive integer partyCost only when its cost should differ from two.

## Review checklist

- The screenshot's left/right structure remains legible at desktop size; at mobile widths the panels stack and the catalog stays reachable.
- Three standard species exactly spend six points. Adding a fourth is blocked until a species is removed or an override makes the selected costs fit.
- Hover and focus both update the same stat inspector, with values taken from the actual game stat calculation. Unaffordable choices can still be inspected.
- No draft mutates the run until Start Run. Back returns to the title screen.
- Recruit, save validation, and roster display all use the shared 20-Pokémon cap; battle preparation caps deployment at six.
