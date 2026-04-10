"use strict";

const path = require("path");
const reactNativeResolver = require("react-native/jest/resolver");

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
