/** @type {import("jest").Config} */
module.exports = {
  preset: "jest-expo",
  watchman: false,
  setupFilesAfterEnv: ["<rootDir>/jest-setup.js"],
  testMatch: ["**/*.test.{ts,tsx}"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/types.ts",
    "!src/index.ts",
    "!src/**/index.ts",
  ],

  coverageThreshold: {
    global: {
      branches: 99,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
