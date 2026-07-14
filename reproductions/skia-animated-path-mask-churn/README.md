# Skia animated-path mask-churn reproduction

This standalone Expo app isolates transient native allocation churn from
redrawing one antialiased Skia path on iOS. It imports neither LiveChart nor any
application data pipeline.

The `SkPath` is created once on the JavaScript thread and contains 900 line
segments. During animation, only a two-pixel subpixel translation changes at
display cadence. This intentionally excludes JavaScript arrays, chart worklets,
path builders, and per-frame `SkPath` construction from the experiment.

| Time | Phase | Canvas behavior |
| --- | --- | --- |
| 0–15 s | baseline | no Skia canvas mounted |
| 15–35 s | static | immutable path drawn once |
| 35–65 s | animated | the same path moves at display cadence |
| 65 s onward | unmounted | no Skia canvas mounted |

The canvas is intentionally absent during the first 15 seconds. A dark empty
app background at launch is the baseline phase, not a failed render. The phase
label and cyan path appear when the static phase begins.

## Run on a physical iPhone

From this directory:

```sh
npm install
npx expo run:ios --device --configuration Release --no-bundler
```

Record the installed Release app with Instruments' Allocations template for at
least 75 seconds. Do not use the simulator: its command-line Activity Monitor
recording does not produce a valid trace for this workflow.

```sh
xcrun xctrace record \
  --template Allocations \
  --device DEVICE_UDID \
  --time-limit 75s \
  --output /tmp/skia-animated-path-mask-churn.trace \
  --launch com.brandtnewlabs.skia-animated-path-mask-churn
```

Compare allocations created in the static interval (15–35 s) with the animated
interval (35–65 s). The expected animated-only call tree is:

```text
RNSkView::requestRedraw
  → RNSkPictureRenderer::renderImmediate
  → SkCanvas::drawPicture
  → Device::drawPath
  → SoftwarePathRenderer::onDrawPath
  → GrSWMaskHelper::init
  → SkAutoPixmapStorage::tryAlloc
```

The parent LiveChart capture sent about 2.03 GiB through the redraw/render stack
in its selected steady-live interval, including about 1.61 GiB through the
software path renderer and 816.75 MiB through mask pixmap allocation. Almost all
of it was destroyed before the interval ended. This reproduction is meant to
confirm that the same transient mask churn survives after chart data, path
construction, and wrapper lifetime are removed.

## Physical-device result (2026-07-14)

A Release capture on an iPhone 17 Pro Max running iOS 26.6 measured:

| Phase | Physical-footprint mean | Min | Max | Last |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 104.32 MiB | 103.78 MiB | 105.08 MiB | 105.08 MiB |
| Static path | 212.09 MiB | 198.41 MiB | 221.75 MiB | 221.75 MiB |
| Animated path | 492.97 MiB | 491.99 MiB | 494.94 MiB | 492.72 MiB |
| Unmounted | 430.03 MiB | 430.02 MiB | 430.06 MiB | 430.06 MiB |

The immutable path therefore added about 281 MiB when display-cadence redraws
were enabled, without changing JavaScript data or rebuilding the `SkPath`.
Across the complete Allocations run, 4.76 GiB flowed through heap and anonymous
VM allocations while only 115.37 MiB remained. The 48 KiB allocation class
accounted for 749.48 MiB across 15,989 allocations but retained only 288 KiB.
This independently reproduces high-volume transient native rendering churn.

The Static, Animate, and Unmount buttons allow repeating each phase manually.
