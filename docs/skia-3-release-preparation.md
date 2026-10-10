# LiveChart 5 release candidate for Skia 3.3

Prepared locally on 2026-10-10 as **5.0.0-rc.0**. No npm publication, Git tag or
GitHub release was created. At preparation time the registry's stable `latest`
was **4.28.0**.

## Current renderer configuration

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
its 120Hz display, with p99 around 16.7ms. There is no old-renderer pacing control
yet; these observations do not establish a migration regression.

The user subsequently clarified the remaining defect: live dots jumped in Y
when a price changed, while X scrolling stayed smooth. The engine's
recorded-target branch bypassed smoothing. Live price changes now ease the dot
and newest drawn sample together without rewriting history or adding React
renders. A fresh Seeker Release build and before/after live-feed recordings
verify this fix; earlier full sweeps predate the engine change. Explicit replay
heads and explicit snaps remain immediate. See the QA report's
[price-update follow-up](issue-409-qa.md#live-price-update-jump-corrected--2026-10-10).
The new library fix is also rebuilt, installed and launched on Lennart's iPhone.

## Package

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

## Verification and evidence

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
   is not required to diagnose this defect.
3. **Publish 5.0.0-rc.0 under `next` when requested.** Report actual unpatched
   device results and any reproducible regression before a stable release.

The wider renderer cadence comparison remains unperformed and separate from
the live-price fix. If pursued, the concrete procedure is three named workloads
against old Skia 2.6.4: default
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
