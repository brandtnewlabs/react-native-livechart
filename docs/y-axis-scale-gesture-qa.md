# Y-axis scale gesture QA

Issue #376, 2026-10-09. Native interaction QA and drag profiling completed on the
existing iPhone 17 Pro simulator, iOS 26.5. No simulator was created.

## Automated

- `npm run verify -- -- --runInBand`: typecheck/lint passed; 143 suites,
  2,073 tests passed, 5 skipped.
- `npm run build:lib`: declaration build passed.
- `npm run verify:bundle-mode-consumer`: packed-package iOS Bundle Mode export passed.
- React Doctor: 100/100.
- An arm64 Debug simulator build passed during initial QA; the final session
  reused the previously installed compatible native app with this branch's JS.

Tests cover normalization, exponential scaling, hit geometry, gesture priority,
reset/private state, stable gesture objects, and the native ordering regressions
below. Final validation includes both chart controllers and crosshair hooks.

## Native interactions

Used a temporary QA screen with a native ScrollView, 600 line points, 60 candles
with volume, and two line series. Read the actual shared scale/viewport and
interaction counters through the debugger; saved before/after JSON and screenshots.
Also operated and recorded the public `y-range-scale` example with streaming data.

| Check | Result |
| --- | --- |
| Line, candle, and multi-series right-axis drags | Passed; price range visibly follows the finger |
| Left axes on both components | Passed with an explicit left inset |
| Large font and floating labels while scrolled back | Passed; floating plot extends to x=396 and labels remain draggable |
| Static chart | Passed; range updates without replacing data |
| Internal multiplier | Passed; range grows, survives disabling/hiding/re-enabling the axis, then resets |
| Runtime configuration | Bounds 0.5–2, sensitivity, disabled gesture, disabled reset, and auto-hide passed |
| Double-tap reset | Returned supplied and private scale to auto-fit |
| Drag continues into plot | Axis retained ownership; no scrub or viewport changes |
| Hold-to-scrub mode, both components | Axis drag produced zero scrub callbacks |
| Candle volume band | Excluded from scaling; multiplier stayed 1 |
| Interactive reference value badge | Tap callback and 55 drag updates; multiplier stayed 1 |
| Plot scrub after axis drag | 37 callbacks; normal interaction restored |
| Plot pinch and time-axis pan | Window changed 60 → 43.3195 s; time end moved to 1043.3195; price scale stayed 1 |
| Parent ScrollView | Normal outside drag scrolled 162.33 points; axis drags left it at 0 |

A nominal 160-point device-tool drag produced scale 2.6957 (the final delivered
move was approximately 158.67 points). Every axis-only case kept the time
viewport and parent scroll unchanged and emitted no scrub callbacks. Two-finger
zoom was tested from the plot. Android and physical devices were not tested.

## Bugs found and fixed during native QA

1. A manually activated Pan did not reliably claim touches at touch-down. The
   implementation uses a Manual recognizer with explicit begin/activate/end.
2. Native move events can precede the ACTIVE/onStart callback. Capturing the
   baseline there reused a prior drag's scale and could compound subsequent
   drags after reset. Baseline capture and animation cancellation now happen at
   touch-down, before movement is accepted. Terminal touches disarm immediately.
3. A native delayed scrub callback could still run during axis ownership in
   hold-to-scrub mode. Both crosshair hooks now guard start/update using the
   axis-ownership shared value. The native matrix was repeated after both fixes.

## Profiling

Matching 15-second idle and repeated-drag captures on the candle fixture:

| Measurement | Idle | Eight alternating 120-point drags |
| --- | ---: | ---: |
| UI frame callbacks | 900 | 901 |
| Median / p95 interval | 16.67 / 16.67 ms | 16.67 / 16.67 ms |
| Maximum interval | 16.67 ms | 16.67 ms |
| Intervals over 34 ms | 0 | 0 |
| React commits | 0 | 0 |
| Hermes CPU samples outside the idle/root entry | 0 / 1,261 | 1 / 1,263 |

The one JS sample during dragging was a host serialization function. No scrub
callbacks or viewport changes occurred during the profile. Separate 10-second
native stack samples at 10 ms intervals found the JS thread waiting in its run
loop in 903/908 idle samples and 899/902 drag samples. During dragging, native
main-thread samples include Worklets and Skia path/drawing work; no React commit
loop appeared in the React profile.

These are instrumented Debug simulator observations. Frame-callback intervals
are not GPU presentation times, and the sample counts are not production CPU
benchmarks. Instruments Time Profiler attachment stalled; its processes were
stopped and incomplete traces removed. Native stack sampling, Hermes CPU
profiles, frame callbacks, and React Profiler supplied the completed evidence.

## Evidence and cleanup

Local evidence is in `~/Downloads/livechart-376-qa/`: `matrix-{1,2,3,4}.json`,
screenshots, `idle-final`/`drag-final` JSON and Hermes profiles, native sample
reports, the QA fixture and helpers, and `y-axis-scale-gesture.mp4` for PR upload.
The video shows the public demo's line, candle, and multi-series drag/reset flows.

The user-approved stale ownership record was backed up and cleared. The final
session installed no app or native build. The reused iPhone 17 Pro was shut down,
its device claim released, this task's Metro/profilers stopped, and the temporary
QA route removed. Other projects' devices and unrelated checkout files were left
alone.
