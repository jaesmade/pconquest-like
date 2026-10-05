# Animation asset guide

For a start-to-finish workflow that covers unit sheets, move effects, and ability triggers, see the [unit, move, and ability authoring guide](UNIT_MOVE_ABILITY_ASSETS.md).

## Top-down battle environment and imported HUD art

The active battlefield uses the [top-down environment family](ISOMETRIC_ASSETS.md): square 64×64 woodland floors, water, lava, stone, cardinal ramps, and matching forest props. Battle and deployment share the same manifest and terrain borders. Height remains tactical metadata, drawn with ledge strips without lifting or skewing cells. The earlier isometric and Kenney terrain families remain as source material; the Kenney HUD frames and temporary cover overlay remain active.

The [battle asset manifest](../public/assets/battle-asset-manifest.json) records the earlier Kenney Roguelike/RPG Pack 1.0 and UI Pack – Pixel Adventure 2.0 imports (CC0). Reimport them with `python scripts/import_battle_assets.py <folder>` using the original ZIP filenames. To replace active terrain, preserve the square geometry and follow the current battlefield guide.

Tiles, borders, and small vegetation are stamped once into a render texture. Large props and actors use row depth. Clicks use `camera.getWorldPoint` followed by constant-time square cell lookup; the minimap draws squares too.

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

The source row order is down, down-right, right, up-right, up, up-left, left, down-left. The logical grid directions `[south, west, east, north]` map directly to cardinal rows `[0, 6, 2, 4]`: down, left, right, and up. Allies begin facing up (row 4), and enemies begin facing down toward the player (row 0). Sleep has one row and uses it for every facing. For each clip, the frame index is `sourceRow × framesPerRow + frameIndex`. The unit scale is 1.65×. Grounded sprite frames are centered on the square tile in both battle and deployment; flying frames lift 10 world pixels and swimmers lower 4. Ellipse shadows and ripples sit 17 world pixels below the tile center, while frame-aligned art shadows follow the sprite. Keep a stable ground point across strips with different frame sizes.

**Normal is the portrait asset.** The `normal` URL in each unit set points to a standalone portrait PNG. The shared placeholder set now includes `units/placeholder/normal.png`, copied from the supplied `units/bulbasaur/Normal.png`, so party and deployment roster cards have a visible temporary portrait. The top-down deployment map instead crops frame zero of the north-facing `idle` row from the unit set and uses the same 1.65× unit scale as battle; it does not use `normal`. Every species currently shares this placeholder art until its own set is assigned. Replace the file or point a new species set's `normal` URL to a species-specific portrait without touching battle animations. To change its on-map placement sprite, replace the species' `idle` strip and keep its ground point aligned.

Named item and status icons remain in `public/assets/ui/icons/`. Grounded units now use the frame-aligned `*-Shadow.png` companions copied from `sample-assets/` into `units/placeholder/`. The five available sheets are `placeholder-idle-shadow-32x40.png`, `placeholder-attack-shadow-80x88.png`, `placeholder-shoot-shadow-64x64.png`, `placeholder-charge-shadow-32x40.png`, and `placeholder-sleep-shadow-32x40.png`. These source sheets contain colored mask bands, so Phaser tints them black and draws them at 35% opacity beneath the unit. Walk and Hurt have no shadow sheets in `sample-assets/`; those clips hold the matching facing row's first Idle shadow frame. Flying units keep a separate ground-projection ellipse; swimming units keep a water ripple. The imported strips came from the user; their original creator and redistribution terms were not supplied.

## Attack effect files

Every initial move has a named attack sheet under `public/assets/animations/attacks/`. The `attacks` entry in the manifest maps a visual ID to its URL and playback style. The styles are `melee` (effect at target, no projectile travel), `projectile` (travel from attacker to target, then play at impact), `area` (play across affected cells), `self` (play on the user), and `weather` (brief board-wide cue). A newly added move without a named sheet automatically uses one of the reusable placeholders below.

### Assignable placeholders for new moves

These original, disposable pixel sheets live in `public/assets/animations/move-placeholders/`. Each PNG is **128×32 pixels: four transparent 32×32 frames in one row**. View the [contact sheet](MOVE_PLACEHOLDER_PREVIEW.png) at enlarged nearest-neighbor scale. The white effect pixels are tinted to the move's type at runtime; dark outlines stay dark. All 18 type tints are listed in `src/battle/moveVisuals.ts`. Named move art is drawn in its own colors and is not tinted.

| Visual ID in `animation-manifest.json` | File | Style | Automatic use |
| --- | --- | --- | --- |
| `placeholderMelee` | `move-placeholder-melee-32px.png` | melee | Melee damaging move |
| `placeholderProjectile` | `move-placeholder-projectile-32px.png` | projectile | Ranged single-target move |
| `placeholderArea` | `move-placeholder-area-32px.png` | area | Move with an affected area |
| `placeholderSelf` | `move-placeholder-self-32px.png` | self | Self-targeted status move |
| `placeholderHazard` | `move-placeholder-hazard-32px.png` | area | Move that creates a tile effect or hazard |
| `placeholderWeather` | `move-placeholder-weather-32px.png` | weather | Weather-changing move |

The renderer chooses visual art in this order: **a named manifest entry whose ID matches the move ID**, then the move's optional `visualId`, then the automatic placeholder above. To choose a different placeholder or reuse an existing named visual, set `visualId` in `src/content/moves.ts`:

```ts
newMove: {
  name: 'New Move', type: 'Fire', category: 'Special', delivery: 'ranged',
  power: 50, range: 3, apCost: 1, target: 'unit', tags: ['projectile'],
  visualId: 'placeholderProjectile', detail: 'Temporary move art.',
},
```

`visualId` is an asset ID, not a filename. It must exist under `attacks` in the manifest; startup validation reports unknown IDs. To replace a placeholder for one move, add a unique `attacks` entry keyed by that move ID and point it to a four-frame PNG. That named entry automatically takes priority; other moves can keep using the shared placeholder. The effect style controls placement and travel, while `delivery` and `category` still choose the unit's Attack, Shoot, or Charge strip. Move rules, damage, and tags do not depend on the visual ID. Assign sound separately with `soundId` as described in the [audio guide](AUDIO_ASSETS.md).

Run `py scripts/generate_move_placeholders.py` to recreate missing placeholder sheets and the preview. The script preserves existing files unless `--force` is passed. These assets were drawn by the project script with Pillow on 2026-09-28; they use no third-party art. Replace the named PNGs freely, keeping their four-frame dimensions and transparent background. The preview is documentation only and is not loaded by the game.

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

`src/game/engine.ts` appends an attack visual event when a move is used. The event contains its move ID, attacker tile, selected target tile, affected tiles, units hit, and each hit target's HP after that action. It also records short-lived HP change cues for actual damage and healing from moves, abilities, items, weather, and terrain. `src/battle/Board.tsx` reads those events in order. The source strip's `impactFrame` sets the windup: Attack frame 4 for melee impact, Shoot frame 2 before a projectile or area effect, and Charge frame 5 for a Status effect. A projectile moves between tile centers after Shoot; its hit reaction begins when it arrives. Area effects, the Hurt strip, hit sound, HP bar, and floating HP numbers appear together at impact. The rules, RNG, and battle log still commit immediately. The battle state retains at most 24 recent attack cues and 48 HP cues; these presentation cues are omitted from saves. The renderer holds at most three waiting attacks plus the one currently playing. If updates arrive faster than playback, `src/battle/visualQueue.ts` can drop older attack cues; HP numbers for dropped cues appear with the latest authoritative state.

Floating numbers are Phaser text rather than image assets: red `-N` shows HP lost and green `+N` shows HP restored, placed beside the affected Pokémon. Move damage and healing appear at attack impact; terrain damage during movement appears when the Pokémon reaches that tile. Weather and periodic item changes appear after any queued attack playback. The numbers rise and fade over 800 ms; reduced-motion settings keep the text still before it disappears. At most three labels per Pokémon remain visible at once. To restyle them, edit `playHpCues` in `src/battle/Board.tsx`; no sprite sheet or manifest entry is needed.

## Isometric grid animation behavior

| Event | Unit strip and cue |
| --- | --- |
| Waiting | Loop Idle in the current facing. Active `sleep`, `asleep`, or paralysis uses Sleep while resting; Burn keeps Idle and its status icon. |
| Moving | Loop Walk through the projected path at 375 ms per tile with constant travel speed. At the shared placeholder's 8 fps, roughly three Walk frames play per tile. The sprite chooses a new facing from each pair of adjacent grid tiles, including the first step from the saved starting tile, and returns to Idle or Sleep at the destination. Shadows and swim ripples travel at the same speed. |
| Melee damaging move | Play Attack based on `delivery: "melee"`; show the named move effect at the target. |
| Ranged damaging move | Play Shoot based on `delivery: "ranged"`; the named effect follows its projectile or area style. Physical and Special can both be ranged. |
| Status move | Play Charge, then its named area, self, or weather effect. Status moves have no attack delivery. |
| Buff, debuff, or item special | Play Charge. Existing shared bursts, icons, and callouts remain separate. |
| Successful hit | Start Hurt, hit audio, impact art, red damage number, and the board HP update at the same impact moment. Healing produces a separate green number. Survivors return to Idle or Sleep; fainted units fade out and are removed after the queued cue. |
| Weather | Sunny Day and Sandstorm play board-wide move effects. Persistent weather overlays remain future work. |

Ground shadows are named sprite sheets in each unit set's optional `shadows` manifest field. Shadow frames use the same dimensions, row order, and frame count as the corresponding action strip; the renderer selects the exact action frame. A missing action shadow falls back to the Idle sheet's first frame for the current facing. Keep each shadow's footprint aligned to its action frame so changing clips does not shift it. Flying shadows and swim ripples remain Phaser ellipse overlays in `src/battle/Board.tsx`, named `shadow` and `ripple` in the unit marker map. To replace those two with artwork, add clearly named assets such as `public/assets/animations/effects/effect-flight-shadow-32px.png` and `effect-swim-ripple-32px.png`, then keep the same ground positions and per-tile visibility rules. Species and Mega form mobility is defined in `src/content/species.ts`; tile transitions update it in `src/game/mobility.ts`.

The current battle scene faces the attacker along the first differing grid axis, draws the tile and elevation before the unit, and puts attack effects above sprites. Retained attack visual events play in committed order; a backed-up renderer can omit older cosmetic cues. The rules and round order determine results, and the latest unit state plus action log remain visible when a cue is omitted. Animation only temporarily locks player commands while retained cues play.

Keep pixel edges sharp by using nearest-neighbor texture filtering. A reduced-motion setting that shortens travel and skips decorative effects is still planned.

## Replacing placeholders with your art

1. Put transparent action strips under `public/assets/animations/units/<species-or-form-id>/`. Name each by action and frame size, such as `<id>-attack-80x88.png` or `<id>-idle-32x40.png`. Keep the character's ground point stable across clips. Put matching shadow strips beside them as `<id>-<action>-shadow-<width>x<height>.png`.
2. Add a set under `unitSets` in the manifest. Each clip provides its own URL, frame width and height, frames per row, row count, fps, and loop flag. Set `facingRows` to match that set's source direction order. Add optional `shadows` URLs keyed by clip; each shadow sheet must match that clip's dimensions and frame layout. Species may have different frame sizes and counts.
3. Point the species or Mega species ID in `units` to its set ID. Leave it mapped to `placeholder` until its own art is available.
4. Assign a separate Normal portrait PNG to the set's `normal` URL. The shared placeholder portrait remains available until each species has its own art.
5. Assign a reusable move placeholder with `visualId`, or let the renderer select one from the move definition. For unique art, add an `attacks` manifest entry keyed by the move ID and use a four-frame 32×32 sheet. The move's melee/ranged delivery chooses Attack or Shoot; the visual style (`melee`, `projectile`, `area`, `self`, `weather`) chooses where the separate effect appears.
6. Shared effects under `effects/` remain four-frame 32×32 strips. Ground shadow sheets are tinted black in the renderer; use opaque mask pixels with transparent surroundings. Flight shadows and swim ripples still use Phaser ellipses.
7. Refresh the local Vite browser after changing PNGs or manifest data. Run `npm run build` for a local production bundle. The old `scripts/generate_placeholder_animations.py` produces legacy combined sheets and is not the import path for these strips.

Move animations have matching placeholder sounds. See the [audio asset guide](AUDIO_ASSETS.md) for the per-move filenames, music, item cues, and replacement format.
