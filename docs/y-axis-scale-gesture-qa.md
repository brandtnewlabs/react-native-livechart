# Y-axis scale gesture QA

Issue #376, 2026-10-09. Automated checks passed; native QA is in progress.

## Automated

- `npm run verify -- -- --runInBand`: typecheck/lint passed; 143 suites,
  2,070 tests passed, 5 skipped.
- `npm run build:lib`: declaration build passed.
- `npm run verify:bundle-mode-consumer`: packed-package iOS Bundle Mode export passed.
- React Doctor: 100/100.
- iOS Debug simulator build passed (arm64, two build workers).

Tests cover normalized bounds, exponential scaling, invalid input, live canvas
sizes, reserved and floating/anchored label geometry, left insets, exclusion of
the volume/time band, overlay priority, native gesture relationships, explicit
manual activation/termination, reset, private/supplied state, and stable gesture
objects across repeated reference updates.

## Native checks completed

Reused the existing iPhone 17 Pro simulator on iOS 26.5. No simulator was created.
The temporary QA screen wraps a chart in a native ScrollView and exposes shared
scale/viewport state plus interaction counters for inspection.

- A 160-point downward price-axis drag changed scale from 1 to 2.718281828459045.
  The upward drag restored 1; a double-tap also restored 1 after zooming out.
- During these axis drags, scrub callbacks stayed at zero and both time viewport
  overrides stayed null. The chart visibly compressed/expanded its price range.
- Plot scrubbing still invoked its callbacks after the axis gesture.
- A plot pinch changed the time window from 60 to 39.336 seconds while price scale
  stayed at 1.
- Native testing caught unreliable touch-down activation with a manually activated
  Pan recognizer. The final implementation uses a Manual recognizer with explicit
  begin/activate/end handling; the successful axis checks used that version.

## Profiling

A 15-second idle candle trace recorded 900 frame callbacks, median and p95
intervals of 16.67 ms, no intervals over 34 ms, and zero React commits. A Hermes
CPU profile and native stack sample were captured. This is an instrumented Debug
simulator observation, not a production-device performance claim. Drag profiling
has not yet been completed.

Local evidence and the profiling helper are in `~/Downloads/livechart-376-qa/`.

## Remaining native QA

- Candle and multi-series axis drags, left/floating axes, internal scale/reset,
  static charts, runtime option changes, and interactive reference badges.
- Time-axis panning and normal parent scrolling: the initial input tool did not
  produce a useful native pan, so these interactions are not yet verified.
- Profiling during actual price-axis drags and a short demonstration video.
- Android and physical devices have not been tested.

The newer device automation client encountered a stale October 5 ownership
record for this existing simulator. Its normal stale-record cleanup refused a
mismatched historical log record. Further device automation is paused pending
user approval to clear that single stale ownership record.
