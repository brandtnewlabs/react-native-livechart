# Skia 3.3 migration: physical-device verification

2026-10-09–10 · issue [#409](https://github.com/brandtnewlabs/react-native-livechart/issues/409)

[Verification results posted to the issue](https://github.com/brandtnewlabs/react-native-livechart/issues/409#issuecomment-6091755241).

The corrected native atlas fix is submitted as
[React Native Skia PR #4193](https://github.com/wcandillon/react-native-skia/pull/4193),
targeting upstream `main`. Its single commit contains exactly the eight native
files tested here; upstream originals and submitted changes were verified against
the pre-patch and compiled-source SHA-256 manifests. The PR is open and mergeable.
GitHub CI reports `action_required` with no jobs started, awaiting upstream
maintainer workflow approval. Upstream review, CI, merge and a renderer release
remain outstanding. This is a separate upstream optimization investigation;
the allocation evidence does not establish a regression from Skia 2.6.4.

The working-tree candidate is now prepared as unpublished **LiveChart 5.0.0-rc.0**;
see [release preparation](skia-3-release-preparation.md) for the verified local
tarball. On 2026-10-10 the experimental patch was removed from the example,
installed native sources and package at the user's request. Physical QA below
is historical: its final sweeps used the patch. Fresh unmodified-renderer device
verification is pending; see the exact next tasks at the end of this report.

The working-tree candidate replaces the Shopify renderer with
`react-native-skia@3.3.0`, the latest published 3.3.x at verification time. This
is preparation for a new LiveChart major, not a published 4.x compatibility claim.
Physical Android/Vulkan verification is complete on the Solana Seeker.
Maintained-v2 native verification remains open.

The physical iPhone visual sweep covered all 39 demos and six implemented
showcases. No crash, runtime error overlay, or obvious renderer failure was
observed. Focused gesture and state checks passed as detailed below. The user
confirmed physical pinch zoom manually. Two subsequent native Metal System Trace
captures recovered quantitative display-timing data for the default and
dense-dots Line & area scenes. A subsequent 15-minute Allocations run plus
two minutes of teardown showed the early memory rise reversing and clear
reclamation after unmount. The follow-up completed 20 measured mount/unmount
cycles, eight labels-on/off allocation captures, and the same 45-route sweep
on the physical Seeker. Text-only reproduction isolated freed glyph-atlas
allocation churn. A subsequent local native patch eliminates that bucket's churn
in two fresh corrected-patch captures. Both final phone builds passed all 45
routes, and the Kraken header correction passes center taps on both. Those final
builds used the experimental renderer patch, now removed. It is not included
in the candidate or applied by the example's postinstall. The old-version
allocation behavior has not been measured with the same text-isolation workload.

## Environment and checks

- Existing checkout, starting at `83fac7b` (LiveChart 4.28.0); existing unrelated
  local changes preserved. No alternate checkout or worktree.
- iPhone von Lennart: physical iPhone 16 (`iPhone17,3`), iOS 26.6 (`23G71`), USB,
  device UDID `00008140-000959AC2193801C`.
- Xcode 26.6; signed Release build, embedded Hermes bundle, no Metro connection.
- Solana Seeker: physical Android 16 / API 36, arm64-v8a, 4 KiB pages,
  Mali-G615 MC2 GPU. Local Release APK has min SDK 26 and target SDK 36;
  its embedded Hermes bundle runs without Metro. Native Dawn logs confirm Vulkan.
- Expo 57.0.1, React 19.2.3, React Native 0.86.0, Reanimated 4.5.0, Worklets
  0.10.0, Gesture Handler 2.32.0; Worklets legacy eval mode for both comparisons.
- Skia baseline: `@shopify/react-native-skia@2.6.4`; candidate:
  `react-native-skia@3.3.0`, Graphite/Dawn binaries 154.2.0.
- `npm run verify`: typecheck/lint passed; 148 suites, 2,139 tests passed,
  five skipped. `npm run build:lib` and `npm run pack:lib` passed.
- React Doctor changed-file scan: 98/100, no diagnostics.
- Root and packed-consumer dependency trees and iOS autolinking each contain
  exactly one Skia module, resolving the new package at 3.3.0. The pod lock
  resolves `react-native-skia` 3.3.0 from `node_modules/react-native-skia`.
- All 453 packed source/declaration files were audited: zero imports of the old
  package. A clean npm consumer under `.expo/skia409-consumer` installed the
  tarball and peers, typechecked exported font/image types, and produced an iOS
  Hermes bundle (1,431 modules, about 4.1 MB). No Shopify package was installed.
- Removed Canvas props/types (`debug`, `colorSpace`, `androidWarmup`,
  `NativeSkiaViewProps`) have no library/example uses. `canvasMode` still uses
  the supported `opaque` prop.

## Controlled physical-device profile

Both versions ran the checked-in `live-monotone-round` profile: 10 updates/s,
40-second seeded history, 30-second viewport, maximum 2,000 points, a 150px
chart, monotone curve, round joins/caps, 2px line. Optional overlays/fill,
axes, dots, and gestures were disabled. The producer remained mounted throughout
15 seconds without a chart, 30 seconds with the chart, and 15 seconds after
unmount. Activity Monitor recorded 65 seconds.

Means exclude phase transitions: baseline 5–15s, mounted 20–44s, unmounted
50–64s. Physical footprint is process memory, including worklet installation
and allocator high-water behavior; retained memory alone does not establish a
leak. CPU is Instruments' process % CPU, not UI-thread time or GPU frame time.

| Renderer | Mounted mean | Mounted peak | After-unmount mean | Mounted mean CPU |
| --- | ---: | ---: | ---: | ---: |
| Shopify 2.6.4 | 493.39 MiB | 514.05 MiB | 459.65 MiB | 34.64% |
| Graphite 3.3.0 | 349.75 MiB | 352.17 MiB | 326.61 MiB | 23.64% |

The single-run screen shows 29.1% lower mounted memory, 31.5% lower peak memory,
and 31.7% lower process CPU. This is an initial comparison, not a replicated
performance guarantee. Repeat runs and broader devices/platforms are needed
before making a general claim.

Reproduce in the existing checkout with each renderer installed in turn:

```sh
python3 scripts/run_ios_renderer_matrix.py \
  --device 'iPhone von Lennart' --udid 00008140-000959AC2193801C \
  --run live-monotone-round --capture activity --worklets-mode legacy \
  --output-dir .agent-device/skia409/RENDERER
```

The local raw captures and XML are under `.agent-device/skia409/baseline/` and
`.agent-device/skia409/v3/`; `.agent-device/skia409/comparison.json` contains the
phase measurements. These ignored artifacts are retained locally.

## Tooling observations

The inherited Ruby GEM_PATH mixed Ruby versions during pod installation. Running
`env -u GEM_HOME -u GEM_PATH pod install --project-directory=ios` succeeded.
Xcode's first candidate Activity Monitor export crashed; retrying export from
that same saved trace succeeded. Screenshots during Instruments launch showed
an empty app surface for both renderers; normal cold launch produced the expected
UI. Visual QA uses normal foreground launches rather than those screenshots.

## Sustained foreground line run

A separate 180-second Activity Monitor attachment kept the normal foreground
Line & area demo alive with its default normal feed (5 updates/s, 40-second
history seed). The interaction portion selected a three-color stroke, animated
stroke/fill, Fade to green, then Dense area dots. These add shader and worklet
cost compared with the bare controlled profile above.

| Sample interval | Mean physical footprint | First → last |
| --- | ---: | ---: |
| 90–120s | 470.13 MiB | 468.47 → 471.06 MiB |
| 120–150s | 471.50 MiB | 471.08 → 472.00 MiB |
| 150–179s | 472.77 MiB | 472.00 → 473.34 MiB |

The final minute gained about 2.3 MiB. This short run did not establish flat
long-term memory behavior or a leak. The longer allocation follow-up below
checks whether growth continues in this scene. Raw short-run samples are retained in
`.agent-device/skia409/sustained-samples.json`.

## Sustained allocation and teardown follow-up

On the same physical phone, a cold launch of the local Release candidate opened
Line & area, selected Animated color mode, Fade to green (settled before capture),
and Dense area dots. The normal 5-updates/s producer, 40-second history seed,
30-second viewport, axes, badge, pulse and fill stayed enabled. The producer's
history is bounded at 2,000 points; the late analysis window follows the expected
time to reach that cap, though runtime point count was not sampled.

**Allocations + Activity Monitor** attached to foreground `LiveChart (11803)`.
The complete trace lasted **1,020.888 seconds**: approximately 15 minutes with
the chart mounted, followed by two minutes on the Demos list. The Back to demos
action confirmed unmount at about 15:06. No screen recording or repeated gestures
ran during the live window; screenshots were taken before capture and just before
unmount. Native recording finished successfully at its time limit.

The complete Activity Monitor XML supplies **959 app samples**, with a maximum
gap of 1.105 seconds. Means below exclude the unmount transition.

| Sample interval | Mean physical footprint | First → last |
| --- | ---: | ---: |
| 8–10 minutes, mounted | 524.60 MiB | 527.67 → 521.20 MiB |
| 13–15 minutes, mounted | 511.81 MiB | 513.99 → 511.33 MiB |
| 15:30–17:00, unmounted | 455.19 MiB | 455.14 → 455.30 MiB |

Memory rose during the early minutes, reached a mounted peak of **531.19 MiB**,
then fell. Across minutes 8–15, footprint declined **16.34 MiB**; its fitted slope
was −2.60 MiB/minute. The final live sample versus the post-unmount mean shows
about **56.14 MiB reclaimed**. The subsequent 90-second window changed by only
0.16 MiB, and process CPU averaged 0.68% after teardown.

Native Instruments Statistics, over the full capture including teardown, reported:

| Allocation category | Persistent at trace end | Persistent count | Freed count | Cumulative allocated bytes |
| --- | ---: | ---: | ---: | ---: |
| All heap & anonymous VM | 349.22 MiB | 414,552 | 37,799,995 | 22.65 GiB |
| Malloc 256 KiB | 273.50 MiB | 1,094 | 54,212 | 13.50 GiB |
| Shared `SkPathBuilder` allocation category | 210.44 KiB | 481 | 363,942 | 155.70 MiB |

About **98.9% of allocation events were freed** by trace end. Cumulative bytes
count repeated allocation turnover; **22.65 GiB is not peak or resident memory**.
The native Created & Destroyed heaviest stack runs through
`RNSkGraphiteProducer::produce` → `TextCmd::draw` → Graphite glyph drawing →
`GlyphData::regenerateAtlas` → `TextAtlasManager::addGlyphToAtlas` →
`DrawAtlas::Plot::copySubImage` → allocation. Text/glyph-atlas churn is therefore
a concrete optimization lead. It was freed during this capture, so that stack
does not establish a retained-memory leak.

The Created & Persistent heaviest stack includes Hermes execution and Worklets
serialization (`toOptimizedObject` / `SerializableWorklet` / `SerializableObject`).
Because capture attached after scene initialization, existing allocations lack
their original creation stacks. In particular, the large retained 256 KiB size
bucket cannot all be attributed to one subsystem from this attachment.
Persistent heap bytes and physical footprint measure different things and should
not be substituted for each other. Apple's
[Allocations guidance](https://developer.apple.com/library/archive/technotes/tn2434/_index.html)
describes the lifetime and call-tree workflow used here.

**Conclusion:** this scene showed an early rise followed by reclamation, rather
than a continuing upward footprint trend over 15 minutes. This is one
instrumented scene/run, not proof of leak-free behavior across all routes.
Allocations adds overhead, so these absolute memory/CPU figures should not be
compared directly with the earlier Activity Monitor-only baseline. The repeated
mount/unmount and label-isolation follow-ups below extend this evidence.

Reproduce with the current app PID and unmount the chart after 15 minutes:

```sh
xcrun xctrace record --template 'Allocations' --instrument 'Activity Monitor' \
  --device 00008140-000959AC2193801C --attach 11803 --time-limit 1020s \
  --output .agent-device/skia409/v3/line-effects-15m.allocations.trace --no-prompt
xcrun xctrace export \
  --input .agent-device/skia409/v3/line-effects-15m.allocations.trace \
  --xpath '/trace-toc/run/data/table[@schema="activity-monitor-process-live"]' \
  > .agent-device/skia409/v3/line-effects-15m.activity.xml
python3 .agent-device/skia409/summarize-memory-15m.py \
  .agent-device/skia409/v3/line-effects-15m.activity.xml --pid 11803 \
  --output .agent-device/skia409/v3/line-effects-15m.memory-summary.json
```

Allocations recorded heap/VM and virtual C++ object identities with freed events
kept. Its native Statistics and lifetime-filtered Call Trees were inspected;
the legacy allocation instrument is not exposed as an exportable TOC table.
The Activity Monitor and TOC exporters crashed after writing complete XML;
parsing, schema checks, sample continuity and native views verified the saved data.
The 4 GB trace, exported XML, all samples, summary, controller timestamps, native
call trees and before/after screenshots remain under `.agent-device/skia409/`.
[Native allocation overview](media/issue-409-memory-allocations.jpg) records the
full timeline and Statistics totals.

## Twenty mount/unmount cycles

Allocations + Activity Monitor attached to a cold foreground Demos launch,
PID 11828, **before any chart visit**. A complete 1,051.061-second trace contains
987 process samples and 20 verified visits: seven Line & area, seven Candlestick,
and six Multi-series, in that repeating order. Each visit held the chart for
20 seconds after its mounted snapshot, then used Back to demos and waited
20 seconds after verifying the return. Navigation and snapshots add time between
those waits. All 20 cleanups finished before recording ended successfully.

Every cleanup mean uses the same **5–13 seconds after verified return to Demos**,
excluding the navigation transition. The cold-root baseline uses the last eight
seconds of the initial wait. All windows contain seven or eight process samples.

| Cycle | Chart | Cleanup mean footprint |
| --- | --- | ---: |
| Baseline | Cold Demos | 156.39 MiB |
| 1 | Line | 418.74 MiB |
| 2 | Candles | 470.83 MiB |
| 3 | Multi-series | 624.48 MiB |
| 4 | Line | 633.06 MiB |
| 5 | Candles | 626.16 MiB |
| 6 | Multi-series | 625.89 MiB |
| 7 | Line | 622.60 MiB |
| 8 | Candles | 622.53 MiB |
| 9 | Multi-series | 624.03 MiB |
| 10 | Line | 620.20 MiB |
| 11 | Candles | 621.99 MiB |
| 12 | Multi-series | 619.76 MiB |
| 13 | Line | 622.13 MiB |
| 14 | Candles | 622.03 MiB |
| 15 | Multi-series | 625.52 MiB |
| 16 | Line | 622.61 MiB |
| 17 | Candles | 622.66 MiB |
| 18 | Multi-series | 622.56 MiB |
| 19 | Line | 622.71 MiB |
| 20 | Candles | 617.99 MiB |

There is substantial retention during the first visits. After each chart type
has been visited, cycles 4–20 remain within **617.99–633.06 MiB**, with a fitted
slope of **−0.382 MiB/cycle**. The final idle window averages 617.86 MiB and
0.67% process CPU. Repeated visits show no continuing stepwise accumulation in
this run; they do not erase the initial rise or prove every allocation is freed.

Native Statistics reports **527.95 MiB persistent heap + anonymous VM**,
357,327 persistent and 44,131,816 freed allocations, with **18.53 GiB cumulative
allocation turnover**. The 256 KiB bucket retains 419.50 MiB (1,678 allocations).
The Created & Persistent heaviest stack passes through Hermes
`evalInEnvironment` → `createBCProviderFromSrc` → `BCProviderFromSrc::create` →
`hermes::Context::Context` → compilation allocator → `malloc`. Capturing before
the first chart visit exposes a retained source-to-bytecode compilation cost
consistent with the legacy Worklets mode. This does not attribute every retained
byte to Worklets or Graphite. Heap persistence and physical footprint differ.

The controller, all 20 mounted/returned snapshots and timestamps, native Statistics
and persistent call tree are retained under `.agent-device/skia409/`.
`v3/mount-cycles-20.trace`, its complete XML exports, samples and
`mount-cycles-20.memory-summary.json` preserve the measurements. The TOC exporter
crashed after writing complete XML; parsing and full sample coverage were checked.
Reproduction uses `.agent-device/skia409/run-mount-cycles.py` followed by
`summarize-mount-cycles.py --pid 11828 --trace-prefix
.agent-device/skia409/v3/mount-cycles-20`, substituting a fresh PID/output path.

## Labels enabled/disabled allocation isolation

The internal `app/renderer-label-profile.tsx` route provides two experiments:

- `scene=chart`: identical seeded 5-updates/s producer, 40-second history,
  30-second viewport, max 2,000 points, 300px chart and explicit plot insets.
  Labels toggle X/Y axes and badge. These public toggles also remove axis lines
  and badge geometry, so this comparison alone cannot isolate text.
- `scene=micro`: identical animated circle, frame callback, font and derived
  values; only three Skia Text nodes are conditionally mounted. One numeric label
  changes slowly and two labels are constant. The circle keeps both variants
  rendering even when text is absent.

Both scenes ran **on/off/off/on**, each in a fresh app process, after a 20-second
warmup. All eight Allocations + Activity Monitor recordings completed with a
30-second requested limit (31.05–31.49 seconds in native trace metadata).
CPU/footprint means use 2–28 seconds; native allocation totals use the full trace.
Each scene/label combination therefore has two cold-start repeats.

| Scene | Text | Freed 256 KiB allocations, each repeat | Mean freed bytes/s | Mean footprint | Mean process CPU |
| --- | --- | ---: | ---: | ---: | ---: |
| Chart | On | 1,839 / 1,839 | 14.74 MiB/s | 453.51 MiB | 42.27% |
| Chart | Off | 0 / 0 | 0 | 397.27 MiB | 31.07% |
| Text-only control | On | 1,839 / 1,838 | 14.78 MiB/s | 240.14 MiB | 18.60% |
| Text-only control | Off | 0 / 0 | 0 | 210.57 MiB | 15.87% |

Each text-on capture allocates and frees **459.50–459.75 MiB in the 256 KiB
bucket**. Native Created & Destroyed call trees filtered to `copySubImage` show
the same count and bytes through `TextCmd::draw` → Graphite glyph drawing →
`GlyphData::regenerateAtlas` → `TextAtlasManager::addGlyphToAtlas` →
`DrawAtlas::Plot::copySubImage` → allocation. The inspected chart-off filtered
tree has no allocation rows. All four text-off native Statistics views independently
show zero freed allocations in that bucket. The micro scene reproduces the churn
with only Skia Text nodes changed, isolating text/glyph-atlas rendering as its
source. These are freed allocation bytes, not a 15 MiB/s retained-memory leak.
No upstream fix was applied during these baseline captures. The instrumented CPU/footprint figures describe
these particular scenes and should not be generalized to the whole app.

The local Release app includes this unlinked profiling route. Rebuild/install
normally, then cold-launch one variant by deep link, for example:

```text
reactnativelivechart:///renderer-label-profile?scene=micro&labels=on
reactnativelivechart:///renderer-label-profile?scene=micro&labels=off
```

`.agent-device/skia409/run-label-ab.py` records the complete eight-run matrix;
`summarize-label-ab.py` calculates the results. `label-ab/` retains all eight
traces, validated TOC/Activity XML, native Statistics views, filtered call trees,
snapshots, samples, commands and `summary.json`. Exporter crashes/empty exports
were retried from the same completed traces; only complete, parsed XML with
full process sample coverage was used. No screen recording or screen automation
ran concurrently with the measured windows.

## Historical patch experiment after allocation isolation

The now-removed `patches/react-native-skia+3.3.0.patch` changed the example app's native recorder
configuration. Skia's default unordered recorder invalidates its atlases at each
`snap()`. Declarative frames now enable `fRequireOrderedRecordings` so their atlas
survives between frames. Imperative `SkiaGraphiteView` recordings keep the
unordered default and remain replayable. The matching installed Skia header was
compared byte-for-byte with the upstream
[v3.3.0 Skia revision](https://skia.googlesource.com/skia/+/2466dcf3937437e217e7f284afe0e1aae15891ce/src/gpu/graphite/Recorder.cpp).

The first four-file prototype removed the measured allocation churn, but the
high-bit-depth resize check exposed a regression: a frame discarded by the
8-bit intermediate path left a gap in its ordered stream. Seeker logged 1,106
out-of-order recording rejections and the declarative canvas went blank. An
unpatched control reproduced neither the rejection loop nor the blank canvas.
This prototype was corrected before accepting the fix. Its six allocation
captures remain historical evidence, not validation of a safe final patch.

The corrected eight-file patch starts a fresh recorder when target size, format
or color space changes. An incompatible ordered frame retires its stream;
its dependent frames are discarded and the producer records fresh content.
Surface presentation reports whether insertion was attempted, distinguishing
an unavailable window from a consumed recording. Already attempted ordered
frames cannot be replayed by a retry, and insertion/snap failures retire their
stream. Imperative frames continue using their existing replay and intermediate
texture paths. The insertion/snap failure guards were inspected; resource
exhaustion was not deliberately injected.

Two fresh cold-start captures of the corrected patch used the original
20-second warmup and requested 30-second Allocations + Activity Monitor limit.
Both native **All Allocations** lifetime filters confirm zero freed 256 KiB
allocations. The chart's exact `Malloc 256,00 KiB` category is absent altogether
during this measured window; the text-only control shows 291 persistent and
zero transient allocations in that category. Text stayed enabled and visible.

| Scene | Original text-on runs | Corrected patch | CPU / footprint, 2–28s |
| --- | ---: | ---: | ---: |
| Skia text-only control | 1,839 / 1,838 freed 256 KiB allocations | 0 | 14.99% / 219.24 MiB |
| Fixed-inset LiveChart | 1,839 / 1,839 freed 256 KiB allocations | 0 | 36.95% / 432.14 MiB |

This eliminates the original 459.50–459.75 MiB of turnover per capture in that
bucket (approximately 14.7 MiB/s). It does not eliminate all per-frame
allocations. Each final CPU/footprint cell is one instrumented run, not a general
performance guarantee. Allocations attachment did not consistently enumerate
pre-existing heap allocations across these captures; no final persistent-heap
comparison is claimed. Physical-footprint values come from the validated
process samples, not the Allocations table.

The final unlinked `app/renderer-native-checks.tsx` route passed 23 rendering
checks per phone: standard/high format changes, both sizes, snapshot creation,
first/second imperative drawings, repeated replay of an older recording, three
additional format/resize cycles, and background return. Checks verify the
font's nine glyph IDs and actual screenshot pixels for declarative text/circle
and imperative glyphs, not only React Native status labels. Saved images were
also visually inspected. The original Android test used `System` without a
platform font and omitted text in the unpatched control too; explicit
`sans-serif` corrected that test setup. One background assertion sampled
coordinates during Android's resume animation; a settled rerun passed and its
original screenshot shows complete rendering. The earlier corrected variant
also passed all 23 checks per phone.

The eight original installed C++ files were restored and
`npx patch-package --error-on-fail` successfully reapplied the final patch.
All eight resulting SHA-256 hashes match the native build sources; existing
Metro patches were preserved. At the time, the root postinstall applied the
experimental Skia patch and the candidate included a consumer opt-in copy.
Fresh-consumer application was verified against all eight compiled-source
hashes. Both copies and the packaging hooks have since been removed, and all
eight installed native files restored to the published 3.3.0 hashes. The prior
patch and tarball are retained with the ignored local evidence. The current
candidate ships no Skia patch and does not require the upstream optimization.

Kraken's title previously extended left over its Back button via a negative
margin. Its header now reserves a left slot matching the three right-side icons
and their gaps, centering the title with no overlap. The prior 45-route Seeker
recheck passed all strict root assertions, including the Back button's center.
The earlier `pointerEvents`-only attempt failed and was replaced. Both phones
then passed fresh 45-route sweeps of the corrected final native patch, with
strict return-to-root checks. An initial sweep started above the profiling
route, so Back correctly returned there; the setup was corrected to open the
root first. Phantom's iPhone accessibility parents inherited its Back label;
targeting the actual button's observed center resolved that selector ambiguity.

`glyph-fix/` under `.agent-device/skia409/` retains the original C++ files,
patch manifest/reapplication proof, build/test logs, failed prototype and
unpatched control checks, historical captures, and the corrected
`safe-captures/` traces, complete XML, native All Allocations statistics,
exact-category filters and sample summaries. Renderer checks are under
`checks-complete-ios/` and `checks-complete-android/`. Empty/crashed XML exports
were retried from the same completed traces; every measurement uses parsed XML
with correct app PID, device and process sample coverage. The second Android
installation paused for Play Protect's optional app-upload prompt; declining
that upload completed the local installation.

## Foreground app QA

The final installed app is a normal signed Release build with Skia 3.3.0, without
the profile-run selector or a Metro dependency. Build/install command:

```sh
env -u GEM_HOME -u GEM_PATH npx expo run:ios \
  --device 'iPhone von Lennart' --configuration Release --no-bundler
```

Every implemented demo/showcase route was opened, its screenshot inspected,
and its accessibility tree checked for runtime error overlays. The demo sweep
returned through each Back to demos button, exercising repeated chart mounts
and unmounts. Native Demos/Examples tabs and a Robinhood card → showcase → Back
to Examples flow also worked. This is a full route sweep with focused feature
checks, rather than an exhaustive test of every control combination.

| Feature | Physical-device result |
| --- | --- |
| Line, area, candles, multi-series, sparklines | All rendered with live updates; no obvious missing paths/axes/badges |
| Gradients and shaders | Three-color stroke, animated stroke/fill, Fade to green, and Dense area dots selected and visually checked; threshold split and showcase shader scenes rendered |
| Font/typeface handling | Platform font, bundled JetBrains Mono and Google Sans Code rendered; dark theme selected |
| Candle feedback | Horizontal scrub produced six candle-entry callbacks, two gap/exit callbacks, and ongoing forming-candle updates |
| Time scroll | One-finger pan moved into historical candles; screenshots show the shifted time window |
| Multi-series | Toggling Yes removed the blue series while No/Maybe continued rendering; scrub exercised |
| Automatic sleep | Pausing settled to Asleep and 0 engine ticks/s; resuming restored live activity (engine telemetry, not FPS) |
| Transitions | Line → candle mode and blue → violet cross-fade rendered after switching |
| Markers and degen | Buy/sell glyphs rendered; Burst ×12, scrub-details, chaotic feed, forced-up momentum and Heavy preset exercised without a runtime error; not every atlas/group configuration was checked |
| Data states | Empty shell, single-point chart, and returning live data after Replace data (2s) visually checked |
| Navigation/mounting | All demo back buttons and native tabs exercised; repeated mount/unmount did not produce an observed crash |
| Pinch zoom | Passed manual verification on the physical phone, confirmed by the user after the automated run |

All 39 demo routes:

```text
android-surface-rendering  auto-sleep  axes-and-grid  axis-auto-hide
badge-alignment  badge-styling  candle-feedback  candle-scrub  candlestick
coin-list  empty-candles  extrema-labels  historical-data  line-and-area
line-denoising  loading-data-on-scroll  markers-and-trades  minimum-range
momentum-and-degen  multi-series  order-ticket  overlay-bridge  playback
playground  range-stress  reference-lines-and-bands  scroll-interaction
scrubbing  segments  sparklines  states-and-formatting  synced-charts
theming  threshold  time-scroll  transitions  volume-line-qa
working-orders  y-range-scale
```

All six implemented showcase routes: `backpack`, `fomo-perps`, `fomo`, `kraken`,
`phantom-up-down`, and `robinhood`. Opening Android surface rendering on this
iPhone verifies only its iOS rendering; it does not constitute Android QA.

Selected full-resolution screenshots:

- [Dense area dots](media/issue-409-line-dots.png)
- [Candle callback counters after scrub](media/issue-409-candle-feedback.png)
- [Multi-series after hiding Yes](media/issue-409-multi-series.png)
- [Bundled Google Sans Code and dark theme](media/issue-409-fonts.png)

Local evidence lives under `.agent-device/skia409/`: `screens/` contains all 45
route screenshots and command/snapshot output, `qa-summary.json` indexes the
coverage, and `interactions.mp4` plus its gesture telemetry records the focused
checks. The recording is a 15fps, 220×480 capture for interaction review; its
capture rate is not a measurement of app frame rate. Screenshots are 1179×2556.

## Physical Android/Vulkan QA

Installed the local embedded-bundle **arm64-v8a Release APK** on the connected
Solana Seeker, Android 16 / API 36. Regenerated the Expo Android project before
building so the native minimum SDK is 26; APK metadata confirms min SDK 26 and
target SDK 36. No Metro connection was used. Native app log confirms:

```text
Selected Dawn adapter - Backend: Vulkan, Device: Mali-G615 MC2
```

Opened and visually reviewed **all 39 demos and six implemented showcases**
listed above. Each route has a saved screenshot and accessibility snapshot.
Demo returns were checked against the Demos list. All six showcase card → scene
→ Back flows were separately checked from the native Examples list; the Kraken
header has the hit-area failure described below. The same app process, PID 8688,
remained alive through the completed sweep
and focused checks. No fatal exception,
native fatal signal, device-lost or validation failure was observed in the saved
log stream. Dawn reduced advertised dynamic-buffer limits, and the device emitted
gralloc format-probe/ashmem warnings; the log was not completely warning-free.

| Focused check | Seeker result |
| --- | --- |
| Native surface backing | Opaque SurfaceView and transparent TextureView painted correctly in dark theme; RN sibling overlay remained visible; loading mask returned to live content |
| Candle scrub callbacks | Eight candle entries and two gap/exit callbacks; forming-candle updates continued |
| Historical gestures | One-finger pan shifted to older candles; pinch narrowed the visible time window and enlarged candles |
| Multi-series toggle | Hiding Yes removed its blue path while No/Maybe continued rendering |
| Bundled fonts | JetBrains Mono and Google Sans Code selected and visually verified |
| Automatic sleep/resume | Pause settled to Asleep and 0 engine ticks/s; resume restored Live and engine activity; telemetry is not FPS |
| Shader/effect composition | Animated mode, Dense area dots and settled Fade to green rendered together |

Build/install reproduction:

```sh
npx expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
adb -s SM02E4072812409 install -r app/build/outputs/apk/release/app-release.apk
```

The physical device uses **4 KiB memory pages**. This validates Vulkan on this
Mali GPU and Android version; minimum-API-26 runtime, 16 KiB runtime, other GPUs
and Android frame pacing were not measured. The additional emulator was stopped;
no emulator QA result is counted here.

The audit found that the initial deep-link sweep's return check was too broad:
it accepted `Back to Examples` as a root label for three showcases. Kraken's
failed Back tap left it underneath subsequent scenes. Separate checks opened
all six showcases from their native Examples cards and required the actual list
subtitle after Back. Five center taps passed. **Kraken's Back center tap failed**
again; tapping the button's left edge returned correctly. System Back also
returned correctly. Its header title has a negative left margin overlapping the
button, a likely hit-testing cause; this is an inference from layout and the
successful edge tap, not a renderer-regression attribution. No fix is included
in that initial QA pass. The subsequent header correction and strict recheck above
resolve this navigation finding. Original
failed observations and the native flows are retained in
`android/navigation-recheck.json` and nearby logs.

`.agent-device/skia409/android/sweep.json` indexes all 45 routes and their
screenshots/snapshots/navigation checks. The directory also contains focused
gesture/control evidence and six reviewed contact sheets. The continuous native
log is `android-seeker-logcat.log`; `android/qa-final-summary.json` records the
final live-process/log check. Selected screenshots:

- [SurfaceView, dark theme and sibling overlay](media/issue-409-android-surface.png)
- [Google Sans Code](media/issue-409-android-font.png)
- [Dense dots with settled Fade to green](media/issue-409-android-effects.png)

## Native frame pacing

`agent-device perf frames --session skia409 --json` returned FPS unavailable:
the physical-device Animation Hitches export failed for
`hitches-frame-lifetimes`. A separate eight-minute native Animation Hitches
attachment also stalled while ending the recording and never finalized a valid
trace; it was stopped after waiting several minutes. The incomplete trace is
not used as evidence. `frames.json` and `hitches-run.log` retain these failures.
Those failed captures are not used for any frame-rate or hitch claim.

After manual pinch confirmation, two 30-second **Metal System Trace** recordings
successfully attached to the existing foreground Release app, PID 11722. The first
kept Line & area defaults; the second selected Animated color mode, Fade to green
(settled before recording), and Dense area dots. Both kept the normal feed at
5 updates/s, a 40-second history seed, the default 30-second viewport, badge,
pulse, axes and fill. No screen recording or automated gestures ran during the
sampling windows.

The native `device-display-info` table reports a **60 Hz** built-in display.
Analysis uses `displayed-surfaces-interval` rows attributed to `LiveChart (11722)`,
and their display durations, rather than engine callbacks, Metal encoding times,
or CPU-to-display pipeline latency. App-attributed rows have unique presentation
timestamps and contiguous intervals. Instruments' Displayed Surfaces view was
also inspected to confirm the exported values. This follows Apple's
[Metal display-timing workflow](https://developer.apple.com/documentation/xcode/analyzing-the-performance-of-your-metal-app/).

The main window includes intervals starting at 2–28 seconds, excluding trace
initialization and stopping. Presented rate is 1,000 divided by mean display
duration in milliseconds. A long hold is a display duration over 25 ms, chosen
to distinguish multi-vsync holds from small timing jitter around 16.64 ms.
These counts are not Apple's Animation Hitches metric or a measured drop ratio.

| Scene | Display intervals | Mean presented rate | p95 / p99 display duration | Long holds >25ms | Worst hold |
| --- | ---: | ---: | ---: | ---: | ---: |
| Default Line & area | 1,560 | 59.98 Hz | 16.64 / 16.65 ms | 2 | 49.92 ms |
| Dense dots + settled animated-color mode | 1,553 | 59.75 Hz | 16.64 / 16.65 ms | 5 | 49.93 ms |

The default scene's two long holds occurred at 6.50s (49.92 ms) and 22.36s
(33.28 ms). The effects scene had four approximately 50 ms holds and one 33 ms
hold. Including initialization in the nominal 0–30s window gives four long holds
for defaults (worst 83.19 ms) and six for effects (worst 49.93 ms). The near-60Hz
means do not imply perfectly smooth delivery: these outliers are real observations
in an instrumented run. Their cause and renderer-relative impact require further
comparison. No old-renderer frame-pacing baseline or GPU-time improvement is claimed.

Capture and export commands (use the current app PID for another run):

```sh
xcrun xctrace record --template 'Metal System Trace' \
  --device 00008140-000959AC2193801C --attach 11722 --time-limit 30s \
  --output .agent-device/skia409/v3/line-metal-30s.trace --no-prompt
xcrun xctrace export --input .agent-device/skia409/v3/line-metal-30s.trace \
  --xpath '/trace-toc/run/data/table[@schema="displayed-surfaces-interval"]' \
  > .agent-device/skia409/v3/line-metal-30s.display.xml
python3 .agent-device/skia409/summarize-display.py \
  .agent-device/skia409/v3/line-metal-30s.display.xml --pid 11722 \
  --output .agent-device/skia409/v3/line-metal-30s.summary.json
```

The initial TOC and device-info exports each crashed; stdout exports succeeded
on retry. Complete XML was parsed and structurally checked before using it.
Both complete traces, exported XML, individual display samples and JSON summaries
are retained under `.agent-device/skia409/v3/`. The local summary script preserves
the exact filtering/statistics. [Instruments display view](media/issue-409-frame-pacing.png)
provides a visual cross-check.

## Post-correction native frame-pacing check

A fresh cold-start default Line & area capture of the corrected native patch
initially showed slower pacing than the earlier measurements. That observation
triggered a current unpatched control and a further corrected-patch capture.
The two binaries have **identical Hermes bundle SHA-256 hashes**; only their
native renderer patch differs. Each run used a 20-second warmup, requested
30-second Metal System Trace, the same physical iPhone/display and default
5-updates/s line scene. Display metadata again confirms 60 Hz.

| Run | Intervals, 2–28s | Mean observed cadence | p99 interval | Maximum | Intervals over 25ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| First corrected-patch run | 1,506 | 57.87 Hz | 33.28 ms | 66.56 ms | 55 |
| Current unpatched control | 1,561 | 60.02 Hz | 16.65 ms | 49.92 ms | 1 |
| Corrected-patch repeat | 1,552 | 59.71 Hz | 16.64 ms | 49.93 ms | 5 |

The first capture has one 49.92ms gap between the app's displayed-surface
intervals. The original summary script correctly rejected its assumption of
continuous coverage. The saved `summarize-pacing-with-gaps.py` instead uses
app-attributed start-to-next-start intervals, retaining this gap as a 66.56ms
observed interval. It neither drops the gap nor claims to know whether it was
an actual presentation hold or missing attribution. The two subsequent
captures have continuous coverage; this method then agrees with their native
displayed durations.

The 57.87Hz result did not repeat after the control/reinstallation. The patched
repeat is near 60Hz, with five long intervals versus one in the current control.
That small single-run difference is not enough to attribute a regression or
improvement to the patch; balanced repeated profiling remains a release check.
No perfectly smooth delivery or general frame-pacing improvement is claimed.

The patched app remained alive after one name-based attachment lookup failed;
no new crash log was present. A fresh cold start attached by verified PID and
completed the repeated capture. Several XML exports crashed or returned empty
output; retries from the same completed traces recovered valid XML. The TOC,
app PID, physical device, duration, display metadata and interval sequence were
validated before using the results. Raw traces/XML, all failed exports, exact
commands, hashes and summaries are retained in `glyph-fix/safe-pacing/`,
`control-pacing/`, `repeat-pacing-retry/` and `pacing-comparison.json`.

## Concrete next tasks after patch removal

Startup console output showed existing background-mode warnings, but no Skia
initialization error. That console stream ended during an intentional cold
relaunch and is not a continuous log of the entire screen sweep. The sweep's
route snapshots and recordings provide the foreground observations.

1. **Rebuild unmodified 3.3.0 and repeat the functional checks on the two phones.**
   Use iPhone von Lennart and the Solana Seeker, locally signed, unpublished
   builds with embedded Hermes bundles. Repeat the existing 45-route sweep and
   23 renderer checks on each phone. Explicitly exercise pinch, historical pan,
   candle scrub callbacks, multi-series visibility, bundled fonts, opaque and
   transparent canvases, format/resize, snapshots and background return. Pass:
   every route returns to the root, text/paths render, interactions respond,
   and native logs contain no fatal errors, device loss or recording rejections.
   Last-installed binaries still contain the historical patch until rebuilt.
2. **Compare old 2.6.4 against unmodified 3.3.0 for these three exact workloads.**
   First add a QA-only seeded `random01` feed and a repeatable gesture script for
   these routes; their normal simulated feed is not deterministic. Keep React
   Native, Hermes, Worklets mode, chart code, data seed, dimensions,
   device refresh rate and gesture sequence fixed. Switch renderer dependencies
   and import names sequentially in the existing checkout, preserving and
   restoring its files; never install both renderer packages together.

   | Route | Configuration and 30-second measured action |
   | --- | --- |
   | `/demo/line-and-area` | Default line/area, axes, badge and pulse; normal 5 updates/s feed; leave live for 30s |
   | `/demo/candlestick` | `15m · 1m`, volume on, normal 2 updates/s feed; five identical left/right historical pan pairs, one pair every 6s |
   | `/demo/multi-series` | All three series visible, default 30s window; scrub left/right for 20s, toggle Yes off at 20s and on at 25s |

   Cold-launch, wait 20s, then measure 30s. Do three captures per renderer,
   workload and phone: **36 captures total**. Use paired build rounds in the
   order old→new, new→old, old→new; let each phone cool between rounds. On the
   iPhone, use Metal System Trace app-surface presentation intervals as above.
   On Seeker, first identify the chart's layer with `dumpsys SurfaceFlinger
   --list`, then validate nonzero, advancing per-layer presentation timestamps
   from `--latency <layer>` before collecting samples. Poll once per second,
   deduplicate timestamps and retain gaps. If layer timestamps are unavailable,
   report Android pacing as blocked by measurement coverage, with the captured
   output; do not substitute RN/engine FPS. Android 16's
   [SurfaceFlinger implementation](https://android.googlesource.com/platform/frameworks/native/+/refs/heads/android16-release/services/surfaceflinger/SurfaceFlinger.cpp)
   exposes those commands. [Perfetto's FrameTimeline documentation](https://perfetto.dev/docs/data-sources/frametimeline)
   excludes SurfaceView coverage, so a root-window FrameTimeline score alone
   is insufficient for the opaque chart.

   Deliver one table with each run's mean presentation cadence, p95/p99 interval,
   worst interval and fraction over 1.5 display periods, plus raw samples and
   validated device/layer attribution. Predeclare the triage rule: investigate
   if new Skia loses more than 5% of mean cadence or adds at least one display
   period to p99 in at least two of three paired runs. This is the comparison's
   investigation threshold, not a claim of a universal performance budget.
3. **Publish the RC under `next` once requested.** The package is prepared as
   5.0.0-rc.0, with only the `react-native-skia@^3.3.0` peer. Report actual
   unpatched-device results and any reproducible regression before calling a
   stable release ready. No release has been published.

The old renderer may have similar allocation churn; that specific comparison
has not been done. If pursuing the allocation question separately, repeat the
existing fixed-inset chart and three-Text control with labels on/off on Skia
2.6.4, two 30-second Allocations captures per scene/state after a 20-second
warmup (eight captures), and compare freed-byte turnover and teardown memory
against the saved 3.3.0 controls. It is not a release blocker on current evidence.
Upstream PR #4193, additional GPUs, API 26/16 KiB runtime coverage and maintained
v2 support are separate follow-ups, not unstated requirements for this RC.
