#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratchRoot = path.join(root, ".expo");
mkdirSync(scratchRoot, { recursive: true });
const consumerRoot = mkdtempSync(
  path.join(scratchRoot, "bundle-mode-consumer-"),
);

function run(command, args, cwd = consumerRoot) {
  console.log(`$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd,
    env: {
      ...process.env,
      CI: "1",
      EXPO_NO_TELEMETRY: "1",
    },
    stdio: "inherit",
  });
}

function write(relativePath, contents) {
  const target = path.join(consumerRoot, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function findFiles(directory, predicate) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return findFiles(target, predicate);
    }
    return predicate(target) ? [target] : [];
  });
}

try {
  write(
    "package.json",
    `${JSON.stringify(
      {
        name: "livechart-packed-bundle-mode-smoke",
        version: "1.0.0",
        private: true,
        main: "index.js",
      },
      null,
      2,
    )}\n`,
  );

  run(
    "npm",
    [
      "pack",
      "--workspace",
      "react-native-livechart",
      "--pack-destination",
      consumerRoot,
    ],
    root,
  );

  const tarballs = readdirSync(consumerRoot).filter((name) =>
    name.endsWith(".tgz"),
  );
  assert.equal(tarballs.length, 1, "expected one packed library tarball");
  const tarball = path.join(consumerRoot, tarballs[0]);

  run("npm", [
    "install",
    "--ignore-scripts",
    "--legacy-peer-deps",
    "--no-audit",
    "--no-fund",
    "--no-package-lock",
    "--no-save",
    tarball,
  ]);

  const rootManifest = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8"),
  );
  write(
    "package.json",
    `${JSON.stringify(
      {
        name: "livechart-packed-bundle-mode-smoke",
        version: "1.0.0",
        private: true,
        main: "index.js",
        dependencies: {
          ...rootManifest.dependencies,
          "react-native-livechart": `file:${tarball}`,
        },
      },
      null,
      2,
    )}\n`,
  );

  write(
    "app.json",
    `${JSON.stringify(
      {
        expo: {
          name: "LiveChart Bundle Mode Smoke",
          slug: "livechart-bundle-mode-smoke",
          version: "1.0.0",
          platforms: ["ios"],
          ios: {
            bundleIdentifier: "com.brandtnewlabs.livechart-bundle-mode-smoke",
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  write(
    "babel.config.js",
    `module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "react-native-worklets/plugin",
        { bundleMode: true, strictGlobal: true },
      ],
    ],
  };
};
`,
  );

  write(
    "metro.config.js",
    `const { getDefaultConfig } = require("expo/metro-config");
const {
  getBundleModeMetroConfig,
} = require("react-native-worklets/bundleMode");

module.exports = getBundleModeMetroConfig(getDefaultConfig(__dirname));
`,
  );

  write(
    "index.js",
    `import React from "react";
import { View } from "react-native";
import { registerRootComponent } from "expo";
import { useSharedValue } from "react-native-reanimated";
import { LiveChart } from "react-native-livechart";

function App() {
  const data = useSharedValue([
    { timestamp: 0, value: 100 },
    { timestamp: 1, value: 101 },
  ]);
  const value = useSharedValue(101);

  return (
    <View style={{ flex: 1 }}>
      <LiveChart data={data} value={value} />
    </View>
  );
}

registerRootComponent(App);
`,
  );

  const installedManifestPath = path.join(
    consumerRoot,
    "node_modules",
    "react-native-livechart",
    "package.json",
  );
  const installedManifest = JSON.parse(
    readFileSync(installedManifestPath, "utf8"),
  );
  assert.equal(
    installedManifest.exports["."]["react-native"],
    "./src/index.ts",
    "packed package must expose source to the consumer Babel pipeline",
  );
  assert.match(
    readFileSync(
      path.join(
        consumerRoot,
        "node_modules",
        "react-native-livechart",
        "README.md",
      ),
      "utf8",
    ),
    /Optional: Worklets Bundle Mode/,
    "packed package must include the Bundle Mode consumer setup",
  );

  const expoCli = path.join(root, "node_modules", "expo", "bin", "cli");
  run(process.execPath, [
    expoCli,
    "export",
    "--platform",
    "ios",
    "--clear",
    "--output-dir",
    path.join(consumerRoot, "dist"),
  ]);

  const outputRoot = path.join(consumerRoot, "dist");
  const bundles = findFiles(
    outputRoot,
    (file) =>
      statSync(file).size > 0 &&
      (file.endsWith(".hbc") || file.endsWith(".js")),
  );
  assert.ok(bundles.length > 0, "expected a non-empty exported iOS bundle");

  console.log(
    `Packed consumer Bundle Mode export passed (${bundles.length} bundle artifact(s)).`,
  );
} finally {
  rmSync(consumerRoot, { recursive: true, force: true });
}
