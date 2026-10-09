# Shared presentation clock QA

Issue #394. Verified 2026-10-09 on physical iPhone 16 (iPhone von Lennart),
iOS 26.6, using the installed Debug app and this branch's JavaScript.

A 320-point-wide plot uses a 100-second window and 0.1 buffer. The actual Skia
path's final point and bounds, actual dot coordinates, engine clock and public
overlay scale were read from temporary diagnostic hooks.

| Head | Viewport edge | Path endpoint X | Dot X | Tooltip cutoff |
| --- | ---: | ---: | ---: | ---: |
| 1050 | 1060 | 288 | 288 | 1050 |
| 1070 | 1080 | 288 | 288 | 1070 |
| undefined (nowOverride 1055) | 1065 | 288 | 288 | 1055 |

At both explicit heads the entire path bounds end at x=288, preserving 32 points
of empty breathing room. The video animates the head and presented value on the
UI thread with the same clock SharedValue; no React prop updates drive it.
Diagnostics and the temporary fixture are retained in
`~/Downloads/livechart-seven-issues/` and excluded from the shipped library.

## Profiling

Matching settled 10-second captures with 2,201 retained points; fixed clock versus
repeating 1050–1070 clock animation and corresponding UI-thread value updates.
Configurations settled for two seconds. No device actions or recording ran while
sampling.

| Measurement | Fixed clock | Animated clock |
| --- | ---: | ---: |
| Frame callbacks | 602 | 602 |
| Median interval | 16.6430 ms | 16.6430 ms |
| p95 interval | 16.6433 ms | 16.6430 ms |
| Maximum interval | 16.7742 ms | 16.6430 ms |
| Intervals over 34 ms | 0 | 0 |
| React commits | 0 | 0 |

These are instrumented Debug frame-callback observations, not GPU presentation
times or production CPU benchmarks.

## Automated verification

Regressions drive the actual engine frame callback and linear Skia path builder,
including SharedValue updates without React renders, buffered future-sample
exclusion, historical/future viewports, no available sample before the head, and
numeric/wall-clock fallbacks. `npm run verify`: 146 suites, 2,093 tests passed,
5 skipped. Declaration build and React Doctor 100/100 passed. API reference, guide, JSDoc and changelog are updated.

## Review follow-up

Repeated on the same physical iPhone after addressing all three review findings.
The fixture queues a `(1060, 9999)` sample behind presentation head 1050 and
presented value 30. Parked edges are written through the engine's viewport
SharedValue; scrubbing uses native hold-and-drag input.

| Case | Result |
| --- | --- |
| Parked edges 1055 / 1060 / 1070 / 1100 | Tip remains 30; fitted range remains 18.8–31.2; path endpoint X is 304 / 288 / 256 / 160 |
| Historical edge 1040 | Recorded tip is 20; path ends at the viewport edge |
| Native scrub into the future buffer | Callback time 1050, value 30, x=288 |
| Native scrub at head 1055, presented value 35 | Around time 1052.9167, callback value is 32.9167, x=297.3333; it interpolates toward the presented endpoint instead of the queued 9999 sample |
| Rising presented history with zero jitter/speed | All 20 active particles have x=288, matching the path and dot |
| Head outside the plot or only future history available | No particles spawn |

The [review video](media/issue-394-review-qa.mp4) shows parking the viewport in
future space without contaminating the tip/range, then spawning at the presented
dot, followed by a native hold-and-drag scrub clamped to the head. The recording
uses UI-thread viewport/data inputs and native touch input on the physical phone. Scrub callback
readouts and raw particle/geometry snapshots are retained locally in
`~/Downloads/livechart-seven-issues/394-review-*.json`.

Regression tests execute registered crosshair/degen callbacks, cover callbacks
with and without tooltips, synthetic-tip interpolation, future-only history,
offscreen suppression and ordinary buffered clocks. Native QA also exposed a
warning from mutating a tooltip default config already serialized to a worklet;
resolution now returns a fresh normalized config.

Final follow-up verification: `npm run verify` passed 146 suites and 2,101 tests
(5 skipped). Declaration build and React Doctor 100/100 passed. Temporary
routes and diagnostic hooks were removed before final verification.
