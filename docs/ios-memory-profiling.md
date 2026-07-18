# iOS memory profiling

This note records the physical-device measurements used to separate LiveChart's
one-time worklet compilation footprint from allocations caused by continuous
rendering.

## Environment

- iPhone 17 Pro Max (Trooper), iOS 26.6
- Release build, Hermes enabled, no Metro connection
- Expo 57 / React Native 0.86
- Xcode 26.6 Instruments, Activity Monitor and Allocations templates
- One line series, no candles or trades, at 10 updates per second

The profiling route is `app/memory-profile.tsx`. It keeps the synthetic producer
alive throughout a fixed 60-second run so that the only variable is whether the
chart is absent, mounted in static mode, or mounted in live mode:

| Time    | Phase                                    |
| ------- | ---------------------------------------- |
| 0–15 s  | Producer only (baseline)                 |
| 15–45 s | Chart mounted                            |
| 45–60 s | Chart unmounted; producer remains active |

Setting `EXPO_PUBLIC_MEMORY_PROFILE_RUN` selects a checked-in renderer-matrix
run at bundle time and redirects the demo app to the profiling route. The
original `EXPO_PUBLIC_MEMORY_PROFILE_MODE=static|live` switch remains available
as a compatibility override. The ordinary demo index is unchanged when neither
variable is present.

Set `WORKLETS_BUNDLE_MODE=1` at build time to enable Worklets 0.10 Bundle Mode
in both Babel and Metro. Omit it (or set it to `0`) for the legacy eval mode.
The Metro cache key includes this selector so sequential A/B builds cannot reuse
transforms from the other mode. `npm install` applies the official Worklets 0.10
patches for Metro 0.84.4 and `metro-runtime`; these are required for generated
worklet-module indexing and Bundle Mode Fast Refresh.

## Renderer experiment matrix

`profiling/live-renderer-matrix.json` is the source of truth for controlled
renderer comparisons. Every live variant keeps the feed, window, line width,
feature flags, and fixed phases identical unless its description names that
dimension:

| Run | Isolated question |
| --- | --- |
| `static-control` | How much cost remains without the continuous chart loop? |
| `live-monotone-round` | What is the current production live baseline? |
| `live-monotone-sharp` | Do round caps and joins drive mask churn? |
| `live-linear-round` | Do cubic path verbs drive mask churn? |
| `live-linear-sharp` | What does the simplest built-in stroke cost? |
| `live-monotone-round-dense` | Does allocation volume scale with point density? |
| `live-monotone-round-tall` | Does allocation volume scale with mask area? |

List or dry-run the matrix without a connected phone:

```sh
python3 scripts/run_ios_renderer_matrix.py --list
python3 scripts/run_ios_renderer_matrix.py \
  --udid DEVICE_UDID --run live-monotone-round --dry-run
```

Run selected physical-device captures (omit `--run` to execute the full matrix):

```sh
python3 scripts/run_ios_renderer_matrix.py \
  --device Trooper --udid DEVICE_UDID \
  --capture both \
  --run static-control \
  --run live-monotone-round \
  --run live-linear-sharp
```

Compare legacy eval and Bundle Mode with identical phases and renderer inputs:

```sh
python3 scripts/run_ios_renderer_matrix.py \
  --device Trooper --udid DEVICE_UDID \
  --capture both \
  --run static-control \
  --worklets-mode legacy \
  --worklets-mode bundle
```

The mode is included in every trace, XML, and summary filename. Bundle Mode is
application-level configuration; published library consumers must configure
their own Babel and Metro setup. See the official
[Worklets Bundle Mode setup](https://docs.swmansion.com/react-native-worklets/docs/bundleMode/setup/).

The runner builds a Release bundle for each selection, records the same 65-second
timeline, exports Activity Monitor XML, and writes one Markdown phase summary
beside each trace. It refuses to overwrite traces unless `--force` is supplied.
Metro's transform cache is keyed by the selected run, mode, and cadence so a
sequential matrix cannot silently reuse the previous run's inlined environment.

## Bundle Mode simulator screen

The initial compatibility screen used Release builds of `static-control` on an
iPhone 17 simulator (iOS 26.5). It is an A/B/A process-RSS comparison: each app
was terminated, launched from its embedded bundle, sampled once per second for
the fixed 60-second route, and rebuilt whenever the Worklets mode changed.
Means exclude each phase's warm-up samples.

| Build | Baseline mean | Mounted mean | Unmounted mean | Mount delta |
| --- | ---: | ---: | ---: | ---: |
| Legacy A1 | 610.67 MiB | 744.88 MiB | 747.07 MiB | 134.21 MiB |
| Bundle Mode | 529.14 MiB | 552.95 MiB | 554.63 MiB | 23.81 MiB |
| Legacy A2 | 610.61 MiB | 744.69 MiB | 746.85 MiB | 134.08 MiB |

The two legacy passes agree within 0.2 MiB. Against their mean, Bundle Mode used
25.8% less RSS while the chart was mounted and reduced the incremental mount
delta by 82.3% (134.14 MiB to 23.81 MiB). This is a simulator screening result,
not a physical-device performance claim. It supports continuing the experiment
but does not replace the physical iOS/Android Activity Monitor, PSS/native-heap,
startup, CPU, and frame-time measurements required before recommending Bundle
Mode as the example-app default.

A single clean `expo export --platform ios --clear` per mode produced the
following build artifacts:

| Build | Metro modules | Hermes bytecode | Export wall time | Bundler max RSS |
| --- | ---: | ---: | ---: | ---: |
| Legacy | 2,089 | 5,648,356 B | 10.57 s | 3,154,755,584 B |
| Bundle Mode | 3,410 | 5,676,999 B | 10.33 s | 2,958,934,016 B |

Bundle Mode added 1,324 generated worklet modules and increased final Hermes
bytecode by 28,643 bytes (0.51%). The wall-time and bundler-RSS figures are
single-run diagnostics and should not be treated as benchmark conclusions.

## Physical footprint

The table uses samples from 5–15 seconds for baseline, 20–44 seconds for the
mounted phase, and 50–64 seconds for the unmounted phase. Values are the process
physical footprint reported by Activity Monitor.

| Variant | Baseline mean | Mounted mean |    Mounted max/last | Unmounted mean | Unmounted last |
| ------- | ------------: | -----------: | ------------------: | -------------: | -------------: |
| Static  |    123.55 MiB |   344.11 MiB | 355.08 / 355.08 MiB |     304.25 MiB |     303.77 MiB |
| Live    |    123.65 MiB |   497.55 MiB | 555.64 / 555.64 MiB |     502.52 MiB |     501.99 MiB |

Continuous rendering therefore added about 153 MiB to the mounted-phase mean
and about 200 MiB to the observed peak. After unmount, the live run remained
about 198 MiB above the static control. Allocations shows that most rendering
allocations were destroyed, so the post-unmount physical footprint should be
treated as an allocator/VM high-water observation rather than 198 MiB of proven
live objects.

## Allocation volume and lifetime

Whole-run Allocations statistics make the static/live distinction clear:

| Allocation class        |         Static total |           Live total |      Live persistent |
| ----------------------- | -------------------: | -------------------: | -------------------: |
| All heap + anonymous VM | 554.99 MiB / 706,388 | 3.36 GiB / 1,770,074 | 228.78 MiB / 177,780 |
| Malloc 256 KiB          |     176.00 MiB / 704 |     212.75 MiB / 851 |     173.00 MiB / 692 |
| Malloc 48 KiB           |      25.22 MiB / 538 |   329.48 MiB / 7,029 |          144 KiB / 3 |
| Malloc 20 KiB           |      15.51 MiB / 794 |   181.48 MiB / 9,292 |       2.11 MiB / 108 |
| Malloc 7 KiB            |    11.72 MiB / 1,714 |  158.94 MiB / 23,251 |        714 KiB / 102 |
| Malloc 144 KiB          |          288 KiB / 2 |        1.83 MiB / 13 |           negligible |

The 256 KiB class is different from the high-frequency rendering classes. Its
retained call path is:

`evalInEnvironment -> createBCProviderFromSrc -> hermes::Context -> BacktrackingBumpPtrAllocator`

That is Hermes bytecode-module storage created while installing worklets. It is
mostly persistent and remains after the chart unmounts. The upstream reproduction
under `reproductions/worklets-hermes-module-retention` isolates this behavior
without LiveChart or Skia.

By contrast, the 48 KiB, 20 KiB, and 7 KiB classes increase by an order of
magnitude only in live mode and nearly all instances are destroyed. In a steady
live interval after worklet installation, the dominant cumulative allocation
stack was:

`RNSkView::requestRedraw -> RNSkPictureRenderer::renderImmediate -> SkCanvas::drawPicture -> SkRecordDraw -> Device::drawPath -> SoftwarePathRenderer::onDrawPath -> GrSWMaskHelper::init -> SkAutoPixmapStorage::tryAlloc`

About 2.03 GiB flowed through the redraw/render stack in that selected interval;
about 1.61 GiB passed through Skia's software path renderer and about 816.75 MiB
through mask pixmap allocation. Only about 4.9 MiB created during the interval
was still persistent at its end. The remaining live-only cost is therefore
predominantly transient native Skia/Ganesh path rasterization and mask scratch
allocation, not growth of the JavaScript point array.

For context, reducing optional and duplicate chart worklets lowered the retained
256 KiB compilation bucket from 238.75 MiB (955 regions) in the original chart
to 173.00 MiB (692 regions). It also reduced the original 144 KiB allocation
volume from 81.14 MiB (577 allocations) to 1.83 MiB (13 allocations).

## JavaScript frame-allocation pooling

A follow-up source inventory isolated the remaining deterministic JavaScript
containers created at frame cadence. Focused identity tests drive the reusable
math, particle, and engine helpers repeatedly; the existing loading, reveal,
multi-series, and marker-variant component suites cover the integration paths.
Together they verify that caller-owned buffers are reused, truncated when inputs
shrink, and ping-ponged whenever a new SharedValue reference is required for
invalidation.

| Frame path | Before | After | Removed at 60 fps |
| --- | ---: | ---: | ---: |
| Loading squiggle | 1 number array/frame | 0 | 60 arrays/s |
| Reveal morph | 2 number arrays/frame | 0 | 120 arrays/s |
| Single-series engine | state + input objects | 0 | 120 objects/s |
| Multi-series engine | refs + state + input objects | 0 | 180 objects/s |
| Multi-series path list | 1 array/frame | 0 | 60 arrays/s |
| Marker Atlas lists | 2 arrays + result object | 0 | 180 containers/s |
| Degen Atlas (`N` active) | `N + 5` JS objects/containers + `N` sprite rects/frame | 0 of these classes | `300 + 60N` JS allocations/s + `60N` rects/s |

For example, a 32-particle burst avoids 2,220 JavaScript object/container
allocations and 1,920 identical sprite-rect host values per second while active.
The single-series steady engine removes 120 objects per second even with all
optional overlays disabled. These are exact call-site/identity counts, not
heap-size or frame-time claims; physical-device allocation rate, GC pauses,
CPU, and p90/p99 frame time still need to be recaptured.

The pools deliberately do not mutate published buffers in place: numeric and
Atlas result arrays ping-pong, so Reanimated/Skia still observe a reference
change while the previous frame remains readable. Immutable `SkPath` instances
returned by `PathBuilder.detach()` remain per-frame by design. Marker/particle
`Skia.RSXform` values and per-particle `Skia.Color` values also remain dynamic;
their contents change every frame and reusing them without an explicit Skia
ownership guarantee would risk mutating data still consumed by the renderer.

## Reproduce

Build and install each Release variant:

```sh
EXPO_PUBLIC_MEMORY_PROFILE_RUN=live-monotone-round npx expo run:ios \
  --device Trooper --configuration Release --no-bundler
```

Capture the 60-second route with Activity Monitor or Allocations:

```sh
xcrun xctrace record --template 'Activity Monitor' \
  --device DEVICE_UDID --time-limit 65s --output /tmp/livechart.trace \
  --launch com.brandtnewlabs.react-native-livechart

xcrun xctrace record --template 'Allocations' \
  --device DEVICE_UDID --time-limit 60s --output /tmp/livechart-alloc.trace \
  --launch com.brandtnewlabs.react-native-livechart
```

Export and summarize the Activity Monitor samples:

```sh
xcrun xctrace export --input /tmp/livechart.trace \
  --xpath '/trace-toc/run[@number="1"]/data/table[@schema="activity-monitor-process-live"]' \
  --output /tmp/livechart.xml
python3 scripts/summarize_activity_monitor.py /tmp/livechart.xml
```

## Follow-up targets

The next useful experiments are rendering-specific: avoid redraws when geometry
has not changed, cap the redraw rate below the display refresh rate, reduce path
or antialiasing complexity, and determine why this workload selects Ganesh's
software path renderer. The completed JavaScript pooling should reduce secondary
GC pressure, but it does not address the measured mask-pixmap churn. Pooling
immutable SkPath wrappers is still unlikely to affect that dominant native cost.
