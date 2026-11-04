# Skia 3.9.1 candidate vs Shopify Skia — iPhone Release comparison

A [subsequent CPU investigation](performance-multi-series-cpu-investigation-iphone.md) adds a narrow reference-tag optimization and nine fresh before/after/Shopify captures. It is a partial mitigation; this report preserves the original unoptimized candidate measurements below.

Measured November 4, 2026 on Lennart’s physical iPhone 16, iOS 26.6 (23G71), 60 Hz. This is a fresh comparison of **published LiveChart 4.30.2 + `@shopify/react-native-skia@2.6.4`** against **the unpublished LiveChart 5 candidate + `react-native-skia@3.9.1`**. It compares complete implementations, including library and transitive renderer changes; it does not isolate the renderer alone. The earlier [3.3.0 versus 3.9.1 comparison](performance-skia-3.9.1-iphone.md) remains separate.

The candidate reduces average CPU by **24.4% for Line & area** and **16.8% for Candlestick**, while **Multi-series CPU increases 11.3%**. Those CPU directions repeat in all three pairs. Physical footprint falls **54–67%** across the measured scenes. The multi-series CPU tradeoff remains; this test does not establish a delivered-FPS improvement.

## CPU and physical memory

Cells average three capture means under the same profiling configuration. CPU is cumulative process CPU time divided by elapsed sample time: 100% means one occupied logical core, summed across all app threads. Memory is time-weighted Activity Monitor physical footprint. Changes are relative to Shopify.

| Scene | Shopify CPU | 3.9.1 CPU | CPU change | Shopify memory | 3.9.1 memory | Memory change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Line & area | 49.46% | 37.38% | -24.4% | 477.1 MiB | 156.8 MiB | -67.1% |
| Candlestick | 41.94% | 34.90% | -16.8% | 352.7 MiB | 162.3 MiB | -54.0% |
| Multi-series | 50.32% | 56.00% | +11.3% | 562.0 MiB | 184.9 MiB | -67.1% |

## Repeats

| Scene | Shopify CPU range | 3.9.1 CPU range | Paired CPU changes |
| --- | ---: | ---: | --- |
| Line & area | 49.36–49.55% | 36.23–39.26% | -20.8% / -26.8% / -25.8% |
| Candlestick | 41.58–42.63% | 34.74–35.16% | -17.5% / -16.3% / -16.5% |
| Multi-series | 48.82–51.71% | 55.81–56.25% | +8.8% / +10.9% / +14.3% |

## Controls and workloads

- Both binaries are fresh local Release builds using Xcode 27.2 beta 3 (27B5038j), iOS 27.2 SDK, and embedded Hermes bundles. Metro does not serve the measured app. No native renderer patches or presentation observers.
- Shopify runtime matches all 157 source files in the published 4.30.2 tarball byte for byte; tarball SHA-256 and verification are retained. The candidate is the same frozen 3.9.1 binary used in the preceding test, based on PR head `7b4c5c91c4969d46b40d28c701dd182e0f20e13f` plus the documented compatibility changes.
- Common runtime versions match: Expo 57.0.28, React Native 0.86.3, React 19.2.3, Reanimated 4.5.1, Worklets 0.10.1 in legacy mode. Renderer-specific dependencies differ as required by each package.
- The same demo and seeded feed run on both builds. Demo/feed source hashes match after normalizing only the renderer import namespace. Mulberry32 seed 42815000; values are deterministic by sequence, with live wall-clock timestamps and timer/gesture delivery.
- Eighteen new captures: three per version/scene. Pair order candidate→Shopify, Shopify→candidate, candidate→Shopify. Scene order line, candle, multi-series in each block. Earlier captures are not pooled into these measurements.
- Each capture cold-launches, warms up 20 seconds, then records 30 seconds of Metal System Trace plus Activity Monitor. Analysis uses the 2–28 second interior. Device identity, PID, complete XML, continued app process and nominal thermal state are checked.
- Both builds use system-wide Metal System Trace plus Activity Monitor recordings, with LiveChart statistics filtered by its verified PID. Targeted process lookup was unreliable; nine earlier completed targeted recordings, setup failures and one interrupted recovery recording are retained separately and excluded from this uniformly collected cohort.
- Line & area: defaults at five live updates/s. Candlestick: 15m · 1m, volume/reference enabled, two updates/s, five identical left/right historical pan pairs starting at six-second intervals. Multi-series: three series, 30-second window, 0.7 updates/s, Pan + zoom off, four alternating 3.5-second scrubs at 0/5/10/15 seconds and Yes off/on at 20/25 seconds.

## Frame timing and limits

App-labelled compositor intervals can have attribution gaps. Metal submissions count draw work, not delivered frames, and encoder duration is not GPU execution time. The table below preserves both diagnostics so missing labels are visible. A native drawable presentation observer is needed for a delivered-FPS ranking. These short foreground runs do not measure battery use or long-session memory behavior, and this comparison contains no Android measurements.

| Scene | Pair | Version | CPU | Memory (MiB) | App-labelled Hz | p99 (ms) | Gaps | Draw submissions/s |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Candlestick | 1 | Shopify 2.6.4 | 42.63% | 357.6 | 39.55 | 33.29 | 510 | 59.38 |
| Candlestick | 1 | Skia 3.9.1 | 35.16% | 162.7 | 59.13 | 33.28 | 0 | 59.36 |
| Candlestick | 2 | Shopify 2.6.4 | 41.62% | 352.9 | 58.91 | 33.28 | 1 | 59.18 |
| Candlestick | 2 | Skia 3.9.1 | 34.82% | 162.3 | 59.06 | 33.28 | 0 | 59.17 |
| Candlestick | 3 | Shopify 2.6.4 | 41.58% | 347.7 | 59.36 | 16.65 | 0 | 59.49 |
| Candlestick | 3 | Skia 3.9.1 | 34.74% | 162.0 | 59.21 | 33.28 | 0 | 59.28 |
| Line & area | 1 | Shopify 2.6.4 | 49.55% | 476.3 | 59.70 | 16.65 | 0 | 60.08 |
| Line & area | 1 | Skia 3.9.1 | 39.26% | 156.4 | 59.71 | 16.65 | 0 | 60.09 |
| Line & area | 2 | Shopify 2.6.4 | 49.47% | 477.7 | 59.94 | 16.65 | 0 | 60.10 |
| Line & area | 2 | Skia 3.9.1 | 36.23% | 156.9 | 60.02 | 16.65 | 0 | 60.09 |
| Line & area | 3 | Shopify 2.6.4 | 49.36% | 477.3 | 60.01 | 16.65 | 0 | 60.09 |
| Line & area | 3 | Skia 3.9.1 | 36.65% | 157.1 | 59.79 | 16.65 | 0 | 60.09 |
| Multi-series | 1 | Shopify 2.6.4 | 51.71% | 562.1 | 58.75 | 33.28 | 3 | 87.55 |
| Multi-series | 1 | Skia 3.9.1 | 56.25% | 184.5 | 59.09 | 33.28 | 0 | 87.49 |
| Multi-series | 2 | Shopify 2.6.4 | 50.43% | 561.2 | 58.98 | 27.79 | 0 | 87.35 |
| Multi-series | 2 | Skia 3.9.1 | 55.94% | 185.4 | 58.86 | 33.28 | 0 | 87.43 |
| Multi-series | 3 | Shopify 2.6.4 | 48.82% | 562.8 | 58.97 | 16.65 | 0 | 87.44 |
| Multi-series | 3 | Skia 3.9.1 | 55.81% | 184.8 | 58.59 | 33.29 | 7 | 87.41 |

## Evidence and restoration

Ignored artifacts are under `.agent-device/shopify-vs-skia391-20261104/`: published tarball/source verification, signed binaries, hashes, SDK/dependency manifests, original source archive, traces/XML, screenshots, timed gesture events, per-run summaries and `comparison.json`. `prepare.py`, `freeze_restore.py`, `capture.py`, `summarize.py`, `run_remaining.py` and `report.py` preserve setup and analysis. Failed startup attempts, if any, remain separate and do not enter the aggregate.

The prior 3.9.1 work is restored byte for byte after freezing the Shopify benchmark binary. No benchmark feed or Shopify dependency remains enabled in the checkout. No publication or remote PR update is performed.

After testing, the ordinary Skia 3.9.1 Release app was reinstalled and its Line & area launch verified. All original app/library inputs match their pre-comparison hashes. `npm run verify` passed typecheck, lint and 152 suites / 2,161 tests (five existing skips). The device automation session was closed.
