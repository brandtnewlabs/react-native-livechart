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
