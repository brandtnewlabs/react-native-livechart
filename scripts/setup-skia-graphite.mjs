#!/usr/bin/env node

import { createRequire } from "node:module";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

const packageRoot = (name) =>
  path.dirname(require.resolve(`${name}/package.json`));

const skiaRoot = packageRoot("@shopify/react-native-skia");
const skiaPackage = JSON.parse(
  readFileSync(path.join(skiaRoot, "package.json"), "utf8"),
);

if (skiaPackage.version !== "2.7.0") {
  throw new Error(
    `Graphite setup expects @shopify/react-native-skia 2.7.0, found ${skiaPackage.version}`,
  );
}

const libsRoot = path.join(skiaRoot, "libs");
rmSync(libsRoot, { recursive: true, force: true });
mkdirSync(libsRoot, { recursive: true });

const copyPackageLibs = (name, destination) => {
  cpSync(path.join(packageRoot(name), "libs"), destination, {
    recursive: true,
    force: true,
  });
};

copyPackageLibs(
  "react-native-skia-graphite-android",
  path.join(libsRoot, "android"),
);
copyPackageLibs(
  "react-native-skia-graphite-apple-ios",
  path.join(libsRoot, "ios"),
);
copyPackageLibs(
  "react-native-skia-graphite-apple-macos",
  path.join(libsRoot, "macos"),
);

const headersRoot = path.join(
  packageRoot("react-native-skia-graphite-headers"),
  "libs/skia/cpp",
);
cpSync(path.join(headersRoot, "skia"), path.join(skiaRoot, "cpp/skia"), {
  recursive: true,
  force: true,
});
cpSync(path.join(headersRoot, "dawn"), path.join(skiaRoot, "cpp/dawn"), {
  recursive: true,
  force: true,
});

writeFileSync(path.join(libsRoot, ".graphite"), "m150\n");
console.log(
  "React Native Skia 2.7.0 configured with the Graphite m150 backend.",
);
