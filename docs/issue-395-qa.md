# Reversible multi-series range transform QA

Issue #395. Verified 2026-10-09 on physical iPhone 16 (iPhone von Lennart),
iOS 26.6, using the installed Debug app and this branch's JavaScript.

A 601-point history spans values 20–40 over Unix seconds 1000–1030. A worklet
reads a reveal SharedValue and adds ±10 times that reveal to the presentation
bounds. The actual public overlay scale supplies the native numeric readout.

| Native case | Displayed bounds |
| --- | --- |
| Reveal 0 | 17.6–42.4 |
| Reveal 1 | 7.6–52.4 |
| Reveal 0.5 | 12.6–47.4 |
| Callback removed at reveal 1 | 17.6–42.4 |
| Invalid non-finite result at reveal 1 | 17.6–42.4 |

Native reveal/release controls animate the range in both directions; removing
an expanded callback restores the fitted range. Recorded prices remain unchanged.
The PR video shows the range transition. JSON values and the temporary fixture
are retained in `~/Downloads/livechart-seven-issues/`.

## Profiling

Matching settled 10-second captures with the same 601 points, first with the
callback removed, then a repeating UI-thread 0–1 reveal. No device actions or
screen recording ran during these final captures. Each configuration settled
for two seconds before sampling.

| Measurement | Callback removed | Animated transform |
| --- | ---: | ---: |
| Frame callbacks | 602 | 606 |
| Median interval | 16.6421 ms | 16.6427 ms |
| p95 interval | 16.6421 ms | 16.6431 ms |
| Maximum interval | 16.6422 ms | 16.7741 ms |
| Intervals over 34 ms | 0 | 0 |
| React commits | 0 | 0 |

These are instrumented Debug frame-callback observations, not GPU presentation
times or a production CPU benchmark. The captures exclude configuration commits.

## Automated verification

`npm run verify`: 145 suites, 2,097 tests passed, 5 skipped. Declaration build and
React Doctor 100/100 passed. Regressions cover repeated 7.6–52.4 frames without
feedback, partial reveal, removal, invalid results, animated expansion/contraction,
explicit snaps, unchanged tips/data, and frame application with and without
scratch reuse. The API reference, guide, JSDoc and changelog were updated.
