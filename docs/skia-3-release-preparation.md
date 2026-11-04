# LiveChart 5 release preparation

## Release and support policy — November 4, 2026

Prepare **5.0.0-rc.0** for **`next`**, using `react-native-skia@^3.9.1`,
React 19+ and React Native 0.79+. The example pins Skia 3.9.1.
The RC remains unpublished; npm `latest` remains **4.30.2**.

Maintain two LiveChart majors under the existing npm package name:

| LiveChart line | Renderer | Support |
| --- | --- | --- |
| 4.x | `@shopify/react-native-skia` v2 | Compatible bug fixes and maintenance |
| 5.x | `react-native-skia@^3.9.1` | New renderer release line |

`v4.30.2` (`367ed166`) is merged into the 5.x candidate. This includes
`loading.freezeAfterMs`, badge padding alignment, viewport price ranges and
recorded endpoints, price scrolling/reset-view, snap/framing/indicator fixes,
and display-frame dot pulses. A token-level comparison confirms that the
public index and types match 4.30.2 after normalizing the renderer import.
Runtime differences are limited to the new Canvas options, GPU atlas snapshots,
and the retained reference-tag dependency optimization.

The local **`codex/maintenance-v4`** branch points to `v4.30.2` and retains the
Shopify peer. The 5.x work stays on **`codex/skia-latest-performance`**; stable
`main` is not replaced by this preparation. Keep compatible engine and interaction
fixes aligned between the branches. Validate renderer changes independently.
The existing [4.x README](https://github.com/brandtnewlabs/react-native-livechart/blob/v4.30.2/README.md)
preserves installation instructions and API documentation for Shopify apps.

Each artifact imports one renderer namespace and declares its matching peer.
Do not install both Skia names in one app: they register the same native module.
See the upstream [migration guide](https://wcandillon.github.io/react-native-skia/docs/getting-started/migration/).
The maintained v2 release under the *new* name (`react-native-skia@2.15.2`) is
an additional compatibility target. It has not been verified and is not in the
5.x peer range. Supporting it would require an adapter, matching public types,
and packed-consumer/native checks before widening the peer range.

### Publication sequence

1. Publish the prepared RC explicitly with `npm run publish:lib:next` only when
   publication is requested. The prepublish guard requires the configured tag,
   and rejects default `latest` and other mismatched tags. Keep **4.30.2 on
   `latest`** throughout the RC period. Install 4.x with `@4`, the published RC
   with `@next`, or the prepared tarball before publication.
2. For the RC, push the release commit and `v5.0.0-rc.0` tag from the candidate
   branch and create a GitHub **prerelease**, without marking it Latest.
   Run the scoped npm publish dry-run before publishing. Do not merge v5 into
   stable `main` during this preparation.
3. Before publishing stable **5.0.0** to `latest`, give the supported 4.x version
   the **`legacy`** tag. Promote the validated v5 source through the normal review
   flow and update its manifest and guard to require `latest`.
4. Publish subsequent 4.x maintenance versions explicitly to **`legacy`**.
   Backport the generic publish guard and set `publishConfig.tag` to `legacy`
   on that branch before the first maintenance publication after v5 promotion.
   Until promotion, 4.x maintenance can continue on `latest`. Every publication
   needs its changelog, version tag and GitHub Release.

### Performance evidence

The [Shopify comparison](performance-shopify-vs-skia-3.9.1-iphone.md) and
[CPU investigation](performance-multi-series-cpu-investigation-iphone.md)
**predate this 4.30.2 integration**. They document the accepted migration
tradeoff, not a new benchmark of the final RC package. The reference-tag
optimization averaged 2.0% less CPU in three paired iPhone runs; the remaining
whole-workload gap versus Shopify was 5.3%, concentrated in the scrub-heavy
phase. The post-scrub period includes visibility toggles and is not a pure idle
benchmark. No delivered-FPS ranking was established.

### Current package verification

Release checks and the final tarball are recorded under
`.agent-device/release-5-rc0-20261104/`. The source ships with declarations,
README and license; native rendering dependencies remain peers. No experimental
Skia patch is shipped.

- npm 10 clean installation and npm 11 CI dry-run pass; the lock retains the
  optional `@emnapi` entries required by CI.
- `npm run verify` passes: 166 suites, 2,316 tests, five existing skips.
- Expo dependency validation and the native peer tree pass.
- The packed package passes a normal lifecycle-enabled install, strict consumer
  type checking (both charts, viewport range, price scrolling, reset-view and
  loading freeze), and a Hermes iOS Worklets Bundle Mode export of both charts.
- An explicit `next` publish dry-run passes. Eleven publishing-guard tests cover
  RC `next`, stable `latest`, future maintenance `legacy`, and mismatched tags.
- React Doctor latest scores 92/100 with one complexity warning. The entire
  warned `useLiveChartController` function is identical to stable 4.30.2; the
  warning is inherited, rather than introduced by release preparation.

### Native smoke checks — integrated 3.9.1 candidate

Fresh native Release builds pass with Expo 57.0.31 / React Native 0.86.3:

| Target | Results |
| --- | --- |
| Lennart's physical iPhone 16, iOS 26.6 | Line/candle rendering, explicit viewport price range, history navigation, time-pan → floating reset → restored view, multi-series/toggles/scrub, marker glyphs, degen enabled, GPU snapshot, font 9/9, first/second recording and replay, format/size changes pass |
| Existing Pixel 10 Pro XL emulator, Android 37.1, 16 KB pages | Line/candle rendering, explicit viewport price range/history/future/live controls, time-pan and reset button, multi-series/toggles/scrub, buy/sell/fan marker glyphs, degen enabled, GPU snapshot, font 9/9, first/second recording and replay, format/size changes pass |

The Android emulator retains its existing 8 cores, 8 GB RAM and automatic GPU
settings. Its Vulkan renderer draws the chart and native recorder checks.
These are focused functional smoke checks, not a new 45-route sweep or
performance comparison. Fresh physical Android 3.9.1 QA remains outstanding.
Screenshots, accessibility evidence, build logs and scripts are retained in the
release evidence directory. The Mobile Dev panel installed the iPhone build;
its unsigned touch runner could not operate the phone, so the previously
configured signed runner performed the iPhone interactions.

### Prepared artifact

The final package identity is recorded in `package-audit.json` and
`SHA256SUMS` beside `react-native-livechart-5.0.0-rc.0.tgz` in the release
evidence directory. The artifact contains **477 files**, **502194 bytes**.
SHA-256: `88e90fd2b27455621eeb899d429c782e57053ad12744aafdc0b7ca37b8c828ca`.
The artifact is prepared for `next`; no publication, remote
push, version tag or GitHub Release has been created.

The records below describe the earlier **Skia 3.3.0** candidate and are retained
as historical evidence. Their tarballs and device results are not the final RC.

## Historical Skia 3.3 release candidate

Prepared locally on 2026-10-10 as **5.0.0-rc.0**. No npm publication, Git tag or
GitHub release was created. At preparation time the registry's stable `latest`
was **4.28.0**.

The stable price-update correction has since been published as **4.28.1**
([release](https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v4.28.1)).
The v5 branch now includes that released main baseline, retains the identical
smoothing/alignment correction, and keeps the complete 4.28.1 changelog entry.
At that time the candidate remained unpublished and npm `latest` was **4.28.1**.

### Renderer configuration at that time

The candidate uses the published, **unmodified `react-native-skia@3.3.0`**.
At the user's request, the experimental glyph-atlas patch was removed from the
example, installed native sources and package. All eight installed C++ files
were restored to their recorded original 3.3.0 SHA-256 hashes. The tarball ships
no native patch, and there are no consumer patch/rebuild instructions.
The existing Metro/Worklets patches remain in the example.

The allocation measurements do not establish a regression from Skia 2.6.4.
No retained-memory leak was demonstrated. The upstream optimization investigation
in [Skia PR #4193](https://github.com/wcandillon/react-native-skia/pull/4193) is
separate from this migration and is not a release prerequisite.

[issue-409-qa.md](issue-409-qa.md) preserves the measurement history. Both phones
have now been rebuilt and installed with unmodified Skia: **45/45 route checks**
and **23/23 rendered-pixel checks** passed per phone, with every route screenshot
visually reviewed. A separate Multi-series Y-range jump was corrected
by enabling the demo's existing outward-easing option. The correction is also
installed on both phones; a paused-feed Seeker recording verifies the transition.
The demo now starts with Smooth responsiveness after a same-feed comparison.
Temporary Seeker probes found zero repeated React renders in the measured chart
tree during live idle and eight visibility toggles; probe edits were removed.
Three exploratory Seeker line captures measured 104.6–105.9 presentations/s on
its 120Hz display, with p99 around 16.7ms. There is no old-renderer Seeker pacing
control yet; these observations do not establish a migration regression.

The user subsequently clarified the remaining defect: live dots jumped in Y
when a price changed, while X scrolling stayed smooth. The engine's
recorded-target branch bypassed smoothing. Live price changes now ease the dot
and newest drawn sample together without rewriting history or adding React
renders. A fresh Seeker Release build and before/after live-feed recordings
verify this fix; earlier full sweeps predate the engine change. Explicit replay
heads and explicit snaps remain immediate. See the QA report's
[price-update follow-up](issue-409-qa.md#live-price-update-jump-corrected--2026-10-10).
The new library fix is also rebuilt, installed and launched on Lennart's iPhone.
The additional focused iPhone price-animation recording was skipped at the
user's request on 2026-10-10; launch verification is not a motion recording.

### Historical package

- `react-native-skia@^3.3.0` stays a peer, with React 19+, React Native 0.78+,
  Reanimated 4+, Worklets 0.7+ and Gesture Handler 2+.
- The example pins Skia **3.3.0**. Maintained v2 support is not declared.
- Source and emitted declarations use the new renderer. The root example
  remains private at version 1.0.0; the library is public at 5.0.0-rc.0.
- `publish:lib:next` explicitly selects **`next`**. A prepublish check rejects
  prerelease publication to `latest`, since a workspace rehearsal ignored
  `publishConfig.tag`.
- `prepack` builds declarations and mirrors the root README. The package
  allowlist is runtime source, declarations/maps, metadata, README and license.
  The consumer check explicitly rejects any packaged `.patch` file.

The replacement candidate is
`.agent-device/skia409/release-prep/live-dot-fix/react-native-livechart-5.0.0-rc.0.tgz`.
It is 475,716 bytes with 456 files and zero patches; all 302 source/declaration
files were audited for old renderer imports.
SHA-256: `5adc54eb93c49cb4b33c001a6e9be48bac0635a5978a5815c2bf3d61d8f48ded`.
The prior patched tarball is historical evidence under
`.agent-device/skia409/patch-removal/previous-patched-candidate.tgz`.

### Historical verification and evidence

Before patch removal, typecheck/lint, 148 suites / 2,139 tests (five skipped),
declaration build, packed-consumer type checks, normal installation and a valid
peer tree passed. Packed iOS Hermes Bundle Mode export, npm 10/11 install dry-runs,
React Doctor (98/100, no diagnostics) and the prerelease publication guards also
passed. The prior patch application checks are historical, not current packaging
requirements.

Patch-removal checks passed and are recorded under `.agent-device/skia409/patch-removal/`:
`npm run verify` (148 suites / 2,139 tests, five skipped), a replacement pack
audited for zero patches/old imports, normal lifecycle-enabled consumer install
(without installing peers in that isolated install check), and a fresh packed
iOS Hermes Bundle Mode export. Those package checks are separate from the new
physical QA above. After the demo correction, `npm run verify` passed again
(148 suites / 2,139 tests, five skipped); React Doctor is 98/100, no diagnostics.
After the live-price correction, `npm run verify` passes with 148 suites /
2,144 tests, five skipped; React Doctor remains 98/100, no diagnostics.

After integrating released 4.28.1, npm 10 clean installation, `npm run verify`
(148 suites / 2,144 tests, five existing skips) and the packed iOS Hermes
Bundle Mode consumer export pass again. React Doctor remains 98/100 with no
diagnostics. The integration changes release history and documentation only;
the stable engine and line-point smoothing code is retained unchanged.

To rebuild the local candidate:

```bash
npm run verify
npm run pack:lib
npm run verify:bundle-mode-consumer
```

## Exact next tasks

1. **Functional recheck: completed.** Both unmodified phone builds passed the
   45-route sweep and 23 renderer checks. See the QA report for the focused
   interactions, Multi-series correction and measurement limits.
2. **Live price-update jump: corrected and verified on Seeker.** The recorded
   price now eases with its line tail. Repeating the full QA or a renderer matrix
   is not required to diagnose this defect. The separate iPhone motion follow-up
   is waived as above.
3. **Publish 5.0.0-rc.0 under `next` when requested.** Report actual unpatched
   device results and any reproducible regression before a stable release.

An identical-demo **iPhone Release comparison against published 4.28.1** is now
complete: [performance report](performance-5-vs-4.28.1-iphone.md). Eighteen
paired captures on Lennart's iPhone 16 measured 30.3–43.7% lower physical memory,
24.3% lower line CPU and 15.3% lower candle CPU in the RC. Multi-series CPU was
8.5% higher, repeating in all three pairs. Intermittent missing app labels in
the native display data prevent a reliable delivered-FPS ranking. The report
preserves every capture, the seeded feed, exact workloads and measurement limits.
Four additional Time Profiler captures localize the CPU concern to scrubbing.
An exploratory Pills-off control reverses the relative scrub difference; native
shared-value update and text-input commit work are the current leads, with root
cause still unconfirmed. See the [PR profiling follow-up](https://github.com/brandtnewlabs/react-native-livechart/pull/411#issuecomment-6100874357)
and the report for the one-pair-per-setting limitation.
Thirteen subsequent exploratory fix/control captures did not validate a CPU
fix. Readout-off and callback-off controls remained inside the new baseline
range; TextInput alone is not supported as the cause of the increase. All
experimental app/library/native changes were reverted. The report retains the
results and the one-capture-per-candidate limitation.

The wider delivered-cadence comparison remains unresolved, and the Seeker
old-renderer control remains unperformed. Both are separate from the live-price
fix. If pursued, the concrete procedure is three named workloads against old
Skia 2.6.4: default
`/demo/line-and-area`; `/demo/candlestick` at `15m · 1m` with volume and five
historical pan pairs; `/demo/multi-series` with three series, 20s scrub and
Yes off/on at 20s/25s. Cold-launch, warm up 20s, capture 30s; three runs per
renderer/workload/phone, **36 captures**. Pair old/new rounds, hold the feed,
harness and display rate fixed (prepare a QA-only seeded feed and repeatable
gestures first), and report mean cadence, p95/p99, worst
interval and the fraction over 1.5 display periods. Investigate a greater
than 5% cadence loss or at least one display-period p99 increase repeated in
two of three pairs. See the [full capture and acceptance procedure](issue-409-qa.md#concrete-next-tasks-after-patch-removal),
including validation of Android chart-layer timestamps before collecting.

An identical-workload old-version allocation comparison is a separate,
nonblocking investigation: fixed-inset chart and three-Text control, labels
on/off, two captures per scene/state, eight 30s captures after a 20s warmup.
Additional GPUs, API 26/16 KiB runtime coverage, and dual-v2 support are follow-up
coverage tasks. They are not unstated gates for this v3-only RC.
