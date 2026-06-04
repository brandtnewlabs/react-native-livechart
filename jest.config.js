/** @type {import("jest").Config} */
const preset = require("jest-expo/jest-preset");

module.exports = {
  ...preset,
  watchman: false,
  resolver: "<rootDir>/jest-resolver.js",
  setupFilesAfterEnv: ["<rootDir>/jest-setup.js"],
  testMatch: ["**/*.test.{ts,tsx}"],
  collectCoverageFrom: [
    "packages/react-native-livechart/src/**/*.{ts,tsx}",
    "!packages/react-native-livechart/tests/**",
    "!packages/react-native-livechart/src/types.ts",
    "!packages/react-native-livechart/src/index.ts",
    "!packages/react-native-livechart/src/**/index.ts",
    // UI-thread worklets in this module are not fully exercised under Jest; covered via chart integration tests.
    "!packages/react-native-livechart/src/hooks/useReverseMorphEngineInputs.ts",
  ],

  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
};
