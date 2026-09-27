# 32×32 browser rendering profile

Measured 2026-09-26 with a minified Vite build of the actual Phaser `Board` component. The isolated profiling entry builds separately from the shipped app. Its scene has a 32×32 map, 8 allies, 8 enemies, elevation, deep water, walls, hazards, deployment zones, and a capture tile. The browser viewport was 1280×720 at DPR 1; the Phaser canvas was 2048×2048. The reference browser reported Chrome 153 on Windows, 8 logical CPUs, and WebGL rendering. It was launched with `--in-process-gpu --disable-gpu-sandbox --no-sandbox` because this environment's headless GPU subprocess failed. These results describe this machine and fixture, not a low-end device or a full competitive match.

The fixture performs three passes each: idle for 1.2 seconds; 30 battle-state commits; 30 target changes; 10 weather changes; and eight queued attacks during a 1.6 second animation window. It samples `requestAnimationFrame` intervals, wraps WebGL draw calls, records `renderBattle` and target-preview wall time, observes browser `longtask` entries, and reads `performance.memory`. Full raw results are in [`before.json`](../scripts/profile/before.json) and [`after.json`](../scripts/profile/after.json). `performance.memory` is JavaScript heap only; it excludes WebGL textures, canvas backing storage, and GPU memory. The 2048×2048 RGBA canvas alone represents about 16 MiB before renderer copies and textures. Draw calls count WebGL submissions, not GPU execution time.

## Results

The table shows the worst p95 frame interval across three passes of each scenario, plus the worst p99. The p50 was 16.6–16.7 ms in every measured pass. A 60 Hz display is expected to report roughly 16.7 ms even when the game has spare CPU time.

| Scenario | Before p95 / p99 | After p95 / p99 | Draw calls per frame | Long tasks |
| --- | ---: | ---: | ---: | ---: |
| Idle | 16.8 / 17.2 ms | 16.8 / 18.4 ms | 8 | 0 |
| Battle changes | 16.8 / 17.0 ms | 16.7 / 17.1 ms | 8 | 0 |
| Targeting | 16.8 / 17.3 ms | 16.8 / 17.1 ms | 8 | 0 |
| Weather | 16.8 / 17.0 ms | 16.8 / 17.2 ms | 8 | 0 |
| Animation | 16.7 / 35.0 ms | 16.8 / 17.0 ms | 8 | 0 |

The initial scene held 180 game objects, 16 unit sprites, 16 HP bars, and 12,775 static terrain graphics commands. Entering attack targeting added one effectiveness label and raised the dynamic overlay to 1,382 commands. Sampled JavaScript heap after each scenario ranged from roughly 13 to 18 MiB before, and 17 to 25 MiB after. Heap snapshots vary with garbage collection and JIT warmup; this run does not establish a memory regression or leak. There were no observed tasks of at least 50 ms. One animation pass had a 35 ms p99 frame interval before the change, but it did not recur in the follow-up passes, so the profile does not attribute that outlier to targeting.

The measured CPU hotspot was target movement. Each cursor change called `renderBattle`, which scanned all 1,024 tiles, checked move range and line of sight, and rebuilt effectivity labels. Its p95 time across the three passes was 3.8, 2.2, and 1.6 ms. The change puts the impact and cursor outline in a separate Phaser Graphics object. Target-only changes now redraw just that preview. The target-preview p95 was 0.1 ms in each follow-up pass (30–31 calls per pass). Full board redraws remain for battle, mode, and weather changes. Draw submissions remained at eight per frame in the measured fixture.

## Reproduction and limits

Build the isolated fixture with `npx vite build --config scripts/profile/vite.config.mjs --mode profile`, serve `dist-profile` with `npx vite preview --outDir dist-profile --port 4174 --host 127.0.0.1`, and open `/scripts/profile/index.html` in a foreground Chrome tab. The fixture runs automatically and prints its status and result JSON in the page. `scripts/profile/collect-cdp.mjs` can save the JSON from a browser started with a remote debugging port. Do not compare a background tab's frame intervals: Chromium throttled `requestAnimationFrame` in the hidden in-app tab during this work.

This clears the first renderer measurement at the 32×32, 8v8 cap. It does not measure GPU execution time, texture memory, real multiplayer state traffic, camera navigation, or slower devices. A release claim of stable 60+ FPS still needs a representative full match and GPU/frame traces on the chosen reference hardware.

## 2026-09-27 attack-range and camera follow-up

The fixture now sizes the canvas to the browser viewport and includes 30 battle changes while Attack is selected, plus 30 camera pans. A new minified profile used Headless Chrome 153 on Windows at a 1264×625 viewport and DPR 1, with the same 32×32, 8v8 scene. The original fixture had inherited a 500×500 `.board` rule under headless Chrome, so the fixture now overrides that rule. Full results are [`current-before.json`](../scripts/profile/current-before.json) and [`current-after.json`](../scripts/profile/current-after.json). This headless run reports one WebGL draw submission per frame; it is not directly comparable to the eight submissions in the earlier foreground run.

| Scenario | Before `renderBattle` p95, three passes | After `renderBattle` p95, three passes | After scene objects |
| --- | ---: | ---: | ---: |
| Battle changes in Inspect | 1.3 / 0.9 / 0.8 ms | 1.0 / 0.8 / 0.9 ms | 69 |
| Battle changes in Attack | 4.3 / 2.2 / 1.8 ms | 2.1 / 1.7 / 1.9 ms | 70 |
| Weather changes in Attack | 2.7 / 2.1 / 1.8 ms | 2.1 / 1.7 / 1.7 ms | 70 |

The Attack layer now keeps its range graphics and line-of-sight results while the source unit and position, move, map reference, weather, and active cover remain compatible. It rebuilt once across each 30-change Attack pass; weather changes forced rebuilds. A per-redraw array lookup also replaced 1,024 linear scans of the 16-unit roster for matchup labels. Attack targeting held one label. Target preview p95 remained around 0.1 ms. The extra range Graphics object raises scene object count by one.

Frame interval p95 remained 16.7–16.8 ms in the measured scenarios, including camera navigation. Camera panning invoked no `renderBattle` calls. No main-thread tasks at least 50 ms were observed. The warm-pass Attack redraw improvement is modest, and frame intervals did not improve measurably. The full-map terrain render texture is 3264×1772 pixels at this cap, about 22 MiB of raw RGBA data; the canvas itself follows the viewport. Headless draw-call counts, JavaScript heap, and frame intervals do not measure GPU texture allocation or GPU time. Visible-cell culling remains contingent on a full-match profile on the release device.
