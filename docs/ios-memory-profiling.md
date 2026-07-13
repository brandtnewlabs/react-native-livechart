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

Setting `EXPO_PUBLIC_MEMORY_PROFILE_MODE` to `static` or `live` selects the
variant at bundle time and redirects the demo app to the profiling route. The
ordinary demo index is unchanged when the variable is absent.

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

## Reproduce

Build and install each Release variant:

```sh
EXPO_PUBLIC_MEMORY_PROFILE_MODE=static npx expo run:ios \
  --device Trooper --configuration Release --no-bundler

EXPO_PUBLIC_MEMORY_PROFILE_MODE=live npx expo run:ios \
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
software path renderer. Pooling JavaScript or SkPath wrappers is unlikely to
address the measured mask-pixmap churn.
