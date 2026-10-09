# Point-budget party builder

## Pixel interface update (2026-10-06)

The draft uses species-specific pixel portraits from `src/ui/SpeciesPortrait.tsx`, square frames, pixel point segments and larger remove/page controls. Selection changes announce remaining points; unavailable species remain inspectable, empty filters offer a reset, and keyboard focus takes priority over hover in the stat inspector. The six-point budget and selection rules are unchanged. Shared styling and the isolated review page are documented in [UI overhaul](UI_OVERHAUL_PLAN.md).

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
- src/persistence/save.ts writes schema v27 and migrates valid existing saves without dropping their Pokémon. Existing v14 and v15 rosters were already below the new cap.

The current initial catalog combines unique starter and recruit IDs and excludes temporary Mega forms. Ordinary evolutions appear later through progression rather than as separate initial draft choices. Under the current implementation, registering a species in either `STARTERS` or `RECRUITS` makes it immediately draftable; set a positive integer `partyCost` only when its cost should differ from two. The recruitment-based proposal below replaces this catalog rule when implemented.

## Recruitment-based starter unlocks (proposal)

**Status: planned, updated 2026-10-06; no starter gating or recruitment unlocks are implemented.** The player starts with a fixed starter set. After each finished run, Pokémon successfully recruited during that run become permanent starter choices for future runs. This replaces the earlier first-clear/diverse-team/deployed-recruit achievement proposal.

### Current implementation checked

- `src/content/species.ts` defines six `STARTERS`; `RECRUITS` adds Vulpix and Charmander. `src/ui/PartyBuilder.tsx` merges both lists, so all eight are currently available immediately.
- `newRun` in `src/game/engine.ts` checks known species, temporary forms, and draft cost, but does not enforce starter eligibility. An engine guard is needed alongside the UI change.
- `resolveSpecial` validates recruit offers and full-roster replacements. Evolution changes a party member's species and release removes the member; there is no saved recruitment history.
- `Run.unlocks` is a numeric win count. `freshRun` and `newRun` carry it between runs; save v27 stores one run without a separate profile. Losses reach results through `completeBattle` or a no-usable-deployment `startBattle`; wins reach results through final `advanceRoute`, after the boss intermission.

### Starter availability and reward rules

Use the existing `STARTERS` as the proposed fixed set for new profiles:

| Always available | Species ID |
| --- | --- |
| Bulbasaur | `bulbasaur` |
| Squirtle | `squirtle` |
| Lapras | `lapras` |
| Geodude | `geodude` |
| Pikachu | `pikachu` |
| Meowth | `meowth` |

- Future draft availability is the unique union of the fixed starter set and the profile's earned species IDs. Route recruitment remains independent: locked starters must still be recruitable during a run. Adding a species to `RECRUITS` must no longer grant immediate starter access.
- Interpret **each finished run** as both victory and defeat. A boss clear or deployment of the recruit is not required. Returning to the title or refreshing an unfinished run does not finish it. Proposed restart policy: replacing an unfinished run discards that run's pending unlocks; already earned choices remain available.
- Record the exact species ID when a Pokémon successfully joins the campaign roster, including a valid full-roster replacement. An offer, rejected selection, or canceled replacement gives no credit. Duplicate recruits, fixed starters, and already earned species produce no duplicate reward.
- Keep this history even if the recruit remains in reserve, faints, evolves, or is later released. Recruiting Vulpix and evolving it into Ninetales unlocks Vulpix; evolution alone does not unlock Ninetales. An evolved species explicitly recruited by future content would unlock that exact ordinary species. Temporary Mega forms are excluded.
- Drafted Pokémon, opposing Pokémon, and Battle Lab Pokémon give no recruitment credit. Future quest recruits should use the same successful-acquisition contract once their content exists.
- Starting an unlocked species creates a fresh Pokémon at the normal run start level, with its initial moves and normal draft cost. Prior level, XP, held item, HP, and chosen moves do not carry over. The six-point budget, duplicate prevention, 20-owned cap, and six-deployed cap remain unchanged.

Example: a new profile drafts Bulbasaur, Pikachu, and Squirtle, then recruits Vulpix. On victory or defeat, Vulpix becomes a starter choice. The next draft offers the six fixed starters plus Vulpix; Charmander stays locked until recruited in a finished run.

### Progression data and save migration

Proposed state separates permanent progress from the replaceable run:

| State | Proposed fields and purpose |
| --- | --- |
| Profile | `unlockedStarterSpeciesIds`: unique permanent non-base choices; `wins`: existing victory count, migrated from `Run.unlocks`; `lastFinalizedRun`: receipt containing run ID, outcome, and newly unlocked IDs for recovery. |
| Run | `runId`: stable attempt identity; `recruitedSpeciesIds`: unique species captured at successful acquisition; `newlyUnlockedStarterSpeciesIds`: saved result reward list; `progressionApplied`: local finalization guard. |
| Save envelope | `{ schemaVersion, savedAt, profile, run }`, with profile and result written in the same IndexedDB transaction. |

At every valid terminal transition, finalize progression once: subtract base/already earned IDs from the recorded recruits, merge the new choices into the profile, save the result list and profile receipt, and mark the run finalized. Check both the run guard and profile receipt before granting rewards or incrementing profile wins. Increment wins only for a victory. A normal encounter win or boss win still awaiting its intermission/route completion does not finalize the run. Apply this as a pure state transition, rather than a reward side effect of rendering the result screen.

Keep profile and run together in application state so result finalization, queued saves, and both New Run entry points use the same committed profile. Reset run history for a new attempt while retaining permanent choices. Request an immediate save for finalization; preserve ordered writes and the existing save-failure feedback. Returning to results after refresh must show the saved reward list without granting it again.

Ship with the next available save schema (currently v28), preserving existing run, battle, route, move, and backup migrations. Validate and deduplicate species IDs against known ordinary species. Load valid profile data independently of the run: restarting or rejecting a malformed run must not erase its valid profile. During current/backup recovery, retain the union of valid earned starter IDs and the highest valid win count. Preserve the latest valid finalization receipt and reconcile it with a recovered run's ID: an older snapshot of the same completed attempt must restore its recorded outcome/reward list rather than finalize it again. A run-only flag is insufficient when the newer profile survives but its newer run snapshot does not.

For a valid legacy save, migrate its numeric win count and grandfather the old immediately draftable extras, Vulpix and Charmander, as earned choices. New profiles begin with only the six fixed starters. This preserves existing players' available choices without making the two recruits defaults for new players. Freeze this legacy species list in migration code rather than consulting a future expanded `RECRUITS` list. Assign and persist a run ID during migration; mark an existing legacy result already finalized, with an empty new-reward list, so its victory is not counted again. Legacy saves lack recruitment provenance, so initialize run history empty and record subsequent acquisitions; do not infer other rewards from the final party or win count.

### Player presentation

- The party builder shows available starters plus locked recruitment candidates from the authored recruitment pool. Use **Recruit in a run to unlock for future runs** on locked cards. Cards remain focusable and inspectable but cannot be selected; preserve search, type filters, paging, stats, and affordability feedback. Future quest-only candidates need an authored acquisition source before they are shown.
- Recruitment confirmation explains that the chosen species will become a starter when the run ends. Already available species should say **Starter already available**. The unfinished-run restart dialog explains that pending recruit unlocks will be discarded.
- Both win and loss results show **New starters unlocked**, with portraits and names for only the new rewards, or **No new starters this run**. Keep this separate from the final-team display, since a credited recruit may have evolved or been released.

### Implementation sequence

1. Add profile/run types and a shared starter-availability/finalization helper (proposed `src/game/starterUnlocks.ts`); validate base/recruit content through `src/content/catalog.ts`. Use stable species IDs rather than achievement IDs.
2. Add profile-aware snapshot/load/save support and legacy migration in `src/persistence/save.ts`; adapt `src/main.tsx` and `src/app/App.tsx` to load, retain, and save profile with run. Update `freshRun` and both title/result New Run paths.
3. Record successful campaign recruitment in `src/game/engine.ts`, including replacement and the exported `recruit` helper's campaign contract. Cover every terminal loss/win path with the same finalizer. Require shared starter eligibility in `newRun`, including rejection of stale or manually supplied locked IDs.
4. Replace the module-level merged catalog in `src/ui/PartyBuilder.tsx` with profile-derived availability. Add recruitment/restart explanations and result rewards in `RouteStopScreen.tsx`, `App.tsx`, and `ResultScreen.tsx`, with matching styles.
5. Update scripted drafts and the isolated UI gallery to supply explicit earned profiles where they use Vulpix/Charmander. Add focused progression and migration checks, then mark this proposal implemented only after those checks pass.

### Acceptance checks for implementation

- A fresh profile offers six selectable starters; Vulpix/Charmander remain recruitable but locked in the draft. Direct `newRun` calls cannot bypass locks. An earned choice uses normal initial level/moves/cost and still respects points and duplicate rules.
- Recruiting Vulpix then winning or losing unlocks it exactly once. Cover battle defeat, no usable deployment, and final boss route completion. Nonterminal wins, title visits, offers, invalid/canceled recruitment, drafting, evolution, opponents, and Lab sessions do not bank rewards.
- Refresh after recruitment retains pending credit; refresh after results retains availability and the reward list. Reserves, fainting, evolution, release, repeated recruits, and full-roster replacement all follow the acquisition-time rule.
- New Run from title/results retains earned choices. Replacing an unfinished run drops only its pending credit. Returning to or repeatedly finalizing results cannot reaward species or increment wins twice.
- Legacy migration preserves the existing eight choices and win count without inferring undocumented recruits or recounting a completed result. A new profile still starts with six. Invalid species/form IDs, malformed runs, current/backup fallback, and save failures do not silently discard a valid profile. Pairing a newer profile with an older snapshot of the same run retains its original result rewards and cannot increment wins twice.
- Run `npm run build`, `npm run playthrough`, `npm run measure:save`, and `git diff --check` after implementation. Review locked cards, both result outcomes, restart explanation, keyboard navigation, and mobile layouts. These are planned checks; this documentation update does not implement or test runtime behavior.

## Review checklist

- The screenshot's left/right structure remains legible at desktop size; at mobile widths the panels stack and the catalog stays reachable.
- Three standard species exactly spend six points. Adding a fourth is blocked until a species is removed or an override makes the selected costs fit.
- Hover and focus both update the same stat inspector, with values taken from the actual game stat calculation. Unaffordable choices can still be inspected.
- No draft mutates the run until Start Run. Back returns to the title screen.
- Recruit, save validation, and roster display all use the shared 20-Pokémon cap; battle preparation caps deployment at six.
