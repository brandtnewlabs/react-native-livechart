# Skia 3.9.1 vs PR #411’s Skia 3.3.0 — iPhone Release performance

Measured November 4, 2026 on Lennart’s physical iPhone 16, iOS 26.6 (23G71), 60 Hz. This tests the renderer upgrade within the LiveChart 5 release candidate; it is not a new comparison against published LiveChart 4.x.

Candlestick CPU fell 1.8% on average, with a small reduction in all three pairs. Line CPU fell 3.9% on average, but its paired changes vary from -9.3% to +1.6%. Multi-series CPU changed +0.1%. Memory changed less than 1% in every scene. This does not establish a broad performance improvement or resolve the earlier comparison against LiveChart 4.x.

A separate [current Shopify implementation comparison](performance-shopify-vs-skia-3.9.1-iphone.md) covers published LiveChart 4.30.2 with Shopify Skia 2.6.4 against this candidate, using 18 fresh captures. Its system-wide recording cohort is kept separate from this targeted comparison.

## Controls

- PR head `7b4c5c91c4969d46b40d28c701dd182e0f20e13f` in the existing local checkout. Both benchmark binaries were built today with Xcode 27.2 beta 3 and the iOS 27.2 SDK; historical measurements are not pooled. Three preliminary captures of the older-toolchain baseline and one failed recorder startup are retained separately and excluded.
- Candidate uses unmodified `react-native-skia@3.9.1`, explicit Android canvas options, and GPU atlas snapshots replacing the now-asynchronous CPU image helper. No native patches or presentation observers.
- Both use Expo 57.0.28, React Native 0.86.3, React 19.2.3, Reanimated 4.5.1, Worklets 0.10.1 in legacy mode, and embedded Hermes Release bundles. Skia also updates its transitive React reconciler from 0.31 to 0.33.
- Demo and feed source hashes match the saved baseline exactly. Mulberry32 seed 42815000; timestamps and timer/gesture delivery remain live.
- Three captures per version and scene: 18 total. Pair order 3.9→3.3, 3.3→3.9, 3.9→3.3; scenes line, candle, multi-series in each block.
- Every capture cold-launches, warms up 20 seconds, records 30 seconds of Metal System Trace plus Activity Monitor, and uses the 2–28 second interior. Device ID, app PID, continued process life and complete XML exports are checked. All retained captures have nominal thermal state.

## CPU and memory

CPU is cumulative whole-process CPU-time growth divided by elapsed sample time; 100% represents one occupied logical core. Memory is time-weighted physical footprint. Cells average three capture means.

| Scene | 3.3 CPU | 3.9 CPU | CPU change | 3.3 memory | 3.9 memory | Memory change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Line & area | 38.00% | 36.53% | -3.9% | 157.7 MiB | 156.8 MiB | -0.6% |
| Candlestick | 35.93% | 35.29% | -1.8% | 162.3 MiB | 162.4 MiB | +0.0% |
| Multi-series | 56.53% | 56.58% | +0.1% | 184.9 MiB | 184.7 MiB | -0.1% |

## Workloads and repeat ranges

Line & area uses defaults at five live updates/s. Candlestick uses 15m · 1m, volume and average-cost reference, two updates/s, and five left/right historical pan pairs at six-second intervals. Multi-series uses three series, a 30-second window, 0.7 updates/s, Pan + zoom disabled, four alternating 3.5-second scrubs beginning at 0/5/10/15 seconds, and Yes off/on at 20/25 seconds. Gesture events and screenshots are saved per capture.

| Scene | 3.3 CPU range | 3.9 CPU range | Paired CPU changes |
| --- | ---: | ---: | --- |
| Line & area | 36.90–40.13% | 35.71–37.47% | -9.3% / +1.6% / -3.4% |
| Candlestick | 35.72–36.27% | 35.15–35.42% | -2.4% / -1.5% / -1.6% |
| Multi-series | 55.32–57.72% | 55.77–57.07% | -3.4% / +0.6% / +3.2% |

## Timing limits

App-labelled compositor intervals and Metal submissions are diagnostics. Missing app labels cannot be counted as dropped frames. Encoder duration is not GPU execution time. This run does not use a native drawable presentation observer, so it does not establish a delivered-FPS ranking. Three short foreground captures per setting do not establish battery use, long-session memory behavior or general Android performance.

In Skia 3.9.1 Line runs 2 and 3, the app-labelled stream has 517 and 516 attribution gaps and reports 20.03 Hz, while draw submissions remain 60.09/s. The baseline line captures and the first upgraded line capture have continuous attribution near 60 Hz. A native drawable `presentedTime` observer is needed to distinguish missing attribution from missed presentation; frame-pacing parity remains unresolved.

## Individual captures

| Scene | Pair | Skia | CPU | Memory (MiB) | App-labelled Hz | p99 (ms) | Attribution gaps |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Candlestick | 1 | 3.3.0 | 36.27% | 162.0 | 58.74 | 33.28 | 0 |
| Candlestick | 1 | 3.9.1 | 35.42% | 163.0 | 59.20 | 33.28 | 0 |
| Candlestick | 2 | 3.3.0 | 35.81% | 162.5 | 58.75 | 33.28 | 1 |
| Candlestick | 2 | 3.9.1 | 35.29% | 162.1 | 59.33 | 33.28 | 0 |
| Candlestick | 3 | 3.3.0 | 35.72% | 162.5 | 59.05 | 33.28 | 0 |
| Candlestick | 3 | 3.9.1 | 35.15% | 162.2 | 59.33 | 26.29 | 0 |
| Line & area | 1 | 3.3.0 | 40.13% | 157.7 | 59.86 | 16.64 | 0 |
| Line & area | 1 | 3.9.1 | 36.40% | 156.9 | 59.79 | 16.65 | 0 |
| Line & area | 2 | 3.3.0 | 36.90% | 157.8 | 59.78 | 16.65 | 0 |
| Line & area | 2 | 3.9.1 | 37.47% | 156.7 | 20.03 | 49.93 | 517 |
| Line & area | 3 | 3.3.0 | 36.98% | 157.8 | 59.78 | 16.65 | 0 |
| Line & area | 3 | 3.9.1 | 35.71% | 156.7 | 20.03 | 49.93 | 516 |
| Multi-series | 1 | 3.3.0 | 57.72% | 184.7 | 58.47 | 33.29 | 0 |
| Multi-series | 1 | 3.9.1 | 55.77% | 184.5 | 58.93 | 33.29 | 0 |
| Multi-series | 2 | 3.3.0 | 56.56% | 184.7 | 59.25 | 26.63 | 0 |
| Multi-series | 2 | 3.9.1 | 56.89% | 184.6 | 58.83 | 33.28 | 0 |
| Multi-series | 3 | 3.3.0 | 55.32% | 185.3 | 58.82 | 33.28 | 0 |
| Multi-series | 3 | 3.9.1 | 57.07% | 185.0 | 59.01 | 33.28 | 0 |

## Evidence and verification

Ignored evidence: `.agent-device/skia-latest-20261104/` contains benchmark binaries, hashes, source/dependency manifests, harness patch, native traces, complete XML, screenshots, timed gestures, per-run samples and `comparison.json`. `capture.py`, `summarize.py`, `run_formal_remaining.py`, and `report.py` preserve the protocol and analysis. The temporary seeded feed and candlestick profiling option are removed from tracked app source after freezing the benchmark binary.

The upgrade follows the [official Skia migration guide](https://wcandillon.github.io/react-native-skia/docs/getting-started/migration/). Typecheck, lint and 152 suites / 2,161 tests pass (five existing skips); declarations build and React Doctor 98/100 pass. Android native validation is not included in this iPhone comparison. No npm publication, merge or remote PR update is performed.

The ordinary, uninstrumented 3.9.1 Release app was restored and passed six physical-iPhone route checks, including marker/degen initialization, plus GPU snapshot and imperative replay checks. Native screenshots confirm marker glyphs, a forced Heavy particle burst, and replayed content.
