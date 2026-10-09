# Multi-series time-axis scrub exclusion QA

Issue #398. Native QA on iPhone von Lennart (iPhone 16), using the installed
Debug app connected to this branch's JavaScript, on 2026-10-09.

The fixture contains timestamped line data, a stationary 350 ms scrub delay,
axis dragging with inertia disabled, and native controls for plot clamping.
The test holds for 700 ms before dragging horizontally by 95 layout points.

| Case | Scrub starts | Visible right edge |
| --- | ---: | ---: |
| Before fix, ruler hold/drag | 1 | 1300 (unchanged) |
| After fix, ruler hold/drag | 0 | 1272.7496 |
| Following plot hold/drag | 1 | 1272.7496 (unchanged) |
| Plot clamping on, ruler hold/drag | 1 (unchanged) | 1245.4992 |
| Following clamped plot hold/drag | 2 | 1245.4992 (unchanged) |

The delivered pan is slightly shorter than its nominal delta. The viewport
moves only during the ruler gestures; only plot holds start a scrub. Tests also
cover a 48-point exclusion with and without horizontal plot clamping, and the
existing unrestricted bounds when no strip is reserved.

Validation: `npm run verify` passed (145 suites, 2092 tests, 5 skipped), library
declaration build passed, React Doctor 100/100. A parallel pre-commit rerun hit
a timeout under host load; the entire suite passed serially before committing.

The physical recording is linked in the PR. Local before/after JSON, fixture,
and screenshots are retained in `~/Downloads/livechart-seven-issues/`.
Profiling was unnecessary for this gesture-boundary configuration change.
