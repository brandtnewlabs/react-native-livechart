/** Babel config for publishing `dist/` — mirrors what Metro does per file (Worklets last). */
module.exports = {
  assumptions: {
    setPublicClassFields: true,
  },
  presets: [
    [
      "@babel/preset-typescript",
      { allowDeclareFields: true, isTSX: true, allExtensions: true },
    ],
    ["@babel/preset-react", { runtime: "automatic" }],
  ],
  plugins: [
    "@babel/plugin-transform-modules-commonjs",
    "react-native-worklets/plugin",
  ],
};
