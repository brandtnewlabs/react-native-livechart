"use strict";

const path = require("path");
// RN 0.85 moved the default jest resolver out of `react-native/jest` into the
// `@react-native/jest-preset` package (the preset references it the same way).
const reactNativeResolver = require("@react-native/jest-preset/jest/resolver");

const reanimatedLib = path.join(
  __dirname,
  "node_modules/react-native-reanimated/lib/module/index.js",
);
const workletsLib = path.join(
  __dirname,
  "node_modules/react-native-worklets/lib/module/index.js",
);

module.exports = (request, options) => {
  if (request === "react-native-reanimated") {
    return options.defaultResolver(reanimatedLib, options);
  }
  if (request === "react-native-worklets") {
    return options.defaultResolver(workletsLib, options);
  }
  return reactNativeResolver(request, options);
};
