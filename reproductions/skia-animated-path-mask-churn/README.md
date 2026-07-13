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

The Static, Animate, and Unmount buttons allow repeating each phase manually.
