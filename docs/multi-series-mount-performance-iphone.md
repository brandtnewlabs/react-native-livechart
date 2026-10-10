# Multi-series mount performance on Lennart’s iPhone

Measured 2026-10-10 on the physical iPhone 16 (`iPhone17,3`, A18), iOS 26.6,
60 Hz. Both variants use the 5.0.0-rc.0 demo, unmodified Skia 3.3.0,
Reanimated 4.5.0, Worklets 0.10.0, and an optimized iOS Release build in legacy
Worklets mode. This compares the mount optimization with branch commit
`65a254d`; it is **not another 4.28.1 versus 5.0 CPU comparison**.

## Result

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

The previous steady-state Multi-series scrub CPU regression remains unresolved.
These mount measurements do not establish a CPU fix or a delivered-FPS change.
