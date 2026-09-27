# Start screen overhaul

## Purpose

Give the game a distinct first impression before its existing run, Lab, and options flows. The supplied `1.png` and `2.png` are visual references: image 1 guides the title splash and image 2 guides the menu. Their text and layout are reference content; existing game commands and save behavior remain the source for what each button does.

## Visual layout

- Fill the browser viewport with a pale cream-to-aqua background, a faint square grid/checker pattern, a cool teal glow at the lower left, and a coral glow at the lower right.
- Set **Pokémon** in dark navy above **Tactics** in coral. Use the pixel font with large responsive sizing and tight line spacing.
- On the splash, keep the two-line wordmark centered in the upper-middle area and place **Press any key to start** near the lower edge. A pointer press anywhere also continues.
- On the title menu, align the wordmark in the upper area and stack gray buttons with white outer edges and raspberry borders: **Continue** (only when a run is resumable), **New Run**, **Lab**, **Options**, and **Exit**.
- Keep supporting screens over the same background. Put Lab setup, Options, and Exit text in a readable light panel instead of returning to the former dark title card.

The background is built from CSS gradients and grid layers in `src/overhaul.css`; the title itself remains selectable HTML. The standalone island background documented in `ISOMETRIC_ASSETS.md` is not used in this screen design.

## Input and behavior

| Screen/control | Behavior |
| --- | --- |
| Splash | Any key, mouse, or touch press opens the title menu. Space does not scroll the page. |
| Continue | Resumes the saved, unfinished run. Hidden during starter selection and after a completed run. |
| New Run | Starts a fresh run; asks before replacing an existing unfinished run. |
| Lab | Opens the existing Battle Lab configuration screen. |
| Options | Opens the existing sound preference control. |
| Exit | Shows the existing saved-progress message; the browser cannot reliably close a tab it did not open. |
| Keyboard menu | Tab and Shift+Tab move through native buttons; Enter/Space activate. Up/Down move focus; Home/End select the first/last available button. |

The splash prompt pulse is removed under `prefers-reduced-motion`. Buttons retain visible keyboard focus and touch-sized targets. Background decoration does not capture pointer events.

## Files and replacement points

- `src/main.tsx`: `splash` screen state, first-input transition, menu semantics, and existing action wiring.
- `src/overhaul.css`: responsive layout, pixel palette, grid and color-wash layers, panels, and reduced-motion rules.
- `src/style.css`: Press Start 2P font import for wordmark and menu labels.
- `docs/UI_OVERHAUL_PLAN.md`: overall screen flow and implementation progress.

To adjust the backdrop, edit the `.title-screen`, `::before`, and `::after` rules. To tune the two-line logo, edit `.title-brand h1`; menu geometry and selected/hover styling live in `.title-menu` and `.menu-button`. Keep menu controls as HTML buttons so keyboard, touch, focus, and accessible names continue to work.

## Review checklist

- At 1920×1080, the logo and prompt have the same broad vertical spacing as the references, and the main menu buttons read as a centered vertical stack.
- At narrow mobile widths and short browser heights, the logo does not clip, menu buttons remain reachable, and Lab setup can scroll.
- Mouse/touch activation, any-key splash transition, arrow navigation, Tab navigation, and Enter/Space activation all work.
- Continue/New Run still preserve the current save confirmation behavior; Lab, sound options, and Exit message still open their prior screens.
- Reduced motion disables the prompt pulse without hiding it or blocking input.
