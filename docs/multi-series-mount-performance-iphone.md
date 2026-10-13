# Multi-series mount performance on Lennart’s iPhone

Measured 2026-10-10 on the physical iPhone 16 (`iPhone17,3`, A18), iOS 26.6,
60 Hz. Both variants use the 5.0.0-rc.0 demo, unmodified Skia 3.3.0,
Reanimated 4.5.0, Worklets 0.10.0, and an optimized iOS Release build in legacy
Worklets mode. This compares the mount optimization with branch commit
`65a254d`; it is **not another 4.28.1 versus 5.0 CPU comparison**.

## Follow-up: initial Y-range fitting

A second pass compares the previous mount commit `fd0d228` with the additional
initial-fit changes, on the same phone and Release configuration. The default
demo enables `rangeAnimation.animateExpansion` with `smoothing={0.03}`. Its
initial Y-range was 0–1 even though the data is around 33–34: nonempty paths
therefore preceded a fully framed chart by several seconds.

| Fully framed geometry | Cold launches | Median | Mean | Range |
| --- | ---: | ---: | ---: | ---: |
| Previous mount commit | 9 | 3,369 ms | 3,367.4 ms | 3,354–3,383 ms |
| Additional mount changes | 9 | 117 ms | 118.4 ms | 115–133 ms |

The median fell **96.5%**, or 3,252 ms. This is a stricter measurement than the
original nonempty-path metric: all three paths must be nonempty, the reveal
complete, and the visible data extrema and series tips inside the displayed
Y-range. It still measures UI geometry, **not compositor delivery or first
visible pixels**. It excludes process startup, route loading, and parent feed
preparation, starting at the first controller call. The first fit remains ready
for later data when the chart initially has no visible history.

The engine now fits its first measured, visible data immediately. Subsequent
live updates, series toggles, replacements and resizes retain the configured
smoothing. The compact presentation snapshot is available on the first React
render, and fixed React props no longer allocate seventeen separate UI mutables
and derived-value mappers. Dynamic UI inputs such as `presentationTime`, manual
Y-scale and pan/zoom remain SharedValues.

Native layout arrived at median **23 → 15 ms**. However, the original
nonempty-path/full-reveal metric was **100 → 117 ms** in these repeat batches
(means 106.3 → 118.4 ms). This pass does not establish faster first path
construction; its substantial improvement is eliminating the initial range
animation from a placeholder. Exploratory batches had overlapping geometry
results (baseline median 125 ms; early metadata 118 ms; metadata plus fixed
parameters 116 ms). Preparing an extra engine tick during layout, asynchronously
or synchronously, did not establish a consistent gain and was reverted.

The formal sequence was candidate six launches, baseline six, candidate three,
baseline three, reinstalling saved signed Release apps. No counted run was
discarded. Both use the same deterministic feed seed and temporary probe. The
probe records UI readiness timestamps once per stage, then writes a small JSON
file through `expo-file-system`; the host reads that file through CoreDevice.
The iOS UI automation runner timed out during this pass, so no new screenshot or
gesture checks are claimed. Native layout, live engine updates, and all three
paths were confirmed by the probe. The ordinary Release app is restored after
removing instrumentation and the deterministic feed.

All fully framed baseline runs (ms):

```text
3375, 3364, 3369, 3354, 3370, 3369, 3383, 3356, 3367
```

All fully framed candidate runs (ms):

```text
133, 117, 117, 116, 115, 115, 119, 116, 118
```

Local evidence is under `.agent-device/multi-mount-round2-20261010/`: signed
variants, source snapshots, bundle/binary SHA-256 manifest, launch and copy logs,
raw stage measurements and `summary.json`. Regression tests fail against the
previous implementation and pass with the fix. They cover first-render metadata,
unmeasured and empty mounts, hidden-only feeds, zero-valued data, paused initial
fitting, later easing and resize, prop updates, UI scale changes and scroll return.
`npm run verify` passes: typecheck, lint, 151 suites and 2,159 tests, with five
existing skips. Declaration build and a fresh packed-consumer iOS Hermes Bundle
Mode export pass. React Doctor remains 98/100 with no diagnostics.

## Earlier geometry-readiness comparison

| Mount variant | Cold launches | Median | Mean | Range |
| --- | ---: | ---: | ---: | ---: |
| Before | 12 | 138.5 ms | 138.8 ms | 131–143 ms |
| Final mount changes | 9 | 104 ms | 112.9 ms | 100–135 ms |

The median fell **24.9%** (34.5 ms); the mean fell **18.7%** (25.9 ms).
The ranges overlap. These short runs establish an improvement for this demo on
this device, rather than a latency guarantee for other applications.

The measurement is **chart geometry readiness**, starting at the first call to
`useLiveChartSeriesController`. It excludes process startup, route loading, and
feed preparation before the chart renders. It ends at the first UI reaction
where all three active paths are nonempty, canvas dimensions and display window
are positive, and the reveal is complete (`morphT >= 0.999`). It does not measure
GPU/compositor delivery or the first visible pixel. A screenshot and device
interaction checks confirm the resulting chart is visible and usable.

Geometry and full-reveal timestamps matched in every counted launch. The
suspected 600 ms reveal delay did **not** occur in these runs.

## Changes

- Initialize the demo feed before its first commit, preserving live append,
  pause, reset, and option-change behavior. The retained initial fixture is
  bounded; growing multi-series histories are still maintained on the UI thread.
- Bootstrap the library’s presentation metadata and numeric layout sample
  together before paint. Only small presentation fields cross to JavaScript;
  history arrays are excluded. Layout, strokes, and the legend share this snapshot.
- Reject queued updates and stopped UI mappers after a series-source change.
  Ordinary live price ticks continue on the UI runtime without React publications;
  numeric layout sampling retains its order-of-magnitude gate.
- Mount the particle runtime only when `degen` is enabled. While disabled, the
  chart avoids its particle buffer, configuration SharedValues, and frame callback.
  Enabling it preserves the chart engine and uses a stable shared shake transform;
  disabling it resets the transform.
- Mount the demo control panel after two frame callbacks, allowing the initial
  chart commit to proceed first. The controls remain functional. The existing
  fixed chart container keeps the chart’s geometry stable.

No public props or exports change. No native renderer patch or benchmark probe
is shipped.

## Incremental experiments

| Variant | Launches | Median | Mean | Range |
| --- | ---: | ---: | ---: | ---: |
| Early feed seed only | 3 | 137 ms | 142.7 ms | 137–154 ms |
| Early seed + shared metadata | 9 | 137 ms | 132.7 ms | 109–153 ms |
| Above + lazy particles | 6 | 108 ms | 112.7 ms | 105–135 ms |
| Above + deferred controls, earlier build | 6 | 105 ms | 114.8 ms | 101–145 ms |

Early seeding and metadata consolidation alone did not establish a substantial
mount-latency improvement in this small three-line workload. Removing the
unused particle initialization produced the clearest gain. The measurements
cannot isolate a consistent extra gain from deferring controls. The final build
also initializes its seed with React state and writes the shared shake transform
directly from the particle frame loop.

## Procedure and raw values

A temporary probe was identical in both variants. Its UI timestamps were
published once through a native accessibility label, without polling JavaScript
per frame. Each capture terminated the previous app process and launched the
Multi-series route through the same deep link. A temporary deterministic random
stream (seed `42815000`) produced matching feed values. Default chart controls,
three series, 30-second window, and custom reference overlay were preserved.

Saved signed app binaries were reinstalled in sequence: baseline, incremental
candidates, baseline again, final candidate, baseline again, final candidate.
The last reinstall check yielded baseline `143, 131, 137` ms and candidate
`135, 130, 100` ms; those runs remain included. No slow run was discarded.
An initial timing-probe debugging pilot is excluded from the formal batches.

All counted baseline runs (ms):

```text
138, 138, 141, 143, 138, 139, 138, 140, 140, 143, 131, 137
```

All final candidate runs (ms):

```text
107, 102, 133, 104, 103, 102, 135, 130, 100
```

Local evidence is under `.agent-device/multi-mount-20261010/`: signed variant
apps, compiled source snapshots and SHA-256 manifest, launch logs, native
accessibility snapshots, screenshots, incremental measurements, and
`summary.json`. The ordinary final Release app is rebuilt after removing
instrumentation and the deterministic benchmark stream.

## Validation and limits

`npm run verify` passes (150 suites, 2,154 tests; five existing skips), declaration
build and fresh packed-consumer iOS Hermes Bundle Mode export pass, and React Doctor
remains 98/100 with no diagnostics. Tests cover
initial feed readiness, reseeding, compact metadata projection, ordinary live
updates, layout resampling, stale publications, source changes, optional particle
mounting without engine replacement, shared shake output, and deferred-control
cleanup. Device checks cover the chart and the particle toggle.

Steady-state Multi-series scrub CPU has not been remeasured after the mount
changes. These measurements do not establish a CPU fix or a delivered-FPS change.
