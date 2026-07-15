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
- **Docs are mandatory** — any change to the library's public API (props, types, config, hooks,
  exports) MUST update the docs (`docs/`, JSDoc) and `CHANGELOG.md` in the same change. See the
  **Documentation (MANDATORY)** section in [CLAUDE.md](CLAUDE.md).
- **Contributing** — see [CONTRIBUTING.md](CONTRIBUTING.md).

For everything else (engine architecture, worklet rules, drawing layer, testing setup), read
**[CLAUDE.md](CLAUDE.md)**.

## Agent skills

Codex skills live canonically under `.agents/skills/`. The `.claude/skills/` path is a symlink to
that directory so Claude Code and Codex always load the same skill files. Add or edit skills only
under `.agents/skills/`; do not create a second copy under `.claude/skills/`.
