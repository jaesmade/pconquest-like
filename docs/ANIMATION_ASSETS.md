# Animation asset guide

The playable build uses original, generic pixel placeholders in `public/assets/animations/`. They identify each Pokémon with a color and initial; they are not Pokémon artwork. The Phaser battle scene reads `animation-manifest.json` for unit clips, shared effects, and move-specific attack effects. Combat rules record visual events by move ID; the renderer chooses the corresponding sheet.

## Files and names

| Asset | Naming rule | Example |
| --- | --- | --- |
| Pokémon battle sheet | `public/assets/animations/units/<pokemon-id>/<pokemon-id>-battle-32px.png` | `public/assets/animations/units/pikachu/pikachu-battle-32px.png` |
| Shared fallback battle sheet | `public/assets/animations/units/placeholder/placeholder-battle-32px.png` | Used until an enemy or recruit has its own art |
| One-shot effect | `public/assets/animations/effects/effect-<effect-id>-32px.png` | `effect-attack-impact-32px.png` |
| Move-specific attack effect | `public/assets/animations/attacks/attack-<move-id-in-kebab-case>-32px.png` | `attack-water-pulse-32px.png` |
| Weather loop | `public/assets/animations/weather/weather-<weather-id>-32px.png` | `weather-sandstorm-32px.png` |
| Asset map | `public/assets/animations/animation-manifest.json` | Maps stable IDs to public URLs and frame layout |

Use lowercase kebab case for IDs. Keep the same ID in the directory, filename, manifest, and Pokémon data. A new evolution or Mega form gets its own ID and sheet, such as `charizard-mega-y/charizard-mega-y-battle-32px.png`. A Vite runtime URL starts with `/assets/animations/`; it does not include `/public`.

The included unit IDs are `bulbasaur`, `squirtle`, `lapras`, `geodude`, `pikachu`, `meowth`, and `placeholder`. The shared effect IDs are `attack-impact`, `buff`, `debuff`, `heal`, `mega`, and `status`. Weather IDs are `sun`, `rain`, `snow`, and `sandstorm`. Attack IDs use the move-data keys, such as `waterPulse`, in the manifest; filenames use kebab case, such as `attack-water-pulse-32px.png`.

## Battle sheet layout

Every Pokémon battle PNG is **640 × 128 pixels**, made of **20 columns × 4 rows** of **32 × 32 pixel frames**. Use a transparent RGBA background. Keep the feet or ground contact near the bottom center of each frame, around `(16, 28)`, so changing an animation does not make a Pokémon jump between tiles.

| Row | Facing |
| ---: | --- |
| 0 | South, toward the bottom of the grid |
| 1 | West, toward the left |
| 2 | East, toward the right |
| 3 | North, toward the top |

| Columns | Clip | Frames | Default playback |
| --- | --- | ---: | --- |
| 0–1 | `idle` | 2 | 3 fps, loop |
| 2–5 | `move` | 4 | 8 fps, loop during travel |
| 6–8 | `attack` | 3 | 10 fps, once |
| 9–10 | `hurt` | 2 | 12 fps, once |
| 11–12 | `buff` | 2 | 8 fps, once |
| 13–14 | `debuff` | 2 | 8 fps, once |
| 15–17 | `special` | 3 | 8 fps, once |
| 18–19 | `faint` | 2 | 6 fps, once |

For a row-major spritesheet loader, the frame index is `directionRow * 20 + clipStartColumn + frameOffset`. The manifest records clip start columns, frame counts, and playback rates. Use those values in the renderer so every species can use the same animation code.

The effect, attack, and weather sheets are **128 × 32 pixels**, four 32 × 32 transparent frames in one row. Effects and attacks play once at 12 fps; a projectile loops its four frames while it travels. Weather sheets are authored for a future persistent overlay at 5 fps. Attack sheets are direction-neutral: Phaser moves the effect between grid cells, while the Pokémon's four-direction battle sheet controls its facing.

## Attack effect files

Every initial move has a named attack sheet under `public/assets/animations/attacks/`. The `attacks` entry in the manifest maps the exact move-data key to its URL and playback style. The styles are `projectile` (travel from attacker to target, then play at impact), `area` (play across affected cells), `self` (play on the user), and `weather` (brief board-wide cue). A newly added move without a manifest entry uses the shared `effect-attack-impact` sheet as a fallback.

| Move key | PNG filename | Style | Placeholder cue |
| --- | --- | --- | --- |
| `tackle` | `attack-tackle-32px.png` | projectile | Pale motion streaks |
| `ember` | `attack-ember-32px.png` | projectile | Orange flame |
| `vineWhip` | `attack-vine-whip-32px.png` | projectile | Green curved lash |
| `waterPulse` | `attack-water-pulse-32px.png` | projectile | Blue expanding ring |
| `thunderShock` | `attack-thunder-shock-32px.png` | projectile | Small yellow bolt; chain tile also flashes |
| `rockThrow` | `attack-rock-throw-32px.png` | projectile | Tumbling rock |
| `mudSlap` | `attack-mud-slap-32px.png` | projectile | Brown splash |
| `iceShard` | `attack-ice-shard-32px.png` | projectile | Ice crystal |
| `tailWhip` | `attack-tail-whip-32px.png` | area | Purple sweep on affected Pokémon |
| `harden` | `attack-harden-32px.png` | self | Silver shield |
| `howl` | `attack-howl-32px.png` | area | Expanding sound rings on allies |
| `stealthRock` | `attack-stealth-rock-32px.png` | area | Rock spikes across the 3×3 hazard |
| `thunderbolt` | `attack-thunderbolt-32px.png` | area | Large lightning bolts across the 2×2 blast |
| `sandstorm` | `attack-sandstorm-32px.png` | weather | Brown wind streaks across the board |
| `sunnyDay` | `attack-sunny-day-32px.png` | weather | Sunbursts across the board |

`src/game/engine.ts` appends an attack visual event when a move is used. The event contains its move ID, attacker tile, selected target tile, affected tiles, and units hit. `src/battle/Board.tsx` reads those events in order. A projectile launches after a short windup and moves between tile centers; area moves appear on every affected tile, while weather moves use a sparse board-wide cue. The battle state retains at most 24 recent cues, and the renderer holds at most three waiting cues plus the one currently playing. If updates arrive faster than playback, `src/battle/visualQueue.ts` replaces older weather or repeated empty-target cues first, then drops older cues as needed and speeds up retained playback. The board keeps player commands inactive until retained attack cues and movement finish. Damage, status, AP, RNG, and the combat log resolve immediately in the rules; dropping a visual cue never drops its outcome. The same manifest still maps move IDs to replaceable art.

## Grid animation behavior

| Event | Visual sequence |
| --- | --- |
| Waiting for a turn | Play `idle` in the Pokémon's current direction. |
| Move command | Face and interpolate through every traversed tile, then return to `idle`. Apply elevation and mud AP costs, lava and Stealth Rock on each entry. Movement may be repeated while AP remains, before or after the one Attack command. |
| Attack command | Selecting a move highlights its range, area, AP cost, and type matchups. On confirmation, face the target, play `attack`, then use the move's named attack sheet. Projectiles travel to the selected tile; area sheets appear on each affected tile. The generic `effect-attack-impact` is the fallback for unlisted moves. A damaging or Status move uses the Pokémon's one Attack command for that turn. |
| Flying state | Keep the sprite ten pixels above its normal tile position and draw a dark oval shadow at ground level. Move shadow and sprite along the same path. Flying ignores uphill and mud AP penalties and passes over lava. |
| Swimming state | On a deep-water tile, place the sprite four pixels lower and draw a pale blue oval surface ripple under it. The ripple follows each step and disappears on land. |
| Successful hit | Play `hurt` on the target, then return to `idle` if it survives. A miss, immunity, or Water Absorb heal does not play `hurt`. |
| Buff or debuff | Play `buff` or `debuff` on the recipient with the matching shared effect. Keep the stat icon visible after the short animation. |
| Held item or Mega Evolution | Play `special`. Use `effect-heal` for recovery or `effect-mega` before changing to the Mega form's own battle sheet. |
| Faint | Play `hurt` if damage caused it, then `faint`; remove the sprite from the board after the animation. |
| Weather change | `Sunny Day` and `Sandstorm` play their named board-wide attack cues; the weather label updates. A persistent weather overlay is still planned. |

Flight shadows and swim ripples are currently Phaser ellipse overlays in `src/battle/Board.tsx`, named `shadow` and `ripple` in the unit marker map. They require no sprite-sheet frames. To replace them with artwork, add clearly named assets such as `public/assets/animations/effects/effect-flight-shadow-32px.png` and `effect-swim-ripple-32px.png`, then replace those two ellipse creations with loaded sprites while keeping the same ground positions and per-tile visibility rules. Species and Mega form mobility is defined in `src/content/species.ts`; tile transitions update it in `src/game/mobility.ts`.

The current battle scene faces the attacker along the first differing grid axis, draws the tile and elevation before the unit, and puts attack effects above sprites. Retained attack visual events play in committed order; a backed-up renderer can omit older cosmetic cues. The rules and round order determine results, and the latest unit state plus action log remain visible when a cue is omitted. Animation only temporarily locks player commands while retained cues play.

Keep pixel edges sharp by using nearest-neighbor texture filtering. A reduced-motion setting that shortens travel and skips decorative effects is still planned.

## Replacing placeholders with your art

1. Export your own transparent PNG with the same **640 × 128** size and frame order for a Pokémon battle sheet.
2. Keep each frame inside its 32 × 32 cell, with consistent bottom-center alignment. Draw all four facing rows even when a clip uses mirrored art.
3. Replace the PNG at the Pokémon's existing path. The manifest and battle code can keep the same ID and filename.
4. For an evolution or Mega form, add a new sheet under its form ID and add one entry to `animation-manifest.json`; switch the visual ID when the form changes.
5. Replace shared effect or weather sheets using the named paths above. Their current format is four 32 × 32 frames in a horizontal strip.
6. For a move effect, replace its PNG under `attacks/` with four transparent 32 × 32 frames. Keep the visual centered around `(16, 16)` for impact and area effects. A projectile may be drawn to travel in any direction; the renderer does not rotate it. Use the table above to find the correct filename.
7. For a new move, add its move-data key to `attacks` in `animation-manifest.json`, choose `projectile`, `area`, `self`, or `weather`, and place its PNG at the matching URL. Without an entry, the shared impact sheet plays.
8. If you need a different frame size or count, update the manifest and the renderer's frame slicing and anchor configuration together. Keep game rules separate from these asset settings. Rebuild the app or Docker image after changing the manifest or any PNG.

The generator is `scripts/generate_placeholder_animations.py` and requires Python with Pillow. It creates only missing placeholder PNGs by default, so rerunning it preserves art you have replaced. Its `--force` option overwrites those files and should be used only when you intend to regenerate the generic placeholders.

The placeholders are original geometric art generated for this workspace. No third-party Pokémon sprites or downloaded asset pack is included. Record the source and usage permission for replacement art that will be distributed with the game.

Move animations have matching placeholder sounds. See the [audio asset guide](AUDIO_ASSETS.md) for the per-move filenames, music, item cues, and replacement format.
