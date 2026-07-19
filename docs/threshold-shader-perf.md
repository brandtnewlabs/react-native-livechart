# Time-varying threshold shader lookup

Issue: [#213](https://github.com/brandtnewlabs/react-native-livechart/issues/213)

## Problem

The time-varying threshold shader receives 64 evenly spaced Y samples. SkSL
requires uniform-array indices to be compile-time constants, so the original
shader used a constant-bound loop over all 63 segments for every covered
fragment. That is especially expensive for the optional profit/loss fill, where
the shader can cover most of a high-DPR chart.

## Decision

Keep the existing 64 samples and identical linear interpolation, but generate a
balanced constant-index branch tree. A fragment now reaches its segment in at
most six comparisons instead of visiting all 63 segments.

This was selected over the other candidates because it preserves the current
pixel semantics and uniform payload:

- A 1D texture would introduce per-frame texture/image upload and filtering
  behavior, plus more native-resource lifecycle complexity.
- Gradient stops cannot express an arbitrary time-varying 2D boundary for both
  the stroke and filled band in a single equivalent paint.
- Reducing the 64-sample resolution would trade visual accuracy for speed. The
  branch tree removes lookup work without changing that resolution.

Those alternatives should only be revisited if physical GPU profiling shows the
branch tree is still a material bottleneck.

## Isolated screening benchmark

The reproducible harness renders a full rectangle with only the threshold
RuntimeEffect. It removes React, Reanimated, engine ticks, and path construction
from the measurement, compares the legacy loop with the branch tree in A/B/A
order, and fails unless their RGBA output is byte-identical.

```bash
npm run benchmark:threshold-shader
npm run benchmark:threshold-shader -- --width=200 --height=400 --iterations=10 --warmup=2
```

CanvasKit software-raster results on 2026-07-19:

| Raster size | Result |
| ---: | ---: |
| 100 × 200 | 11.30–14.29% lower mean across repeated A/B/A runs |
| 200 × 400 | 20.07% lower mean in the A/B/A run |

Both runs produced byte-identical output. These numbers establish that the
lookup itself is cheaper in Skia's software RuntimeEffect path; they are not a
claim about on-device GPU frame time or FPS. Physical-device Release profiling
remains the authority for the final runtime conclusion.

The larger generated source added roughly 1 ms to a warmed CanvasKit software
RuntimeEffect compilation (about 1.22 ms versus 0.09–0.22 ms for the loop in the
recorded A/B/A compile run). Compilation happens once at module initialization,
not per frame; the benchmark reports it separately so the startup trade-off stays
visible.

## Physical-device validation

Release builds were compared on 2026-07-19 on a wired iPhone 16 (iPhone17,3),
iOS 26.5.2, with a 60 Hz display. Each run used a 3-second warmup followed by a
12-second Reanimated UI-frame capture. The builds were installed in alternating
legacy/tree order, and their embedded Hermes bundles were checked before the run
to confirm that each contained the intended shader.

At the normal one-layer workload, both implementations remained comfortably
within the frame budget:

| Run | Intervals | Mean | Maximum | Delayed / estimated missed |
| --- | ---: | ---: | ---: | ---: |
| Legacy A | 722 | 16.64 ms | 16.64 ms | 0 / 0 |
| Branch tree B | 722 | 16.64 ms | 16.64 ms | 0 / 0 |
| Legacy C | 722 | 16.64 ms | 16.78 ms | 0 / 0 |

This means the optimization does not produce a user-visible FPS change for one
ordinary full-screen threshold fill on this device: both versions are already
locked to 60 Hz.

To make shader cost observable without creating a broad device/series matrix,
one amplified condition stacked eight identical full-screen threshold fills.
All other inputs stayed fixed:

| Run | Intervals | Mean | Maximum | >1.25x | Estimated missed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Legacy A | 722 | 16.64 ms | 16.64 ms | 0.00% | 0 (0.00%) |
| Branch tree B | 722 | 16.64 ms | 16.77 ms | 0.00% | 0 (0.00%) |
| Legacy C | 706 | 17.02 ms | 49.92 ms | 1.13% | 15 (2.08%) |
| Branch tree D | 722 | 16.64 ms | 16.77 ms | 0.00% | 0 (0.00%) |
| Legacy E | 534 | 22.50 ms | 49.92 ms | 17.98% | 187 (25.94%) |
| Branch tree F | 722 | 16.64 ms | 16.77 ms | 0.00% | 0 (0.00%) |

The amplified condition is an isolation test, not a recommendation to stack
eight charts. It shows that the branch tree retains frame-budget headroom under
heavy fragment load: every optimized repeat stayed locked to 60 Hz, while two
of three legacy repeats missed frames. Together with the byte-identical output
checks, this supports keeping the branch-tree implementation.

The regular threshold demo was also opened directly on the same physical device.
The live line crossed the benchmark repeatedly; above/below colors, fill
boundaries, marker line and label, and chart edges rendered without visible
banding or clipping. A test-only deterministic build then moved both the price
and threshold series around the same center. That exercised the optimized
time-varying-series shader through several red/green fill crossings; the
interpolated boundaries and left/right clipping also rendered cleanly. The
crossing dataset was not committed.

These are UI-frame-callback results, not direct GPU timings. Instruments could
not attach to this device through `xctrace`, so the results must not be presented
as per-frame GPU duration. The on-screen “missed” value is an estimate derived
from elapsed capture time and the detected 60 Hz interval.
