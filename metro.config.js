// @ts-check
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;

// Monorepo: watch the chart package so Fast Refresh picks up edits under packages/.
// The library resolves to TypeScript in src/; Metro compiles it with the app Babel
// config (see README). Published tarballs use the same entry points via package.json exports.
const livechartRoot = path.resolve(
  projectRoot,
  "packages/react-native-livechart",
);

const config = getDefaultConfig(projectRoot);
// Expo inlines EXPO_PUBLIC_* values during transformation, but Metro's default
// cache key does not include those values. Profiling builds run sequentially with
// different matrix selections, so give each selection its own transform cache;
// otherwise a later trace can silently reuse the first run's bundle.
const rendererProfileCacheKey = [
  process.env.EXPO_PUBLIC_MEMORY_PROFILE_RUN ?? "default",
  process.env.EXPO_PUBLIC_MEMORY_PROFILE_MODE ?? "default",
  process.env.EXPO_PUBLIC_MEMORY_PROFILE_CADENCE ?? "default",
].join(":");

// Metro types mark `watchFolders` readonly — merge a new object instead of mutating.
module.exports = {
  ...config,
  cacheVersion: `${config.cacheVersion ?? "1"}:renderer-profile:${rendererProfileCacheKey}`,
  watchFolders: [...(config.watchFolders ?? []), livechartRoot],
};
