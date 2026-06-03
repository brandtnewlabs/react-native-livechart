# AGENTS.md

AI coding agents working in this repository should follow the guidance in
**[CLAUDE.md](CLAUDE.md)** — it is the single source of truth for architecture, commands, and
conventions. This file is a thin pointer kept deliberately short so there's no duplicated content
to drift out of sync.

Quick orientation:

- **Monorepo** — the publishable library lives in `packages/react-native-livechart/`; the repo
  root is an Expo example app.
- **Before committing** — run `npm run verify` (typecheck + lint + test). A husky pre-commit hook
  also runs the tests.
- **Contributing** — see [CONTRIBUTING.md](CONTRIBUTING.md).

For everything else (engine architecture, worklet rules, drawing layer, testing setup), read
**[CLAUDE.md](CLAUDE.md)**.
