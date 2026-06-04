---
name: publish-library
description: >-
  Publish the react-native-livechart library to npm from this monorepo. Use
  this whenever the user wants to publish, ship, or release the package to npm —
  including the first-ever publish — or asks how publishing works here. Covers
  the workspace-scoping gotcha (a bare `npm publish` targets the Expo example
  app, not the library), the `private: false` gate, the source-shipping/prepack
  model, dry-run verification, and post-publish tagging. Trigger even if the
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

## Post-publish

1. **Confirm it's live:** `npm view react-native-livechart version`.
2. **Tag the release** (there are no tags yet, so this establishes the
   convention):
   ```bash
   git tag v$(node -p "require('./packages/react-native-livechart/package.json').version")
   git push --tags
   ```
3. Optionally cut a GitHub release from that tag.

## If something's wrong after publishing

You generally **cannot** silently overwrite a published version — npm forbids
re-publishing the same version number. Within 72 hours you can
`npm unpublish react-native-livechart@<version>` (use sparingly; it breaks
consumers). Otherwise bump a new patch via the **update-library** skill, or
`npm deprecate react-native-livechart@<version> "<reason>"` to warn installers.
