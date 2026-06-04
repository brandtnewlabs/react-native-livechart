# Contributing

Thanks for your interest in improving **react-native-livechart**! This guide covers the
local setup and the conventions we follow. By participating you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).

## Repository layout

This is an npm-workspaces **monorepo**:

- `packages/react-native-livechart/` — the publishable library
- Root — an **Expo example app** (`app/demo/` screens) that demos the library against its
  `src/` directly

## Prerequisites

- **Node.js 22** (matches CI)
- npm (the repo uses npm workspaces and a committed `package-lock.json`)
- For running on a device/simulator: the standard Expo / React Native iOS or Android
  toolchain

## Setup

```bash
npm install        # installs root + workspace deps
npm start          # expo start (dev server for the example app)
npm run ios        # build & run the example on iOS
```

The example app bundles the library from `src/` via Metro `watchFolders`, so Fast Refresh
picks up library edits without a separate build step.

## Development workflow

```bash
npm run verify      # typecheck + lint + test (run this before opening a PR)

# individual steps
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (expo flat config)
npm test            # all tests (Jest + jest-expo)
npm run test:lib    # library tests only
npx jest path/to/file   # a single test file
```

A **pre-commit hook** (husky) runs `npm test`; all tests must pass before a commit lands.

### Babel: worklets plugin must be last

`react-native-worklets/plugin` must be the **last** entry in the Babel `plugins` array
(see [`babel.config.js`](babel.config.js)). Reordering it breaks worklet compilation at
build or runtime.

### Testing notes

Tests run under `jest-expo` with a Skia mock and a Reanimated/Worklets stub (see
[`jest-setup.js`](jest-setup.js)). `SharedValue`s in tests are plain `{ value }` objects —
full UI-thread round-trips don't execute under Jest, so a few tests that depend on those
flows are skipped; exercise them in the Expo app instead. Coverage thresholds are enforced
(branches 90%, functions/lines/statements 95%).

## Pull requests

1. Branch off `main`.
2. Make your change with tests where it makes sense.
3. Ensure `npm run verify` is green.
4. Use clear, conventional commit messages (e.g. `fix:`, `feat:`, `refactor:`, `chore:`),
   matching the existing history.
5. Open the PR with a short description of the what and why.

Thanks for contributing! 🙌
