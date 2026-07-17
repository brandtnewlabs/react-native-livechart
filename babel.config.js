module.exports = function (api) {
  const bundleMode = process.env.WORKLETS_BUNDLE_MODE === "1";
  api.cache.using(() => bundleMode);
  return {
    presets: ["babel-preset-expo"],
    // The Worklets plugin must remain last. Bundle Mode is app-level build
    // configuration, so the example/profiling app selects it via an explicit
    // environment variable while legacy mode remains reproducible.
    plugins: [
      [
        "react-native-worklets/plugin",
        bundleMode ? { bundleMode: true, strictGlobal: true } : {},
      ],
    ],
  };
};
