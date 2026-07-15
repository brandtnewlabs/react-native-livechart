---
name: skia-paths
description: >-
  Use when building or changing Skia paths in this repo — anything touching
  SkPath, PathBuilder, per-frame path construction in worklets/useDerivedValue,
  drawSpline, the `.reset()` + ping-pong path-pool pattern, or the
  react-native-skia path-migration (immutable SkPath / PathBuilder). Covers the
  installed 2.6.4 mutable API, the PathBuilder API, the static path factories,
  the worklet per-frame patterns, and how the repo's useChartPaths pool/ping-pong
  optimization maps onto the new model. Trigger on "Skia path", "SkPath",
  "PathBuilder", "build a path each frame", "migrate path building", or a Skia
  upgrade.
version: "1.0.0"
---

# Skia paths in react-native-livechart

How `@shopify/react-native-skia` paths work here, what changes in the path-API
migration, and the per-frame patterns that matter for a 60 fps chart.

Reference: https://shopify.github.io/react-native-skia/docs/shapes/path-migration/

## TL;DR

- **Installed: Skia 2.6.4.** The **mutable `SkPath` API is still present and
  un-deprecated** (`moveTo`/`lineTo`/`cubicTo`/`quadTo`/`close`/`reset`/`addRect`…).
  All existing path code keeps working. Don't change it for its own sake.
- **`Skia.PathBuilder` also exists in 2.6.4** — the mutable builder that produces
  an **immutable** `SkPath` via `build()` / `detach()`. This is the direction
  Skia is moving (immutable `SkPath`, enforced in 3.0).
- This repo deliberately **reuses + ping-pongs two pooled `SkPath`s per curve**
  (see `useChartPaths.ts`) to avoid per-frame allocation. `PathBuilder.build()`
  changes that tradeoff — read "Migrating the per-frame builders" before
  switching, and **measure on-device** (iOS native GC lags under a steady
  per-frame allocation firehose).

## The two models

### Mutable `SkPath` (current — what the code uses)

```ts
const path = Skia.Path.Make();        // allocate once
path.reset();                          // clear each frame
path.moveTo(x0, y0);
path.cubicTo(c1x, c1y, c2x, c2y, x, y);
// …render the SAME object reference
```

`SkPath` is mutable; you mutate and render the same instance. Still fully
supported in 2.x.

### `PathBuilder` → immutable `SkPath` (forward-looking, 3.0 direction)

```ts
const builder = Skia.PathBuilder.Make();   // mutable builder
builder.reset();
builder.moveTo(x0, y0).cubicTo(c1x, c1y, c2x, c2y, x, y);
const path = builder.build();              // NEW immutable SkPath; builder stays usable
// or: const path = builder.detach();      // NEW SkPath AND resets the builder
```

`PathBuilder` methods (verified in 2.6.4): `moveTo`/`rMoveTo`, `lineTo`/`rLineTo`,
`quadTo`, `conicTo`, `cubicTo` (+ relative variants), `arcToOval`/`arcToRotated`/
`arcToTangent`/`addArc`, `close`, `addRect`/`addOval`/`addRRect`/`addCircle`/
`addPoly`/`addPath`, `setFillType`/`setIsVolatile`, `offset`/`transform`,
`reset`, `computeBounds`/`isEmpty`/`getLastPt`/`countPoints`, and
`build()` (returns an `SkPath`, builder remains usable) / `detach()` (returns an
`SkPath` and resets the builder).

## Migration map (old mutable `SkPath` → new immutable model)

When Skia eventually makes `SkPath` query-only:

| Old (mutating instance method)                | New                                         |
| --------------------------------------------- | ------------------------------------------- |
| `Skia.Path.Make()` + `moveTo`/`lineTo`/`cubicTo` | `Skia.PathBuilder.Make()` + same methods + `build()` |
| `path.reset()`                                | `builder.reset()` (or a fresh builder)      |
| `path.addCircle(...)` / `path.addRect(...)`   | `Skia.Path.Circle(...)` / `Skia.Path.Rect(...)` (immutable factories) |
| `path.stroke(opts)`                           | `Skia.Path.Stroke(path, opts)` → new path (or null) |
| `path.simplify()`                             | `Skia.Path.Simplify(path)`                  |
| `path.trim/dash/offset/transform/op(...)`     | corresponding `Skia.Path.*` static returning a new path |

In **2.6.4 today** the left column still works — treat the right column as the
target when bumping toward 3.0 or when a perf measurement justifies it.

## Worklet per-frame patterns

### The docs' recommended pattern

A `PathBuilder` kept in a shared value, rebuilt inside a derived value:

```ts
const builder = useSharedValue(Skia.PathBuilder.Make());
// in a gesture/frame worklet: builder.value.reset(); builder.value.moveTo(...); …
const path = useDerivedValue(() => builder.value.build());
```

`build()` returns a **new reference each frame**, so Reanimated's value-equality
check notifies subscribers automatically — no ping-pong needed.

### This repo's current optimization (`src/hooks/useChartPaths.ts`)

Two persistent `SkPath`s per curve (`lineA`/`lineB`, `fillA`/`fillB`) are
allocated **once**; each frame the code picks the off-parity one, `reset()`s it,
re-emits the verbs (`moveTo` + `drawSpline`'s `cubicTo` loop), and returns it.
The ping-pong exists for one reason: a reused object has the **same reference**,
which would trip Reanimated's value-equality early-return and **skip the repaint**
— alternating two buffers changes the reference every frame without allocating.
The flat point buffers (`ptsA`/`ptsB`) ping-pong for the same reason one level up.

Why not just `Skia.Path.Make()` per frame (which also changes the reference)?
Because on iOS the native GC lags the JS GC under a steady allocation firehose, so
resident memory climbs for as long as the chart is mounted (see the file's header
comment).

### Migrating the per-frame builders to PathBuilder — the tradeoff

`PathBuilder.build()`/`detach()` would:

- ✅ **remove the ping-pong** — a fresh reference each frame triggers the notify
  for free, so the `lineA`/`lineB`, `ptsA`/`ptsB` double-buffering can go.
- ⚠️ **reintroduce per-frame allocation** — `build()` allocates a new immutable
  `SkPath` every frame, which is exactly what the pool avoids. `detach()` may be
  cheaper (hands off the buffer and resets), but it still yields a new path.
- ➖ **not reduce the imperative call count** — `PathBuilder` still uses
  `moveTo`/`cubicTo`; it is not a command-array (`MakeFromCmds`) API.

So this is **measure-then-decide**, not a guaranteed win. Profile on-device
(iOS sim / Android emulator: frame rate, CPU, memory on a dense, wide-`timeWindow`
chart) and compare pool+ping-pong vs `PathBuilder.build()` vs `detach()` before
landing a switch. If allocation regresses memory, the pool stays.

## Where paths are built in this repo

- `src/hooks/useChartPaths.ts` — line + fill `SkPath` (pool + ping-pong; the hot path)
- `src/hooks/useCandlePaths.ts` — candle body/wick paths
- `src/math/spline.ts` — `drawSpline` (the `cubicTo` loop; monotone Fritsch–Carlson)
- `src/components/YAxisOverlay.tsx`, `ReferenceLineOverlay.tsx`, `ValueLineOverlay.tsx`,
  `MarkerOverlay.tsx`, `MultiSeriesValueLines.tsx`, `XAxisOverlay.tsx` — overlay paths
- `src/hooks/useBadge.ts` — badge pill path

All call `path.reset()` (there are **zero** `.rewind()` call sites) and re-emit.

## Gotchas

- **Don't allocate `Skia.Path.Make()` (or, later, `build()`) per frame without
  measuring memory on iOS.** Per-frame allocation is the reason the pool exists.
- **Reanimated only notifies on a changed reference.** Any reused-object approach
  must change the returned reference each frame (ping-pong) or the repaint is
  silently skipped.
- **`PathBuilder` is worklet-safe** — usable inside `useDerivedValue` /
  frame/gesture worklets, same as the mutable API.
- **Keep `react-native-worklets/plugin` last in Babel plugins** (unrelated to
  paths but a frequent worklet-compilation footgun in this repo).
