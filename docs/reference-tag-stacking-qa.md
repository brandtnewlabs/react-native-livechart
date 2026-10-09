# Reference tag stacking QA

Issue #377, 2026-10-09. Used the existing iPhone 17 Pro simulator on iOS 26.5
with the compatible installed Debug app and this branch's JavaScript. No simulator
or native app build was created for this change.

## Automated verification

- `npm run verify -- -- --runInBand`: typecheck, lint, and 145 suites passed;
  2,089 tests passed, 5 skipped.
- `npm run build:lib`: declaration build.
- `npm run verify:bundle-mode-consumer`: packed-package iOS Bundle Mode export.
- React Doctor: 100/100.

Regression tests cover independent horizontal columns, variable heights, obstacle
reservation, edge bounds, stable ordering, crowded layouts, native-tag measurement,
exact tap priority, stale targets, and drag displacement compensation.

## Native QA

A temporary fixture used 600 line points, 60 candles, six closely spaced reference
lines, a live value changing at 10 Hz, mixed fonts, and three custom native tags.
Captured actual UI-thread rectangles, callback counters, and screenshots. Removed
the fixture and diagnostic globals from the shipping tree after verification.

| Check | Result |
| --- | --- |
| Built-in left/right names and separate axis value pills | All 12 tags present, separate columns, no collisions |
| Custom tags, including enabling stacking after mount | All three measured custom tags participate; nine total tags, no collisions |
| Above/below plot and off-axis-only custom renderers | Pins remain within the plot; replacement occurs only off-axis |
| Large fonts, reorder, removal from six lines to three | Correct tag counts, no collisions or runtime errors |
| Floating axis and in-plot value pills | Correct independent geometry |
| Live badge on either side, disabled, avoidance disabled | Uses the actual badge rectangle and honors opt-out |
| Candle mode | All 12 tags visible with no collisions |
| Overcrowded 130 px chart with 20 references | All 40 tags retained in bounds; overlap remains as documented |
| Collapse / disabled grouping | Existing count pill / overlapping behavior retained |
| Native custom Pressable and displaced drag | Correct order selected; first change 100.1607 from 100, final 101.5385 after a nominal 45 px upward drag; no scrub callbacks |
| Built-in name and value pill taps | Both select `order-0` |
| Repeated axis-value-pill drags | Ten commits, 604 change callbacks; price-axis scale stays 1 and no scrub callbacks |
| Ordinary plot scrub, pinch, time-axis pan, price-axis drag | 44 scrub callbacks; window changes 60 → 43.3195 s, end 1043.3195, price scale 1.364 |
| Public Working orders screen | Dense alerts + Stack render cleanly; mode/custom controls and native dragging checked |

The complete layout matrix contains 18 cases. Every feasible stacking case had
zero tag/tag collisions, zero tag/live-badge collisions with avoidance enabled,
and zero out-of-bounds tags. The overcrowded case intentionally cannot fit.
Android and physical devices were not tested.

## Native bugs caught and corrected

1. React Compiler hoisted an empty-array callback outside a UI worklet. An explicit
   loop prevents the resulting remote-function runtime error.
2. Several native `onLayout` events could overwrite sibling measurements before
   JS observed an earlier shared-value write. Measurements now merge atomically
   on the UI thread, including connector widths.
3. During line removal, press geometry could momentarily contain a previous
   index. Stale indices and changed line IDs are ignored until layout catches up.

## Profiling

Matching 15-second live-update captures, then ten alternating native 45 px drags
(approximately 16.5 seconds, with a concurrent native stack sampler):

| Measurement | Stacking off, live | Stacking on, live | Stacking on, drag |
| --- | ---: | ---: | ---: |
| UI frame callbacks | 899 | 900 | 984 |
| Median / p95 interval | 16.67 / 16.67 ms | 16.67 / 16.67 ms | 16.67 / 16.67 ms |
| Maximum interval | 16.67 ms | 16.67 ms | 40.65 ms |
| Intervals over 34 ms | 0 | 0 | 2 |
| React commits during capture | 0 | 0 | 0 |
| Hermes samples outside idle/root | 15 / 1,122 | 7 / 1,139 | 3 / 1,230 |

The native 10-second stack sample included Worklets/Skia and gesture processing;
638 of 843 main-thread samples were waiting in the run loop. The captures show no
React render loop during live updates or dragging. They do not establish a
production CPU or GPU benchmark: Debug simulator instrumentation affects timing,
and frame-callback intervals are not GPU presentation times.

Local evidence is under `~/Downloads/livechart-377-qa/`: `matrix.json`, per-case
screenshots/rectangles, Hermes CPU profiles, native stacks, frame/commit data, and
`reference-tag-stacking-pr.mp4` (19 seconds, about 502 KB). The video compares off,
collapse, stack, custom dragging, edge pins, and candle mode.

After QA, stopped Metro, closed the automation session, released its claim, and
shut down the reused iPhone 17 Pro. No LiveChart simulator was left behind.
