# LiveChart 5.0 RC vs 4.28.1 — iPhone Release comparison

Measured on **2026-10-10**, on Lennart’s physical **iPhone 16**, iOS **26.6 (23G71)**, A18, USB, portrait **393 × 852 points**, nominal **60 Hz** display.

The 5.0 candidate reduces whole-process physical memory in every measured scene and CPU in the line and candle scenes. Multi-series uses more CPU while using substantially less memory. These findings cover the workloads below; they do not establish a general delivered-FPS improvement.

## Builds and controls

Both are locally signed **Release** builds with embedded Hermes bundles, Expo 57 / React Native 0.86, Reanimated 4.5.0 and Worklets 0.10.0 in **legacy mode**. Metro is not serving the measured app.

- **4.28.1:** workspace runtime source matches all **151 source files** in the published npm tarball; renderer **`@shopify/react-native-skia@2.6.4`**.
- **5.0.0-rc.0:** [PR #411](https://github.com/brandtnewlabs/react-native-livechart/pull/411), commit **`9bb550df83e0a8f18199a61dc0d774635d95cd7d`**; unmodified **`react-native-skia@3.3.0`**.
- Common npm dependency versions match. The iOS pod locks differ only in the renderer version, path and podspec checksum. The measured demo screens and feed source match byte for byte. The v3-only native diagnostic route is disabled in the v4 binary and is never visited in this test.

The current demo is held constant for both libraries, including Multi-series Smooth responsiveness (`0.03`) and outward range easing. This measures the library/required-renderer change without also changing the demo between revisions.

A temporary Mulberry32 feed uses seed **42815000**, including multi-series history and live updates. Values are deterministic by sequence; wall-clock timestamps and real timer/gesture delivery remain live. The QA-only changes were restored after the two test binaries were saved. All Git operations used the existing checkout.

| Scene | Workload |
| --- | --- |
| Line & area | Defaults: line/area, axes, badge, pulse and value line; 5 updates/s; live idle. |
| Candlestick | `15m · 1m`, volume and historical average-cost reference on; 2 updates/s; QA `timeScroll` enabled; five identical left/right pan pairs beginning at 0, 6, 12, 18 and 24 seconds. |
| Multi-series | Three series, 30s window, 0.7 updates/s; demo Pan + zoom off; four alternating native 3.5s horizontal drags beginning at 0, 5, 10 and 15 seconds; Yes off/on beginning at 20/25 seconds. |

Every capture cold-launches the route, completes scene setup, warms up **20 seconds**, then requests **30 seconds** of Metal System Trace plus Activity Monitor. Statistics use the common **2–28s** interior window. Timing is anchored to the native tracing-start notification; actual command and gesture timings are retained in each run’s events/telemetry files.

There are **three captures per version/scene: 18 captures total**. Pair order is **4→5, 5→4, 4→5**, with scene order line, candle, multi in each block. Every capture validates the app PID, physical-device UDID, display metadata, complete XML, continuing app process and **Nominal** thermal state.

## CPU and physical memory

Each cell is the mean of three capture means. CPU is cumulative process CPU-time growth divided by elapsed sample time; **100% equals one fully occupied logical core**, summed across app threads. Memory is the Activity Monitor **physical footprint**, weighted by sample duration within the window.

| Scene | 4.28.1 CPU | 5.0 RC CPU | CPU change | 4.28.1 memory | 5.0 RC memory | Memory change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Line & area | 48.96% | 37.06% | -24.3% | 764.2 MiB | 436.3 MiB | -42.9% |
| Candlestick | 42.88% | 36.30% | -15.3% | 672.8 MiB | 468.8 MiB | -30.3% |
| Multi-series | 49.27% | 53.46% | +8.5% | 861.7 MiB | 485.4 MiB | -43.7% |

Repeat ranges and paired CPU changes:

| Scene | 4.28.1 CPU range | 5.0 RC CPU range | CPU change in pairs 1 / 2 / 3 |
| --- | ---: | ---: | ---: |
| Line & area | 48.60–49.17% | 36.82–37.45% | -24.2% / -24.8% / -23.8% |
| Candlestick | 42.65–43.02% | 36.16–36.39% | -15.5% / -15.8% / -14.7% |
| Multi-series | 46.61–51.48% | 52.47–54.15% | +8.9% / +12.6% / +4.4% |

The Multi-series CPU increase appears in all three pairs. It is the measured tradeoff to investigate before claiming a performance improvement across every chart type. The memory reduction also repeats in every scene. Physical footprint during these short foreground runs does not determine retained-object lifetime or long-session behavior.

## Native timing and attribution limits

Metal encoding submissions and display presentation are different events. Some compositor intervals have no LiveChart label, even while the same app continues submitting draw work and the display continues swapping surfaces. These missing labels occur in both versions and vary between repeats.

For example, 4.28.1 Line run 1 has **519 unattributed gaps**: filtering only app-labelled intervals yields **39.97 Hz**, while its three-encoder draw stream is **60.09 submissions/s**. The next two 4.28.1 Line runs have continuous app attribution near 60 Hz. Multi-series run 2 has **334 gaps in 4.28.1** and **274 in 5.0**, producing label-only rates of **46.34 / 48.53 Hz** despite roughly 59-Hz three-encoder submission streams. Those label-only figures cannot establish delivered FPS or a frame-drop ratio.

The following diagnostic identifies the three-encoder buffer stream present in every scene. Multi-series also submits additional UI buffers during its drag intervals, so counting every nonempty command buffer would overcount frames. Submission cadence and Metal encoder duration describe the recorded buffer stream; they do not measure GPU execution or delivered FPS.

| Scene | 4.28.1 three-encoder submissions/s | 5.0 RC three-encoder submissions/s | 4.28.1 mean encoder duration | 5.0 RC mean encoder duration |
| --- | ---: | ---: | ---: | ---: |
| Line & area | 60.09 | 60.09 | 3.672 ms | 0.363 ms |
| Candlestick | 58.69 | 58.49 | 2.021 ms | 0.372 ms |
| Multi-series | 59.22 | 59.21 | 1.321 ms | 0.200 ms |

The predeclared presentation triage threshold was a >5% cadence loss or one nominal display-period increase in p99 repeated in two of three pairs. Incomplete attribution prevents applying that threshold as a general delivered-frame verdict. This test establishes the CPU/memory comparison; a reliable FPS ranking remains unresolved.

All app-labelled timing results are retained below, including the captures with attribution gaps. The >25ms fraction uses 1.5 nominal display periods and includes gaps between app labels. It is an observation in the exported stream, not Apple’s Animation Hitches metric.

## Individual captures

| Scene / pair / version | CPU | Memory mean / peak (MiB) | App-labelled cadence | p95 / p99 (ms) | Worst (ms) | >25ms | Attribution gaps |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Line & area / 1 / 4.28.1 | 48.60% | 765.3 / 769.1 | 39.97 Hz | 33.29 / 33.29 | 66.57 | 50.05% | 519 |
| Line & area / 1 / 5.0 RC | 36.82% | 435.6 / 437.8 | 59.87 Hz | 16.64 / 16.65 | 49.92 | 0.19% | 0 |
| Line & area / 2 / 4.28.1 | 49.11% | 764.4 / 767.9 | 60.02 Hz | 16.64 / 16.64 | 49.93 | 0.06% | 0 |
| Line & area / 2 / 5.0 RC | 36.92% | 435.9 / 438.6 | 59.86 Hz | 16.64 / 16.64 | 49.93 | 0.19% | 0 |
| Line & area / 3 / 4.28.1 | 49.17% | 762.9 / 766.7 | 59.94 Hz | 16.64 / 16.65 | 49.92 | 0.13% | 0 |
| Line & area / 3 / 5.0 RC | 37.45% | 437.4 / 440.2 | 59.79 Hz | 16.64 / 16.65 | 49.93 | 0.26% | 0 |
| Candlestick / 1 / 4.28.1 | 43.02% | 673.1 / 697.5 | 58.40 Hz | 16.64 / 33.28 | 49.93 | 2.24% | 2 |
| Candlestick / 1 / 5.0 RC | 36.34% | 468.9 / 471.8 | 58.10 Hz | 16.64 / 33.28 | 66.56 | 2.58% | 4 |
| Candlestick / 2 / 4.28.1 | 42.95% | 680.0 / 705.0 | 58.75 Hz | 16.65 / 33.28 | 49.93 | 1.83% | 3 |
| Candlestick / 2 / 5.0 RC | 36.16% | 468.9 / 472.2 | 58.33 Hz | 16.64 / 33.28 | 49.93 | 2.37% | 4 |
| Candlestick / 3 / 4.28.1 | 42.65% | 665.5 / 687.6 | 58.44 Hz | 16.64 / 33.28 | 66.56 | 2.11% | 4 |
| Candlestick / 3 / 5.0 RC | 36.39% | 468.7 / 471.7 | 58.21 Hz | 16.64 / 33.29 | 66.57 | 2.12% | 3 |
| Multi-series / 1 / 4.28.1 | 49.72% | 859.8 / 877.6 | 59.06 Hz | 16.64 / 33.28 | 66.56 | 1.11% | 1 |
| Multi-series / 1 / 5.0 RC | 54.15% | 485.6 / 487.4 | 59.10 Hz | 16.64 / 33.28 | 49.92 | 1.17% | 0 |
| Multi-series / 2 / 4.28.1 | 46.61% | 862.7 / 881.2 | 46.34 Hz | 33.28 / 33.29 | 83.20 | 28.28% | 334 |
| Multi-series / 2 / 5.0 RC | 52.47% | 485.4 / 487.1 | 48.53 Hz | 33.28 / 49.92 | 83.20 | 21.85% | 274 |
| Multi-series / 3 / 4.28.1 | 51.48% | 862.7 / 880.6 | 58.89 Hz | 16.65 / 33.29 | 66.58 | 1.18% | 0 |
| Multi-series / 3 / 5.0 RC | 53.75% | 485.3 / 487.1 | 59.13 Hz | 16.64 / 27.12 | 66.57 | 1.04% | 0 |

## Multi-series CPU investigation — follow-up

Published to [PR #411](https://github.com/brandtnewlabs/react-native-livechart/pull/411#issuecomment-6100874357); [original measurements](https://github.com/brandtnewlabs/react-native-livechart/pull/411#issuecomment-6100773104).

The original three Metal captures per version localize the increase to the scrub-heavy portion: **2–20s averages 49.87% CPU on 4.28.1 vs 57.95% on 5.0 (+16.2%)**. The **21–29s portion averages 47.47% vs 42.82% (-9.8%)**. That later portion includes the Yes visibility changes, so it is not a pure idle control. These are narrower windows of the existing captures, not additional independent trials.

Four additional physical-device Release captures use **Time Profiler + Activity Monitor + Thermal State**, without Metal System Trace. They reuse the exact saved signed benchmark binaries and seed. After cold launch, Pan + zoom is switched off; each run warms up 20s and records 60s: idle at 0–20s, four alternating native 3.5s scrubs at 20/25/30/35s, then idle to 60s. No series-visibility changes occur. Statistics use **2–18s / 22–39s / 42–58s** to exclude transitions. All four captures remain nominal thermal and keep the measured PID alive.

One pair uses the default tooltip pills, ordered 4→5. A second pair switches off only the existing **Pills** demo control, ordered 5→4; this removes the extra tooltip Canvas and its per-series layout/rendering work while leaving the main chart, crosshair, and animated text readout in place. Screenshots confirm the disabled control. This is **one exploratory pair per setting**, not a repeated ablation or a replacement for the original 18-capture comparison.

| Setting / phase | 4.28.1 CPU | 5.0 RC CPU | Change |
| --- | ---: | ---: | ---: |
| Pills on / idle before | 45.50% | 40.74% | -10.5% |
| Pills on / scrubbing | 58.41% | 60.80% | +4.1% |
| Pills on / idle after | 43.74% | 40.34% | -7.8% |
| Pills off / idle before | 45.01% | 40.19% | -10.7% |
| Pills off / scrubbing | 60.17% | 59.27% | -1.5% |
| Pills off / idle after | 42.73% | 39.42% | -7.7% |

The positive scrub difference appears again without Metal profiling, but its magnitude is smaller. Switching off pills changes this pair from **+4.1%** to **-1.5%**. This makes the tooltip/update path a useful lead. The old build also varies between the two configurations, so the relative change cannot be treated as the isolated cost of one Canvas. Repeat both settings before concluding the tooltip accounts for the full original +8.5% result.

Native samples identify concrete work to investigate:

- In 5.0 with pills on, the 17s scrub window has **832ms of inclusive sample weight** under `RNSkGraphiteProducer::applyUpdatesTo`; pills off has **675ms**. The corresponding idle-before windows have **384 / 403ms** over 16s. These samples include descendant calls, not just the function's own instructions.
- In the pills-on 5.0 scrub window, **186ms** of leaf `_platform_memcmp` samples descend through the `variables.find` and `_slotBase.at` string-map lookups in `Recorder::readUpdates`. Local source confirms the loop constructs `variableN`, looks up conversions and pending-write slots, reads shared values, and queues converted writes. Both renderers use variable-name lookups; 3.3 additionally manages pending writes/slots. This is an optimization candidate, not evidence that all lookup cost is new in 3.3.
- The animated readout is also expensive: inclusive samples with native TextInput/TextView frames total **1,347ms / 1,591ms** for 4.28.1 / 5.0 with pills on, and **1,630ms / 1,721ms** with pills off. They fall to roughly 13–30ms in idle windows. The demo formats all three series in `onScrub` and drives a multiline animated TextInput; its Fabric commits/layout need an independent readout-off control.
- 5.0 Graphite producer sample weight stays roughly **390–472ms** across these windows, while presentation adds separate work. This does not identify GPU execution time. The profiles and original encoding results give stronger leads in update/commit processing than in drawing more line geometry.

Inclusive categories overlap (for example Hermes execution can be inside a native property update); do not add them or compare them as a complete CPU partition. Call-stack structure and inlining differ between renderers. Cumulative Activity Monitor CPU remains the source for the CPU table.

The next controlled experiments are repeated pills-on/off pairs with the original Metal protocol, a readout-off variant preserving the chart geometry and gestures, and a native recorder variant caching variable/slot lookup metadata. A renderer fix should preserve pending-write ownership/thread safety and be measured before adoption. **No implementation change or root-cause claim is made by this investigation.**

Evidence: `.agent-device/multi-cpu-investigation-20261010/` contains all four traces, complete XML exports, events, screenshots, `profile.py`, `analyze.py`, per-run analyses and `comparison.json`. The inspected 2.6.4 renderer source comes from the locally cached published npm tarball. The normal 5.0 Release app has been reinstalled and launched after profiling; its native and Hermes hashes match the previously verified restored build. Tracked app/library source and dependencies were untouched during this follow-up.

## Fix experiments — no validated CPU fix yet

The earlier `demo-lib/AnimatedTrendTextInput.tsx` implementation documents a
native memory-growth problem with animated TextInput text, and its replacement
uses local React state plus native Text. That history made the Multi-series
readout a reasonable suspect, but removing its updates did **not** show a CPU
saving in the controls below. Inclusive TextInput samples identify a call path;
they do not isolate the CPU that disappears when that component is removed.

Thirteen additional successful physical-device Release captures use the same
seed, 20s warm-up, four 3.5s scrubs, Yes visibility changes, Metal System Trace
plus Activity Monitor, and 2–28s statistics as the original Multi-series protocol.
Every successful capture keeps its PID alive and remains nominal thermal.
Three interspersed controls reinstall the original signed 5.0 benchmark binary:
**52.69%, 53.44%, and 50.83% CPU** (mean **52.32%**, range **50.83–53.44%**).
These controls are not three paired repetitions of each candidate.

Each candidate below has **one exploratory capture**. The table records the
actual capture order, including the controls. Do not pool these trials with the
original version comparison or treat differences within the control range as a
validated improvement.

| Order | Variant | CPU | Physical memory (MiB) |
| --- | --- | ---: | ---: |
| 1 | Group tooltip values with Skia selectors | 54.31% | 471.4 |
| 2 | Original 5.0 control | 52.69% | 485.5 |
| 3 | Cache scrub series metadata; remove JSON round-trip; explicit worklet loops | 53.55% | 485.4 |
| 4 | Coalesce pointer moves to the UI frame callback | 55.55% | 486.5 |
| 5 | Original 5.0 control | 53.44% | 488.4 |
| 6 | Native TextInput `setTextAndSelection`, every value change | 51.79% | 487.6 |
| 7 | Native TextInput commands, coalesced to 10 Hz | 54.66% | 485.5 |
| 8 | Native Text with local React state, every value change | 61.29% | 490.2 |
| 9 | Native Text with local React state, coalesced to 10 Hz | 54.73% | 486.0 |
| 10 | Original 5.0 control | 50.83% | 486.9 |
| 11 | Readout updates off; static Text placeholder; original scrub callback retained | 52.85% | 483.0 |
| 12 | Readout updates and demo `onScrub` callback off | 52.42% | 485.6 |
| 13 | Native recorder: cached indexed bindings, unchanged primitive conversions skipped, pending writes batched | 53.00% | 485.0 |

Readout variants keep the original chart and tooltip props, formatting where
applicable, data feed and gesture protocol. The static placeholder retains the
original iOS readout's idle spacing. The callback-off control intentionally
removes callback publication/formatting as well. The native-recorder experiment
restores the original demo and all library source byte for byte; only two Skia
C++ headers change in that test binary. It snapshots shared values once, stores
no runtime-owned JSI values in the cache, and still converts objects every read.
It did not establish a CPU gain and has been reverted.

One earlier callback implementation crashed at the first scrub because a nested
`Array.map` callback was treated as a remote function by Worklets. Its incomplete
trace is excluded from the thirteen successful captures. Replacing that callback
with explicit loops fixed the crash; its successful result is order 3 above.

**No candidate is adopted. The original +8.5% Multi-series CPU observation remains
open.** The direct readout-off controls do not support attributing that increase
to TextInput alone, but one capture per setting cannot rule out a smaller cost
or prove an alternative cause. A replacement that commits native Text on every
pointer event also adds measurable whole-app work in this pilot.

Evidence is retained in `.agent-device/multi-cpu-fix-20261010/`: signed binaries,
source manifests, all successful traces and XML exports, the excluded crash,
per-run timing/screenshots, experiment patches and `pilot-results.json`. App,
library, simulation/configuration and native dependency source were restored;
none of the experimental readout behavior or native patches remains enabled.
The normal unmodified 5.0 Release app is rebuilt and reinstalled after testing.

## Reproduction and evidence

Local artifacts are under **`.agent-device/release-perf-5-vs-4-20261010/`** (Git-ignored): both signed benchmark app binaries, source/dependency manifests, published tarball verification, seed harness patch, build logs, 18 native traces, XML exports, individual presentation/activity samples, screenshots, action/gesture timing, `comparison.json` and `runs.csv`.

The scripts `prepare.py`, `variant.py`, `capture.py`, `remaining.py`, `summarize.py` and `finalize_data.py` preserve source setup, capture order, export recovery and statistics. `originals/` and `original-manifest.json` record the files restored byte for byte. Native build and Hermes hashes are:

| Build | Native binary SHA-256 | Embedded Hermes SHA-256 |
| --- | --- | --- |
| 4.28.1 | `bbe7288c979ccb427261c7acf96d5a5c5d8dde717ed182f6dac58edfbc05c197` | `ee3d7ae7a816409b8ab25d6fb3a343d932a24adc82f3692623cfd61551338d36` |
| 5.0 RC | `3d33d01d0f8a50cd8d73873922868f3e6e02c9b248a3e6b246946f91c6bdef65` | `3165ebdba1a79fe9dfe4ff5bcc5f3a8e9068c118eb34be0e7fb3b5b7527f9bb5` |

The complete native recordings are preserved despite initial Xcode exporter crashes. Recovery uses the same saved trace, explicit run selection, bounded retries and `LIBDISPATCH_COOPERATIVE_POOL_STRICT=1`; only fully parsed XML is accepted. Setup attempts that did not start a native recording are retained separately. All 18 completed measurements are included.

After restoring the original source, configuration and dependencies, declaration build and `npm run verify` passed: typecheck, lint, **148 suites / 2,144 tests**, with five existing skips. The regular 5.0 Release demo is rebuilt and reinstalled after benchmarking; its synthetic feed uses the original demo behavior.
