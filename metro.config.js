// @ts-check
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;

// Monorepo: watch the chart package so Fast Refresh sees edits under packages/.
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
