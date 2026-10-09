# Right-anchored tick-column QA

Issue #396. Verified 2026-10-09 on physical iPhone 16 (iPhone von Lennart),
iOS 26.6, using the installed Debug app and this branch's JavaScript.

Configuration: labelRightMargin 8, gridEndGap 8, pulse radius 21 with stroke 1.5,
no live badge, and no inline series label. Measurements use the actual Skia font,
painted tick entries and shared right-column layout. Market Cap ticks are
€9K / €10K / €11K; Price ticks use four decimals.

| Chart | Canvas width | Unit | Right inset | Dot-to-column gap |
| --- | ---: | --- | ---: | ---: |
| multi | 320 | Market Cap | 65 | 28.1323 |
| multi | 393 | Market Cap | 65 | 28.1323 |
| multi | 320 | Price | 84 | 28.2646 |
| multi | 393 | Price | 84 | 28.2646 |
| single | 320 | Market Cap | 65 | 28.1323 |
| single | 393 | Market Cap | 65 | 28.1323 |
| single | 320 | Price | 84 | 28.2646 |
| single | 393 | Price | 84 | 28.2646 |
| single | 393 | Price | 100 | 44.2646 |

The last row uses explicit insets.right=100; it retains priority. Before the fix,
this native Market Cap scene reserved 95 points at width 393, leaving a 58.1323
point gap. Actual-tick measurement reserves 65 and leaves 28.1323. The video
compares this scene before/after, then shows Price and the single-series chart.

## Profiling

Settled 10-second Debug captures with 301 history points. No recording or device
actions ran during sampling.

| Measurement | Multi-series | Single-series |
| --- | ---: | ---: |
| Frame callbacks | 603 | 602 |
| Median interval | 16.6422 ms | 16.6413 ms |
| p95 interval | 16.6422 ms | 16.6414 ms |
| Maximum interval | 16.7731 ms | 16.7897 ms |
| Intervals over 34 ms | 0 | 0 |
| React commits | 0 | 0 |

The first single-series capture included one setup commit; the settled repeat
above records zero. These are frame-callback observations, not GPU presentation
times or production CPU benchmarks. Temporary fixture, native JSONs and raw
recordings are retained in `~/Downloads/livechart-seven-issues/`; diagnostic hooks
are excluded from the shipped library.

## Automated verification

Font-geometry regressions cover widths 320, 393 and 768 with 6.6 points per glyph,
Market Cap/Price tick widths, initial precision headroom, explicit insets, badge
priority, glow clearance, and centered/floating layouts. The actual width reaction
reports once for 60 same-width tick/alpha changes, then reports a wider column.
`npm run verify`: 146 suites, 2,096 tests passed, 5 skipped. Declaration build and
React Doctor 100/100 passed. API reference, guide, JSDoc and changelog updated.
