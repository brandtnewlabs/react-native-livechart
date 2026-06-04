---
name: update-library
description: >-
  Cut and release a NEW version of the react-native-livechart library: choose
  the semver bump, update the version field, update the CHANGELOG, verify, then
  publish. Use this whenever the user wants to release a new version, bump the
  version, ship an update/patch/minor/major, publish changes since the last
  release, or "cut a release" of the package — even if they don't name the
  skill. This skill owns the versioning + changelog decisions; for the npm
  publish mechanics themselves it hands off to the publish-library skill.
---

# Release a new version of react-native-livechart

Use this to turn merged changes into a published version. The flow is: **decide
the bump → write it down (version + CHANGELOG) → verify → publish**. The actual
`npm publish` mechanics (workspace scoping, the `private` gate, dry-run, tagging)
live in the **publish-library** skill — follow it for the final step rather than
duplicating those commands here.

All version/changelog edits target the **library** package
(`packages/react-native-livechart/`), never the repo root (the root is the
private example app).

## Step 1 — Choose the semver bump

The package is past `1.0.0`, so semver is in full effect. Decide based on what
changed since the last release, paying special attention to the **public API**
(exported components, props, types) and **peer dependency ranges**:

- **patch** (`x.y.Z`) — bug fixes, internal/perf changes, doc-only changes. No
  consumer code or install changes required.
- **minor** (`x.Y.0`) — new backward-compatible surface: new props, new exports,
  new optional config. Existing code keeps working untouched.
- **major** (`X.0.0`) — anything that can break a consumer: removed/renamed
  props or exports, changed default behavior, or **widening/raising a peer
  dependency requirement** (e.g. requiring a newer Reanimated/Skia). Peer-range
  changes are easy to forget — treat them as breaking.

If you're unsure which changes landed, `git log --oneline v<last-version>..HEAD`
(or since the last release commit) is the source of truth.

## Step 2 — Bump the version

Edit `version` in `packages/react-native-livechart/package.json`, or let npm do
it **without** touching git (workspace git-tagging behaves inconsistently, so we
tag explicitly later in publish-library):

```bash
npm version <patch|minor|major> -w react-native-livechart --no-git-tag-version
```

This rewrites only the library's `version`. Note the new version for the
CHANGELOG and the eventual tag.

## Step 3 — Update the CHANGELOG

Maintain `CHANGELOG.md` at the **repo root** (it's the single README/changelog
home for the project). If it doesn't exist yet, create it using the
[Keep a Changelog](https://keepachangelog.com/) format with a `## [Unreleased]`
section at the top.

For this release, move the relevant `Unreleased` notes (or write fresh ones)
under a new heading:

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- ...
### Changed
- ...
### Fixed
- ...
### Breaking  (only for a major)
- ...
```

Group entries from the user's perspective (props, behavior, peers) — not by
commit. Keep `### Breaking` honest; it's what tells consumers whether the
upgrade is safe.

## Step 4 — Verify

```bash
npm run verify
```

Typecheck + lint + test must pass before you publish a release.

## Step 5 — Commit the release

```bash
git add packages/react-native-livechart/package.json CHANGELOG.md
git commit -m "chore(release): v<X.Y.Z>"
```

(If the repo's convention is to release via PR into `main`, open the PR here and
let it merge before publishing. Otherwise commit on the release branch / `main`
per the user's flow.)

## Step 6 — Publish

Hand off to the **publish-library** skill for the rest: dry-run inspection,
`npm publish -w react-native-livechart`, the post-publish `npm view` check, and
tagging `v<X.Y.Z>`. Don't re-derive those commands — that skill is the source of
truth for the npm mechanics and the workspace-scoping gotcha.
