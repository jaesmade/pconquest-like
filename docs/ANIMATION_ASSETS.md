# Animation asset guide

## Isometric battle environment and imported HUD art

The current battlefield uses the [isometric environment family](ISOMETRIC_ASSETS.md): raised grass, water, lava, and stone tiles plus trees, rocks, and flowers. Tile tops are 96×48 pixels and elevation adds 20 pixels per level. The old Kenney terrain tiles below are retained in the repository as replaceable source material, but the active Phaser board loads the isometric manifest. The Kenney HUD frames remain active.

The earlier top-down asset pass imported named 16×16 terrain tiles from [Kenney Roguelike/RPG Pack](https://kenney.nl/assets/roguelike-rpg-pack), version 1.0, and 32×32 HUD frames from [Kenney UI Pack – Pixel Adventure](https://kenney.nl/assets/ui-pack-pixel-adventure), version 2.0. Both source packs state CC0 1.0; Kenney credit is appreciated but optional. The [battle asset manifest](../public/assets/battle-asset-manifest.json) and [contact sheet](BATTLE_ASSET_PREVIEW.png) document that older family. The active environment art is listed in the isometric guide.

| Gameplay role                       | File family                                                        | Rendering                                                 |
| ----------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| Plain, water, lava, wall            | `public/assets/environment/isometric/iso-<kind>-h<level>-96px.svg` | Active 96×48 isometric tops with height-specific cliffs   |
| Trees, rocks, flowers               | `public/assets/environment/isometric/iso-<detail>-<width>px.svg`   | Decorative stamps on selected plain tiles                 |
| Temporary cover                     | `public/assets/environment/overlays/overlay-cover-16px.png`        | Dynamic sprite on tiles where cover is active             |
| Ally, enemy, target portrait frames | `public/assets/ui/hud/hud-portrait-<role>-32px.png`                | CSS background behind the placeholder unit-sheet portrait |
| Action panel frame                  | `public/assets/ui/hud/hud-panel-border-32px.png`                   | CSS border image; text and buttons remain HTML            |

Zone tints, move range, target effectiveness, shadows, and swim ripples remain overlays above terrain. Terrain is stamped once into a Phaser render texture so camera movement does not rebuild 1,024 tile objects. A map up to 32×32 can pan/zoom, and the minimap shows the projected visible window. Click mapping goes through `camera.getWorldPoint` and the isometric diamond lookup.

To reimport the Kenney archives, download `kenney_roguelike-rpg-pack.zip` as `roguelike.zip` and `kenney_ui-pack-pixel-adventure.zip` as `ui.zip` into a folder, install Pillow, then run `python scripts/import_battle_assets.py <folder>`. The script preserves existing PNGs unless `--force` is supplied. The imported HUD frames remain 32×32. To replace current terrain, follow the isometric guide and preserve the diamond bounds.

## Unit animation assets

The battle uses separate action strips from the user-supplied animation set in `public/assets/animations/units/placeholder/`. The [source XML](../public/assets/animations/units/placeholder/placeholder-source-anim-data.xml) records the original frame dimensions and timing. Every current species maps to this shared placeholder set until its own art is supplied. The older generated 640×128 combined sheets are no longer loaded.

The [animation manifest](../public/assets/animations/animation-manifest.json) maps species IDs to unit sets. Each set lists named clip URLs, frame dimensions, frames per row, row count, playback rate, loop flag, impact frame where applicable, and its facing-row mapping. `src/battle/unitAnimations.ts` resolves clip and set IDs.

| Clip | File in `units/placeholder/` | Frame | Layout | Playback | Purpose |
| --- | --- | --- | --- | --- | --- |
| `idle` | `placeholder-idle-32x40.png` | 32×40 | 5 frames × 8 rows | 5 fps, loop | Waiting |
| `walk` | `placeholder-walk-32x40.png` | 32×40 | 7 × 8 | 8 fps, loop | Moving |
| `attack` | `placeholder-attack-80x88.png` | 80×88 | 11 × 8 | 26 fps, once | Melee attack |
| `shoot` | `placeholder-shoot-64x64.png` | 64×64 | 12 × 8 | 25 fps, once | Ranged attack |
| `charge` | `placeholder-charge-32x40.png` | 32×40 | 10 × 8 | 30 fps, once | Status move, buff, debuff, item |
| `sleep` | `placeholder-sleep-32x40.png` | 32×40 | 7 × 1 | 6 fps, loop | Impaired resting state |
| `hurt` | `placeholder-hurt-56x56.png` | 56×56 | 2 × 8 | 12 fps, once | Hit reaction and faint fade |

The source row order is down, down-right, right, up-right, up, up-left, left, down-left. The logical grid directions `[south, west, east, north]` map to rows `[7, 5, 1, 3]` because those moves project down-left, up-left, down-right, and up-right on screen. Sleep has one row and uses it for every facing. For each clip, the frame index is `sourceRow × framesPerRow + frameIndex`. The unit scale is 1.65×. The common sprite center is 12 world pixels above the isometric tile center; keep a stable ground point across strips with different frame sizes.

**Normal is the portrait asset.** The optional `normal` URL in each unit set points to a standalone portrait PNG. No Normal file was present in the uploaded set, so the UI temporarily crops frame 0 of Idle. A future file can be named `placeholder-normal-portrait.png` and assigned to `normal` without touching battle animations.

Named item and status icons remain in `public/assets/ui/icons/`. Flight shadows and swim ripples are Phaser ellipses. The supplied `*-Offsets.png` and `*-Shadow.png` companions are not loaded; their data can guide a later anchor/shadow pass. The imported strips came from the user; their original creator and redistribution terms were not supplied.

## Attack effect files

Every initial move has a named attack sheet under `public/assets/animations/attacks/`. The `attacks` entry in the manifest maps the exact move-data key to its URL and playback style. The styles are `melee` (effect at target, no projectile travel), `projectile` (travel from attacker to target, then play at impact), `area` (play across affected cells), `self` (play on the user), and `weather` (brief board-wide cue). A newly added move without a manifest entry uses the shared `effect-attack-impact` sheet as a fallback.

| Move key       | PNG filename                    | Style      | Placeholder cue                            |
| -------------- | ------------------------------- | ---------- | ------------------------------------------ |
| `tackle`       | `attack-tackle-32px.png`        | melee      | Pale motion streaks                        |
| `ember`        | `attack-ember-32px.png`         | projectile | Orange flame                               |
| `vineWhip`     | `attack-vine-whip-32px.png`     | melee      | Green curved lash                          |
| `waterPulse`   | `attack-water-pulse-32px.png`   | projectile | Blue expanding ring                        |
| `thunderShock` | `attack-thunder-shock-32px.png` | projectile | Small yellow bolt; chain tile also flashes |
| `rockThrow`    | `attack-rock-throw-32px.png`    | projectile | Tumbling rock                              |
| `mudSlap`      | `attack-mud-slap-32px.png`      | projectile | Brown splash                               |
| `iceShard`     | `attack-ice-shard-32px.png`     | projectile | Ice crystal                                |
| `tailWhip`     | `attack-tail-whip-32px.png`     | area       | Purple sweep on affected Pokémon           |
| `harden`       | `attack-harden-32px.png`        | self       | Silver shield                              |
| `howl`         | `attack-howl-32px.png`          | area       | Expanding sound rings on allies            |
| `stealthRock`  | `attack-stealth-rock-32px.png`  | area       | Rock spikes across the 3×3 hazard          |
| `thunderbolt`  | `attack-thunderbolt-32px.png`   | area       | Large lightning bolts across the 2×2 blast |
| `sandstorm`    | `attack-sandstorm-32px.png`     | weather    | Brown wind streaks across the board        |
| `sunnyDay`     | `attack-sunny-day-32px.png`     | weather    | Sunbursts across the board                 |

`src/game/engine.ts` appends an attack visual event when a move is used. The event contains its move ID, attacker tile, selected target tile, affected tiles, units hit, and each hit target's HP after that action. `src/battle/Board.tsx` reads those events in order. The source strip's `impactFrame` sets the windup: Attack frame 4 for melee impact, Shoot frame 2 before a projectile or area effect, and Charge frame 5 for a Status effect. A projectile moves between tile centers after Shoot; its hit reaction begins when it arrives. Area effects, the Hurt strip, hit sound, and the board HP bar update together at impact. The rules, RNG, and battle log still commit immediately. The battle state retains at most 24 recent cues, and the renderer holds at most three waiting cues plus the one currently playing. If updates arrive faster than playback, `src/battle/visualQueue.ts` can drop older visual cues; the board then shows the latest authoritative state.

## Isometric grid animation behavior

| Event | Unit strip and cue |
| --- | --- |
| Waiting | Loop Idle in the current facing. Active `sleep`, `asleep`, or paralysis uses Sleep while resting; Burn keeps Idle and its status icon. |
| Moving | Loop Walk through the projected path at 375 ms per tile with constant travel speed. At the shared placeholder's 8 fps, roughly three Walk frames play per tile. The sprite chooses a new facing from each pair of adjacent grid tiles, including the first step from the saved starting tile, and returns to Idle or Sleep at the destination. Shadows and swim ripples travel at the same speed. |
| Melee damaging move | Play Attack based on `delivery: "melee"`; show the named move effect at the target. |
| Ranged damaging move | Play Shoot based on `delivery: "ranged"`; the named effect follows its projectile or area style. Physical and Special can both be ranged. |
| Status move | Play Charge, then its named area, self, or weather effect. Status moves have no attack delivery. |
| Buff, debuff, or item special | Play Charge. Existing shared bursts, icons, and callouts remain separate. |
| Successful hit | Start Hurt, hit audio, impact art, and the board HP update at the same impact moment. Survivors return to Idle or Sleep; fainted units fade out and are removed after the queued cue. |
| Weather | Sunny Day and Sandstorm play board-wide move effects. Persistent weather overlays remain future work. |

Flight shadows and swim ripples are currently Phaser ellipse overlays in `src/battle/Board.tsx`, named `shadow` and `ripple` in the unit marker map. They require no sprite-sheet frames. To replace them with artwork, add clearly named assets such as `public/assets/animations/effects/effect-flight-shadow-32px.png` and `effect-swim-ripple-32px.png`, then replace those two ellipse creations with loaded sprites while keeping the same ground positions and per-tile visibility rules. Species and Mega form mobility is defined in `src/content/species.ts`; tile transitions update it in `src/game/mobility.ts`.

The current battle scene faces the attacker along the first differing grid axis, draws the tile and elevation before the unit, and puts attack effects above sprites. Retained attack visual events play in committed order; a backed-up renderer can omit older cosmetic cues. The rules and round order determine results, and the latest unit state plus action log remain visible when a cue is omitted. Animation only temporarily locks player commands while retained cues play.

Keep pixel edges sharp by using nearest-neighbor texture filtering. A reduced-motion setting that shortens travel and skips decorative effects is still planned.

## Replacing placeholders with your art

1. Put transparent action strips under `public/assets/animations/units/<species-or-form-id>/`. Name each by action and frame size, such as `<id>-attack-80x88.png` or `<id>-idle-32x40.png`. Keep the character's ground point stable across clips.
2. Add a set under `unitSets` in the manifest. Each clip provides its own URL, frame width and height, frames per row, row count, fps, and loop flag. Set `facingRows` to match that set's source direction order. Species may have different frame sizes and counts.
3. Point the species or Mega species ID in `units` to its set ID. Leave it mapped to `placeholder` until its own art is available.
4. Assign a separate Normal portrait PNG to the set's `normal` URL. Until then, the first Idle frame serves as the portrait.
5. Replace named attack sheets under `attacks/` separately. They remain four 32×32 frames. The move's melee/ranged delivery chooses Attack or Shoot; the effect style (`melee`, `projectile`, `area`, `self`, `weather`) chooses where the separate effect appears.
6. Shared effects under `effects/` remain four-frame 32×32 strips. Flight shadows and swim ripples still use Phaser ellipses.
7. Refresh the local Vite browser after changing PNGs or manifest data. Run `npm run build` for a local production bundle. The old `scripts/generate_placeholder_animations.py` produces legacy combined sheets and is not the import path for these strips.

Move animations have matching placeholder sounds. See the [audio asset guide](AUDIO_ASSETS.md) for the per-move filenames, music, item cues, and replacement format.
