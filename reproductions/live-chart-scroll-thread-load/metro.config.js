const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const SINGLETON_PACKAGES = [
  "@shopify/react-native-skia",
  "react",
  "react-native",
  "react-native-gesture-handler",
  "react-native-reanimated",
  "react-native-worklets",
];

const packageRootByName = Object.fromEntries(
  SINGLETON_PACKAGES.map((packageName) => [
    packageName,
    path.dirname(
      require.resolve(`${packageName}/package.json`, { paths: [__dirname] }),
    ),
  ]),
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const packageName = SINGLETON_PACKAGES.find(
    (candidate) =>
      moduleName === candidate || moduleName.startsWith(`${candidate}/`),
  );

  if (!packageName) {
    return context.resolveRequest(context, moduleName, platform);
  }

  const packagePath = path.join(
    packageRootByName[packageName],
    moduleName.slice(packageName.length),
  );
  return context.resolveRequest(context, packagePath, platform);
};

module.exports = config;
