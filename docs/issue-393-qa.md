# Recorded multi-series tip QA

Issue #393. Physical iPhone 16 (iPhone von Lennart), iOS 26.6, installed Debug
app with this branch's JavaScript. Verified on 2026-10-09.

The chart uses `smoothing=0.05`, a fixed presentation time of 3760, and a
50 → 75 value change. Temporarily observed the actual chart engine's published
series/tip shared values on the UI thread; removed the measurement code before
committing. The fixture uses `metrics.motion.adaptiveSpeedBoost=0` so the
unrecorded negative control's easing is easy to see.

| Native check | First published tip | Result |
| --- | ---: | --- |
| Newest history point and target both 75 | 75 | Matches history immediately |
| Newest history point 50, live target 75 | 51.25, then 52.4355 | Normal smoothing retained |
| Park viewport at 3750, before the recorded 75 | 73.7520, then 72.5664 toward 50 | Historical smoothing retained |

The video shows recording 75, resetting to 50, then presenting an unrecorded 75.
The recorded endpoint stays aligned; the unrecorded endpoint eases. JSON traces
and the temporary fixture are retained in `~/Downloads/livechart-seven-issues/`.

`npm run verify` passed: 145 suites, 2,093 tests, 5 skipped. Tests also check a
future recorded point, historical framing, and the consumer's exact unrecorded
53.3692740209399 regression with the default adaptive boost. React Doctor 100/100.
No profiling was needed for the constant-time recorded-point check.
