# LiveChart 5 release candidate for Skia 3.3

Prepared locally on 2026-10-10 as **5.0.0-rc.0**. No npm publication, Git tag or
GitHub release was created. The registry's stable `latest` remains **4.28.0**.

The runtime migration and native investigation are documented in
[issue-409-qa.md](issue-409-qa.md). This preparation changes package metadata,
documentation and packaging checks; it does not add a new native renderer change
or rerun device profiling after the metadata bump.

## Package

- `react-native-skia@^3.3.0` stays a peer, with React 19+, React Native 0.78+,
  Reanimated 4+, Worklets 0.7+ and Gesture Handler 2+.
- The example and consumer verification pin Skia **3.3.0**. Maintained Skia v2
  support is not declared; it is not a prerequisite for a v3-only candidate.
- Source and emitted declarations import the new renderer. The root example
  remains private at version 1.0.0; the library is public at 5.0.0-rc.0.
- `publish:lib:next` explicitly selects **`next`**. A prepublish check rejects
  prerelease publication to `latest`, since a workspace publish rehearsal ignored
  `publishConfig.tag`. Stable publication must intentionally select `latest` after
  changing to a stable version.
- `prepack` builds declarations, mirrors the root README, and copies the
  canonical root `patches/react-native-skia+3.3.0.patch` into the package. The
  generated copy is ignored by Git and included by npm's package allowlist.

The local tarball is
`.agent-device/skia409/release-prep/react-native-livechart-5.0.0-rc.0.tgz`
(478,862 bytes, 457 files). It contains runtime source, declarations/maps,
package metadata, README, license and the optional patch. No demo, test or
profiling artifact ships in it.

## Consumer workaround

Unpatched Skia 3.3.0's animated text rendering still has glyph-atlas
allocation/free turnover. The included patch is the exact corrected native
source tested on both phones; installing LiveChart does **not** apply it.
The [installation guide](installation.mdx) and packaged README explain how to
pin exactly 3.3.0, copy the patch into the app's `patches/` directory, apply it
with `patch-package`, preserve it through `postinstall`, and rebuild the app.

[Upstream Skia PR #4193](https://github.com/wcandillon/react-native-skia/pull/4193)
remains open. Upstream CI/review/merge/release is needed to remove the manual
workaround. The candidate can be tested while that proceeds, using the explicit
consumer patch. Neither a retained-memory leak nor a general frame-pacing
improvement is claimed.

## Verification

All checks completed locally:

- `npm run verify`: typecheck and lint passed; **148 suites, 2,139 tests passed**,
  five skipped.
- Workspace `npm pack` built declarations and produced the candidate tarball.
  All **302 source/declaration files** were audited for old renderer imports;
  the full 457-file allowlist was checked separately, including declaration maps.
- A fresh consumer installed the tarball and exact native peers without
  `--legacy-peer-deps`. Its complete npm dependency tree was valid and contained
  no `@shopify/react-native-skia` package.
- Consumer TypeScript checks passed for both chart component exports and
  `DataSourceParam`, `SkFontMgr` and `SkImage` used in exported font/marker types.
- Normal consumer installation with npm lifecycle scripts enabled passed; the
  native peer remained unpatched until explicit opt-in.
- Before explicit opt-in, all eight consumer Skia files matched the unpatched
  3.3.0 sources. Applying the patch succeeded, and all eight then matched the
  compiled/device-tested SHA-256 manifest.
- `npm run verify:bundle-mode-consumer` passed: an iOS Hermes bundle was exported
  from the packed library with Bundle Mode. The continuing CI check now audits
  peer/version metadata, runtime/declaration imports and the patch's exact hash.
- npm 10 and npm 11 lockfile/install dry-runs passed; the only lock entry changed during
  release preparation was the library version. Existing migration lock changes
  were preserved.
- An untagged workspace publish dry-run was rejected by the new prerelease
  check. `npm run publish:lib:next -- --dry-run` passed and selected `next`.
  Both checks were rehearsals; nothing was uploaded to npm.

Logs, the dependency tree, tarball contents, hashes and exact summaries are
retained in `.agent-device/skia409/release-prep/`. The temporary consumer's
`node_modules` is removed after verification. Instruments and device sessions
remain closed.

To rebuild the local candidate:

```bash
npm run verify
npm run pack:lib
npm run verify:bundle-mode-consumer
```

## Next release steps

The pre-commit review corrected the packed consumer fixture to use the public
`time` field, removed an overstated changelog claim and an accidental pnpm
setting, and restored existing Linux libc metadata for unchanged dependencies.
`npm run verify` passed again; React Doctor remained at 98/100 with no diagnostics.
The packed Bundle Mode check and npm 10/11 install dry-runs were also repeated.
Unrelated working-tree files are excluded from this commit.

1. An explicitly authorized prerelease can be published under `next`, with the
   version-specific optional native patch and documented validation limits.
   Publication has not been requested.
2. Before a stable release, complete balanced broader frame-pacing comparisons
   (candle/multi-series interactions and Android) and the remaining device checks
   in [issue-409-qa.md](issue-409-qa.md). Decide whether to require a fixed Skia
   release or retain the explicit consumer workaround.

Dual-v2/v3 support is a separate compatibility task. Existing LiveChart 4.x
releases remain available to Shopify Skia consumers.
