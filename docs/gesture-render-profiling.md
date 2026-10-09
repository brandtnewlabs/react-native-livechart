# Gesture render profiling and simulator QA

2026-10-09 · issue #373 · PR #387

The runtime check found one additional invalidation path: recreating inline
`timeScroll` / `scrub` config objects could resolve a new padding object with
unchanged numbers, rebuilding the scrub pan, action tap, and root composition.
`useCrosshair` now retains padding by its four numeric insets. Actual inset or
recognition-setting changes still invalidate the gesture.

## Measurement method

- Same installed iOS Simulator development app, Hermes, Expo 57 / React Native
  0.86 / Reanimated 4.5, iOS 26.5; React Compiler enabled.
- Baseline: main at `6db2375`. Candidate: `63d437e` plus the numeric-padding fix.
  Revisions were switched sequentially in the existing checkout and the app was
  cold relaunched after source changes.
- Identical temporary profiling route on both revisions: 601 deterministic line
  points, two reference lines, a marker, scroll, zoom, scrub action, and inline
  config/callback replacements. No touch input during the timed workload.
- 30 warm-up updates, then 150 measured reference-level updates. A 100 ms timer
  requested updates; observed measured duration was approximately 17–19 seconds
  because simulator timers did not run at exactly 10 Hz.
- React `Profiler` measured chart-subtree render time. Hermes CPU sampling ran
  through CDP `Profiler.start` / `Profiler.stop`. Gesture factory wrappers counted
  Pan, Tap, Pinch, Exclusive, Race, and Simultaneous allocations.
- A stable Reanimated frame callback recorded UI callback intervals. These are
  scheduler observations, **not** GPU presentation times or Instruments hitch
  measurements. Three complete captures per revision are shown below; setup
  attempts and interrupted captures are excluded.

## Results

| Revision / run | New gesture objects | Mean render | p95 render | Maximum render | Renders >16.67 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Main 1 | 1,800 | 6.42 ms | 23.19 ms | 26.40 ms | 21 / 150 |
| Main 2 | 1,800 | 5.28 ms | 27.16 ms | 53.72 ms | 11 / 150 |
| Main 3 | 1,800 | 3.89 ms | 17.16 ms | 21.69 ms | 9 / 150 |
| PR + fix 1 | 0 | 4.03 ms | 15.62 ms | 19.12 ms | 2 / 150 |
| PR + fix 2 | 0 | 4.09 ms | 7.05 ms | 19.53 ms | 5 / 150 |
| PR + fix 3 | 0 | 4.33 ms | 16.77 ms | 18.33 ms | 8 / 150 |

Main allocated 300 pans, 450 taps, 150 pinches, and 900 composition objects per
150-update run. The final candidate allocated none after warm-up. The initial
candidate still allocated 1,050 objects with recreated inline configs; that
runtime finding prompted the numeric-padding fix.

UI callback p95 was 16.67 ms in all six captures. Main recorded 8 intervals over
25 ms across 3,198 intervals; the candidate recorded 2 across 3,057. This does
not establish an FPS improvement. Render timings vary materially (the mean
ranges overlap), and the host was shared with other running applications.
These development-build measurements confirm the allocation change and suggest
fewer long JS renders; they are not a production-device speedup claim.

Hermes profiles still show development error-stack capture, worklet
serialization, and young-generation GC among the frequent sampled stacks.
Memoizing gestures does not eliminate React rendering or all worklet work.
A separate ten-second native process sample captured main-thread/Reanimated/
Hermes stacks during simulator interaction. Xcode Time Profiler did not finish
attaching, so no Instruments result is claimed.

## Manual simulator coverage

The checks used native taps, holds, swipes, and pinches with screenshot/video
inspection, rather than invoking gesture callbacks in a test mock:

- Working orders: BUY and SELL drags retain ownership after leaving their tags,
  snap, commit, and update the on-screen committed price/event log. BUY reached
  100.00; SELL committed 104.80. Pausing the feed and changing line/candle mode
  kept the orders usable. Scrub start/end events appeared and the tooltip cleared
  after release.
- Time scroll: direct horizontal swipes reveal older history and return toward
  live data; candle and line modes both render; switching to axis drag scrolls
  from the time ruler. Pinch changes the visible window, and Reset zoom restores
  the base window. Press-and-hold displays the candle tooltip and clears on lift.
- Markers: a native tap selected a BUY marker and updated the demo readout;
  marker-detail scrubbing and switching to candle mode remained usable.
- During continuous reference updates, a reference-badge tap reached callback
  revision 91 and a reference drag committed using callback revision 132.
  Pinch and the scrub-action reticle remained interactive during these updates.

The generic device-tool pan helper includes a hold, so scroll-only checks used
its direct swipe helper to avoid activating hold-to-scrub first.

## Automated validation and limits

`npm run verify`: 140 suites, 2,037 tests passed, 5 skipped; typecheck and lint
passed. The integration regression now includes recreated inline configs and
separate checks for numeric inset and scrub-delay invalidation. Library type
build and packed-consumer Bundle Mode export passed. React Doctor: 100/100.

Android, physical devices, release-build timing, and prolonged memory/leak
profiling were not covered. This is a focused regression pass on the affected
interactions, not an exhaustive check of every demo or configuration.

The raw JSON/CPU profiles, native stacks, reproducible temporary harness,
screenshots, and videos were saved in the local `Downloads/livechart-pr-387-qa`
artifact folder. The temporary route was removed from the app after profiling.
