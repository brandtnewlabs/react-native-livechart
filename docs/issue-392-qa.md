# Growing history viewport QA

Issue #392. Verified 2026-10-09 on physical iPhone 16 (iPhone von Lennart),
iOS 26.6, using the installed Debug app and this branch's JavaScript.

The public overlay scale drives the native window readout. The authoritative
start is 1000, configured window 3600 seconds, buffer 0.04, and clock 8200.

| Case | Native displayed window / left edge |
| --- | --- |
| Following | 7500 seconds / 1000 |
| Registered pinch worklets, scale 2 | 3750 seconds |
| Registered pinch worklets, scale 0.5 | 7500 seconds / 1000 |
| First retained sample delayed to 5000 | Same 3750 → 7500 restoration |
| Native one-finger pan after zoom | Edge moved from 6625.6781 to 5840.4161 |
| Reset and advance clock to 9160 | 8500 seconds / 1000 |

The physical-device automation tool cannot synthesize two-finger iOS gestures.
The pinch checks invoke the actual registered start/change worklets on the
phone's UI thread, then read the rendered scale; they verify viewport calculus
and drawing but do not verify physical two-finger touch recognition. One-finger
pan uses a native device gesture. The video shows sparse-history pinch worklet
changes and restoration as the clock advances. Temporary fixture/instrumentation
and native JSON evidence are retained in `~/Downloads/livechart-seven-issues/`;
they are excluded from the shipped library.

Automated regressions exercise the actual engine frame callback and registered
gesture handlers: 1110.4 → 1000 left-edge correction, changing clocks with normal
smoothing, 7500 → 3750 pinch, dense/sparse restoration, explicit maximum 3000,
historical pan/reset, removal, and invalid/future starts. `npm run verify`: 146
suites, 2,098 tests passed, 5 skipped. Declaration build and React Doctor 100/100
passed.
