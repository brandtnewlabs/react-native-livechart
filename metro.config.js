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

// Metro types mark `watchFolders` readonly — merge a new object instead of mutating.
module.exports = {
  ...config,
  watchFolders: [...(config.watchFolders ?? []), livechartRoot],
};
