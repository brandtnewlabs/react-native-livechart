---
name: publish-library
description: >-
  Publish the react-native-livechart library to npm from this monorepo. Use
  this whenever the user wants to publish, ship, or release the package to npm —
  including the first-ever publish — or asks how publishing works here. Covers
  the workspace-scoping gotcha (a bare `npm publish` targets the Expo example
  app, not the library), the `private: false` gate, the source-shipping/prepack
  model, dry-run verification, and the required post-publish steps (push, tag,
  and a GitHub Release). Trigger even if the
  user just says "push it to npm", "can we publish now", or "ship the package"
  without naming the skill. For deciding a version bump + CHANGELOG first, see
  the update-library skill.
---

# Publish react-native-livechart to npm

This repo is an **npm-workspaces monorepo**. The publishable library lives at
`packages/react-native-livechart/`; the repo root is the **Expo example app**
(`react-native-livechart-expo-example`, kept `"private": true`).

## The one rule that breaks everything: scope to the workspace

Every npm command that touches the library **must** be scoped with
`-w react-native-livechart`. A bare `npm publish` / `npm pack` run from the root
operates on the **example app**, not the library — it'll sweep the whole repo
(demo screens, assets, tests) into a tarball named `react-native-livechart-expo-example`.

The root's `"private": true` is the safety net that stops an accidental root
publish, but don't rely on it — always pass `-w`.

```bash
npm pack    --dry-run -w react-native-livechart   # inspect what would ship
npm publish           -w react-native-livechart   # publish
```

## Mental model (why the steps below look the way they do)

- **The library ships TypeScript _source_.** `main`/`module`/`react-native` and
  every `exports` condition except `types` point at `src/index.ts`. The
  consumer's Metro + Babel compiles it — so worklets get processed by the
  consumer's `react-native-worklets/plugin`. `dist/` contains **only `.d.ts`**.
- **`prepack` builds for you.** `npm publish` runs `prepare` → `prepack`
  automatically, which does `tsc -p tsconfig.build.json` (emits `dist/*.d.ts`)
  and copies the repo-root `README.md` into the package. **Do not** hand-build
  or hand-copy the README — let the lifecycle do it.
- **`react`, `react-native`, Skia, Reanimated, Worklets, and Gesture Handler
  are peer dependencies.** They must never appear in `dependencies`.

## Preflight checklist

1. **Branch & tree.** Be on the branch you intend to release from with a clean
   working tree (`git status`). Releases normally go from `main`.
2. **Green build.** `npm run verify` (typecheck + lint + test) passes. The
   husky pre-commit hook also runs tests, but verify explicitly here.
3. **`private` gate.** Open `packages/react-native-livechart/package.json` and
   confirm `"private": false`. **On the first-ever publish it is `true`** — flip
   it to `false` and commit that change. (Leave the root `package.json` private.)
4. **Version sanity.** Check the `version` field is the one you intend and isn't
   already on the registry: `npm view react-native-livechart version`. An E404
   means it's never been published (expected for the first release). If you need
   to bump the version, stop and use the **update-library** skill first.
5. **Auth.** `npm whoami` (run `npm login` if it errors). Have your 2FA code
   ready if the account enforces OTP.

## Inspect what will ship — always dry-run first

```bash
npm pack --dry-run -w react-native-livechart
```

Verify in the output:
- **`name: react-native-livechart`** (NOT `...-expo-example` — if you see that,
  you forgot `-w`).
- Contents are `src/**` + `dist/**/*.d.ts` + `README.md` + `LICENSE` only.
- **No** `tests/`, `tsconfig*.json`, `babel.lib.config.cjs`, or other configs.

The `files` allowlist (`dist`, `src`, `LICENSE`) plus the package `.npmignore`
control this; `README` and `LICENSE` are always included by npm regardless.

## Publish

```bash
npm publish -w react-native-livechart
```

- `react-native-livechart` is **unscoped and public**, so you do **not** need
  `--access public` (that flag is only for `@scope/...` packages).
- If 2FA is on: append `--otp=<6-digit-code>`.
- `npm publish --dry-run -w react-native-livechart` does a full rehearsal
  (including the registry handshake) without uploading — use it if you want one
  more confirmation beyond `npm pack --dry-run`.

## Post-publish — ALL FOUR steps are required, do not stop early

A release is **not done** until the GitHub Release exists. Shipping to npm + a git
tag without the GitHub Release has bitten us before — the releases page silently
fell behind. Run all four:

1. **Confirm it's live.** ⚠️ `npm view react-native-livechart version` and
   `... dist-tags` can lag the registry CDN by minutes and show the *previous*
   version even when the publish succeeded — do **not** treat that as a failure.
   Confirm the *specific* version instead, which is not cached the same way:
   ```bash
   npm view react-native-livechart@<X.Y.Z> version   # echoes <X.Y.Z> when live
   ```
2. **Push the release commit.** The `chore(release): vX.Y.Z` commit is usually
   still local — push it before tagging so the tag has a pushed commit to point at:
   ```bash
   git push origin main
   ```
3. **Tag the release** (convention: `vX.Y.Z`, established across the repo):
   ```bash
   git tag v$(node -p "require('./packages/react-native-livechart/package.json').version")
   git push origin "v$(node -p "require('./packages/react-native-livechart/package.json').version")"
   ```
4. **Cut the GitHub Release — REQUIRED, not optional.** Every version has one and
   the root `CHANGELOG.md` links to `/releases/tag/vX.Y.Z`, so a missing release =
   a dead link. Title convention is **`vX.Y.Z — <short feature name>`** (e.g.
   "v3.6.0 — Custom markers", "v3.5.1 — Crisp markers", "v3.5.0 — Threshold
   split"); body is that version's `CHANGELOG.md` section. Mark the newest the
   latest:
   ```bash
   # Put the version's CHANGELOG section in /tmp/relnotes.md first, then:
   gh release create v<X.Y.Z> --repo brandtnewlabs/react-native-livechart \
     --title "v<X.Y.Z> — <feature>" --notes-file /tmp/relnotes.md --verify-tag --latest
   ```
   Then verify: `gh release list --repo brandtnewlabs/react-native-livechart` shows
   the new version as `Latest`.

If you publish to npm but get blocked (e.g. a safety prompt) before finishing
2–4, the release is **incomplete** — come back and finish every remaining step.

## If something's wrong after publishing

You generally **cannot** silently overwrite a published version — npm forbids
re-publishing the same version number. Within 72 hours you can
`npm unpublish react-native-livechart@<version>` (use sparingly; it breaks
consumers). Otherwise bump a new patch via the **update-library** skill, or
`npm deprecate react-native-livechart@<version> "<reason>"` to warn installers.
