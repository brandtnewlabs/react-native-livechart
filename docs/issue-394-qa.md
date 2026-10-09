# Shared presentation clock QA

Issue #394. Verified 2026-10-09 on physical iPhone 16 (iPhone von Lennart),
iOS 26.6, using the installed Debug app and this branch's JavaScript.

A 320-point-wide plot uses a 100-second window and 0.1 buffer. The actual Skia
path's final point and bounds, actual dot coordinates, engine clock and public
overlay scale were read from temporary diagnostic hooks.

| Head | Viewport edge | Path endpoint X | Dot X | Scrub maximum time |
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
