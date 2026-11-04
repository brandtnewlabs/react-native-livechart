# Multi-series CPU investigation and partial mitigation — iPhone

Measured November 4, 2026 on Lennart’s physical iPhone 16. **The full CPU regression is still unresolved.** Narrowing the native reference-tag style mapper removes unnecessary updates; this is a bounded internal optimization, not a claim of parity with Shopify.

## Repeated comparison

All figures below are from nine new, uniformly collected Release captures. Each cell averages three capture means. CPU is cumulative app process CPU-time growth divided by elapsed sample time; 100% is one occupied logical core across all threads. Memory is time-weighted Activity Monitor physical footprint.

| Implementation | CPU | CPU range | Physical memory |
| --- | ---: | ---: | ---: |
| Published 4.30.2 + Shopify Skia 2.6.4 | 51.60% | 50.18–53.83% | 563.0 MiB |
| 5 candidate + Skia 3.9.1 before optimization | 55.47% | 55.06–56.16% | 185.0 MiB |
| 5 candidate + Skia 3.9.1 with narrower tag dependencies | 54.35% | 53.23–55.02% | 184.8 MiB |

The optimization changes CPU by **-2.0%** relative to the unmodified 3.9.1 candidate (-1.11 percentage points). Its paired changes are -5.2% / -0.3% / -0.4%. CPU remains **+5.3%** relative to Shopify in this cohort. These are descriptive means from three short pairs, not a statistical significance claim. Historical captures are not pooled into these numbers.

## Where the remaining difference appears

Exploratory subwindows of these same nine captures (not additional independent trials) separate the scrub-heavy 2–20s period from the 21–28s post-scrub period. The latter still includes the Yes visibility toggle at 25s and its animations; it is not a pure idle control. CPU uses first-to-last cumulative counters within each subwindow, so these phase means are not an additive partition of the whole capture.

| Implementation | Scrub-heavy CPU | Post-scrub/toggles CPU |
| --- | ---: | ---: |
| Shopify | 52.88% | 48.16% |
| 3.9.1 before | 61.27% | 42.46% |
| 3.9.1 with narrower dependencies | 60.37% | 39.84% |

The reference-tag change removes avoidable work, but the remaining disadvantage is concentrated in the scrub-heavy phase. These windows localize the next investigation; they do not establish which individual tooltip or readout operation causes the difference.

## Adopted change

`CustomReferenceLineView` previously referenced `engine.canvasWidth` inside `useAnimatedStyle`. Reanimated recursively scans every SharedValue in a captured plain object, so capturing `engine` subscribed the native style mapper to the chart clock, range and other frame outputs. The mapper returns a new transform array; Reanimated’s shallow style comparison sees that array as changed even when a tag stays pinned at the same coordinates.

The style worklet now captures the width SharedValue separately and continues to depend on the existing derived y, edge and stack offset, plus measured tag size. Clock/range updates that leave those results unchanged no longer force a native transform submission. The same inefficiency exists in the published implementation, so this optimization does not by itself identify the cause of the renderer-version difference.

The change retains the separate tooltip Canvas above native annotations, existing tooltip styling and fade, callbacks, interpolation, scrubbing and legend behavior. There is no public API change or native dependency patch.

## Profiling and rejected experiments

A separate diagnostic Time Profiler + Activity Monitor pair reproduced the increase without Metal tracing: 56.02% CPU for 3.9.1 versus 49.98% for Shopify. In the 3.9.1 running samples, the main thread accounts for 12.233 seconds of 14.651 sampled CPU seconds in the 2–28 second window; Hermes and native Fabric commits are prominent. Inclusive stack categories overlap and are not a CPU partition. The Shopify app/framework frames were manually symbolicated against their UUID-verified frozen binaries; unrecognized system frames remain unresolved. These diagnostic samples are separate from the repeated comparison.

Single exploratory Metal pilots, excluded from the aggregate above:

| Prototype | CPU | Outcome |
| --- | ---: | --- |
| Record the whole tooltip as a picture | 56.24% | Reverted; no demonstrated gain |
| Pool tooltip rounded-rectangle geometry | 56.68% | Reverted; no demonstrated gain |
| Draw tooltip directly through a Graphite view | 55.52% | Reverted; insufficient gain for the larger rewrite |
| Frame-coalesce pointer updates and cache repeated text widths | 56.27% | Reverted; no demonstrated gain |
| Narrow reference-tag native style dependencies | 54.96% | Retained for the repeated comparison |

These pilots used different setup paths and one capture each; they are screening evidence, not precise pairwise rankings. A single-Canvas prototype was excluded before measurement because the benchmark’s custom native annotation requires the tooltip to remain above it. Its control setup attempt failed and is retained separately.

## Controls and limits

- PR #411 head `7b4c5c91c4969d46b40d28c701dd182e0f20e13f`, previous 3.9.1 compatibility work, and the isolated reference-tag optimization. The original signed candidate and published Shopify binaries are reused as frozen controls. Before/fixed/normal 3.9.1 native Mach-O payloads match after excluding code signatures; the embedded worklet closures independently confirm the narrower captured inputs in the benchmark and restored app. Published Shopify runtime source matches its 4.30.2 tarball; this is a complete implementation comparison, not a renderer-only experiment.
- Physical iPhone 16, iOS 26.6 (23G71), 60 Hz; Xcode 27.2 beta 3 and iOS 27.2 SDK. Common Expo 57.0.28, React Native 0.86.3, React 19.2.3, Reanimated 4.5.1 and Worklets 0.10.1 in legacy mode. Embedded Hermes Release bundles; no Metro server.
- Same seeded feed and demo, Mulberry32 seed 42815000, three series, 30-second window, 0.7 updates/s. Pan + zoom is disabled through the existing control. Four alternating 3.5-second native scrubs begin at 0/5/10/15 seconds, with Yes off/on at 20/25 seconds. Chart and readout stay enabled.
- Cold launch, the earlier fast control-finding swipes, with a small off-screen-control recovery if needed, 20-second warmup after control setup, then 30-second all-process Metal System Trace plus Activity Monitor. Analysis uses 2–28 seconds. Each app PID, continued process life, device identity and nominal thermal state are checked. Only TOC, Activity Monitor and thermal tables are exported for this CPU-focused cohort; full Metal traces are retained.
- Build order: fixed→before→Shopify; Shopify→before→fixed; before→fixed→Shopify. Three captures per implementation. This cohort restores the earlier fast setup. A preliminary slower-setup cohort produced a different Shopify baseline (55.04% and 55.51% CPU); five completed captures and one abandoned setup are retained separately under `validation/` and are excluded here. No trace was interrupted. The slower setup advances the seeded live feed further before recording, so it is not pooled with this cohort.
- No delivered-FPS or GPU-execution claim. Prior compositor attribution gaps remain unresolved. Short foreground runs do not establish battery use, long-session memory behavior, or Android performance.

## Validation and evidence

The regression test inspects the actual Babel-generated worklet closure and fails with the original source. It also checks that width changes and above/in-range/below transitions still update the style through the intended inputs. Existing custom-reference integration tests continue to pass. `npm run verify` passes (153 suites, 2,162 tests, five existing skips), the declaration build passes, and React Doctor remains 98/100. Focused physical-device QA on the normal Release app confirms the reference tag above the plot, the built-in in-range fallback, and the below-plot tag/caret; screenshots are retained.

Ignored artifacts under `.agent-device/multi-cpu-391-fix-20261104/` retain frozen signed apps, source prototypes, original source backups, diagnostic profiles/XML, manual-symbolication helper, native screenshots/recordings, pilot captures, test logs and the `validation-fast/` cohort with raw traces, timed events, screenshots, per-run summaries, `plan.json` and `comparison.json`. `validate_fast.py`, `capture.py`, `summarize.py`, `report_validation.py` and `phase_analysis.py` preserve the protocol and calculations.

The deterministic benchmark harness is removed from the checkout. The normal Release app is rebuilt from the retained change and restored for focused physical-device QA. The benchmark device session is released afterward. No publication, commit or remote PR change is performed.
