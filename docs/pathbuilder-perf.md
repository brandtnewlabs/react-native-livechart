# PathBuilder migration — on-device performance

This documents the measurements behind migrating all per-frame path construction
from the **pooled mutable `SkPath` + ping-pong** pattern to **`Skia.PathBuilder`
reused via a SharedValue + `detach()`** (see `src/hooks/usePathBuilder.ts`).

## Why migrate

`@shopify/react-native-skia` is moving `SkPath` toward **immutable** (see the
[path-migration guide](https://shopify.github.io/react-native-skia/docs/shapes/path-migration/));
the mutating methods (`moveTo`/`lineTo`/`cubicTo`/`reset`) the pool relied on are
slated for removal in 3.0. `PathBuilder` is the forward-compatible construction
API. The pool also needed a two-`SkPath` ping-pong purely to defeat Reanimated's
value-equality short-circuit; `detach()` returns a fresh reference each frame, so
that machinery goes away (net **−150 lines**).

## Method

- Device: iPhone 17 Pro simulator, iOS 26.4, Skia 2.6.4, debug build via Metro.
- Scene: the multi-series demo (3 series animating, the built-in RAM/UI/JS HUD).
- Each variant swapped via Metro Fast Refresh (same process / pid), then sampled
  for **90 s**: app process RSS (`ps`) and mean CPU, plus the in-app fps HUD.
- Single runs — treat ≤~2pp CPU differences as within run-to-run noise.

## Results

| Variant | RSS over 90s | mean CPU | fps |
| --- | --- | --- | --- |
| Pooled `SkPath` + ping-pong (old) | ~438–442 MB, **flat** (−4.9) | 36.9% | 60/60 |
| PathBuilder, **`Make()` inside the worklet** (builder **+** path / frame) | ~450–452 MB, **flat** (+0.4) | 39.1% | 60/60 |
| PathBuilder, **reused via SharedValue** (path-only / frame) — *adopted* | ~439–440 MB, **flat** (+0.3) | 35.2% | 60/60 |

## Findings

1. **No memory leak from per-frame allocation on 2.6.4.** The pool's docstring
   warned that per-frame `SkPath` allocation makes iOS resident memory "climb
   steadily." It does not — every variant, including per-frame allocation, held
   **flat RSS over 90 s**. Skia 2.6.4 reclaims per-frame paths fine.

2. **`SkPathBuilder` is not a Reanimated-shareable host object.** Stashing a
   builder in a `useRef` and reading it inside a `useDerivedValue` worklet throws
   `"Cannot convert undefined value to object"`. Builders cross into the worklet
   only through a **`SharedValue`** (what `usePathBuilder` does) or by being
   `Make()`-d inside the worklet. This is the key structural constraint of the
   migration.

3. **Reused-builder PathBuilder is perf-equivalent to the pool** (35.2% vs 36.9%
   CPU — within noise — and the same RSS band). Allocating the builder *per frame*
   (variant 2) is the only measurable cost (+2pp CPU, +11 MB), which the reused
   structure avoids.

## Decision

Migrate to **reused-builder-via-SharedValue PathBuilder + `detach()`** everywhere
(`usePathBuilder` / `usePathBuilders`). It is perf-neutral today, removes the
ping-pong, and is the only construction path that survives the immutable-`SkPath`
change in Skia 3.0. The `flatPts` point-buffer ping-pong in `useChartPaths` /
`useMultiSeriesLinePaths` is unrelated (it drives intermediate re-runs) and stays.
