# Placeholder audio asset guide

The playable build includes **29 original, synthetic retro WAV placeholders** in `public/assets/audio/`. They are generated in this workspace with Python's standard library; no Pokémon music, cries, or third-party recordings are included. `audio-manifest.json` maps stable move IDs, held-item names, music states, and shared cues to public URLs. Sound is cosmetic and never changes AP, damage, timing, battle RNG, or saved combat state.

## Files and names

| Group | Naming rule | Current files |
| --- | --- | --- |
| Music | `music/bgm-<scene>-loop.wav` | `bgm-menu-loop.wav`, `bgm-route-loop.wav`, `bgm-battle-loop.wav` |
| Move sound | `moves/move-<move-id-in-kebab-case>.wav` | One named file for each of the 15 initial moves, from `move-tackle.wav` through `move-sunny-day.wav` |
| Held item | `items/item-<item-id-in-kebab-case>.wav` | `item-leftovers.wav`, `item-sitrus-berry.wav`, `item-assault-vest.wav`, `item-x-attack.wav`, `item-charizardite-x.wav` |
| Shared cue | `cues/cue-<event>.wav` | `cue-move-fallback.wav`, `cue-item-fallback.wav`, `cue-pokemon-enter.wav`, `cue-pokemon-hit.wav`, `cue-pokemon-faint.wav`, `cue-ui-confirm.wav` |
| Asset map | `audio-manifest.json` | Stable IDs and URLs used by `src/audio/audio.ts` |

The exact move IDs are `tackle`, `ember`, `vineWhip`, `waterPulse`, `thunderShock`, `rockThrow`, `mudSlap`, `iceShard`, `tailWhip`, `harden`, `howl`, `stealthRock`, `thunderbolt`, `sandstorm`, and `sunnyDay`. The manifest uses those camel-case data keys while filenames use kebab case. Runtime URLs start with `/assets/audio/`; they do not contain `/public/`.

## Playback in this build

- Menu, route/preparation, and battle each select their own looping track. The music crossfades when the run phase changes.
- A move sound starts with its retained attack animation. A hit cue plays when the attack visual includes a damaged target. A faint cue plays when the fainted sprite leaves the board. A missing move mapping uses `cue-move-fallback.wav`.
- A held item's sound plays when that item is equipped in preparation. X Attack and Charizardite X also play when their **Special** action succeeds. Leftovers and Sitrus Berry have named placeholders ready for their passive recovery events; the current build uses them at equip time and does not yet emit separate passive-recovery sound events.
- The battle entrance uses `cue-pokemon-enter.wav`. `cue-ui-confirm.wav` is available for future menu actions.
- Browsers start audio after the first pointer or keyboard action. A **Sound: On/Off** control in the top bar stores only the mute preference under `pokemon-tactics-audio-muted`; it does not enter the run save. Muting silences the master bus.

`src/audio/audio.ts` has a master bus, a music bus, and an effects bus. Music and effects have separate gain settings; the master leaves headroom. At most eight one-shot effects play simultaneously. Files load and decode on demand, while effects preload in the background after the first user action. Repeated effects get a small random pitch change using cosmetic randomness outside the battle's seeded RNG.

## Replacing placeholders

1. Export an original or properly licensed sound as **mono or stereo WAV**, PCM 16-bit at 22,050 Hz or higher. WAV is the baseline format here; if you switch to OGG/MP3, update the matching URL in `audio-manifest.json` and confirm browser codec support for your target browsers.
2. Replace the file at its existing path to keep the move, item, or scene mapping. Keep move and item IDs stable because gameplay content and saves refer to those IDs.
3. Keep a move or item effect short, with a small fade at its beginning and end, so repeated actions do not click. Keep music loops at a similar perceived loudness and align the end to the start to avoid a seam. The current placeholder loops are short sketches; replacement tracks can be longer.
4. For a new move or item, add a descriptively named file under `moves/` or `items/`, then add its exact data ID and URL to `audio-manifest.json`. Unmapped entries use the generic fallback cue.
5. Rebuild the app or Docker image after changing files or manifest entries. Record the source and usage rights for any replacement sound that will ship with the game.

The generator is `scripts/generate_placeholder_audio.py`. Run `python scripts/generate_placeholder_audio.py` to fill in missing placeholder WAVs without touching replacements. `--force` overwrites all named files and should only be used when you intentionally want to restore the generated placeholders.
