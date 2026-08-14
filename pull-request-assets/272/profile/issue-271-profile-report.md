# Issue 271 performance profile

- Commit: `894d0c4` (`codex/stable-line-decimation-271`)
- Device: iPhone 17 Pro simulator, iOS 26.5
- Build: Expo development build with a fresh Metro bundle
- Scenario: Playground Line chart, 1-minute window, 20 trades/second, normal volatility, fully saturated history
- Comparison: denoising disabled versus `denoising = 1.5` pixels

## Result

No measurable performance regression was found. The denoised run used less CPU in the directional
process snapshots, while matched native samples and normalized React work were effectively unchanged.

## Process snapshots

Five samples were taken at two-second intervals for each state, without React DevTools connected.

| Metric | Raw | Denoised (1.5 px) |
| --- | ---: | ---: |
| Mean CPU | 56.0% | 49.2% |
| Mean RSS | 1,164.6 MiB | 1,159.9 MiB |
| RSS movement during sample | +3.8 MiB | +2.2 MiB |

The CPU result is directional simulator data: denoising was 6.8 percentage points lower in this run.
The small RSS difference is within development-build and garbage-collection noise and is not treated
as a memory improvement.

## Matched native samples

Both states were sampled for ten seconds at ten-millisecond intervals against the exact simulator app
process.

| Metric | Raw | Denoised (1.5 px) |
| --- | ---: | ---: |
| Main-thread samples | 832 | 829 |
| Hermes interpreter top-of-stack samples | 65 | 60 |
| Skia `aaa_fill_path` samples | 21 | 19 |
| Physical footprint | 752.1 MiB | 752.2 MiB |
| Peak physical footprint | 778.0 MiB | 778.0 MiB |

The matched captures are effectively equal. The simplifier did not appear as a significant native
hotspot; it executes as a Hermes/Reanimated UI worklet, so its TypeScript function name is not exposed
as a native symbol.

## React profiles

The captures have different durations, so totals are normalized by wall-clock time.

| Metric | Raw | Denoised (1.5 px) |
| --- | ---: | ---: |
| Duration | 26.3 s | 10.9 s |
| Commits | 402 | 165 |
| Commits/second | 15.3 | 15.1 |
| Total React render time | 150.0 ms | 66.3 ms |
| React render time/second | 5.7 ms | 6.1 ms |
| Slowest recurring component, average | 0.4 ms | 0.4 ms |

The chart/path hooks did not appear in the React re-render list. The recurring work was the example's
animated trend text, confirming that live path calculation remains off the React render path.

## Limits

- Agent-device reports Apple frame-health metrics only for a connected physical iOS device, so this
  simulator run does not claim FPS or dropped-frame numbers.
- The agent-device/Xcode Time Profiler trace wrapper produced empty trace bundles in this simulator
  environment. Those invalid artifacts were excluded; matched native `sample` captures were used
  instead.
- Absolute CPU and memory values come from a development simulator build and should not be interpreted
  as production targets. The A/B comparison used the same process, device, chart, and workload.
