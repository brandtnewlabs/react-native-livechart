/**
 * Ensures every __pluginVersion stamp in dist/ matches the installed react-native-worklets version.
 * Run from packages/react-native-livechart (or pass PKG_ROOT).
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = process.env.PKG_ROOT
  ? path.resolve(process.env.PKG_ROOT)
  : path.resolve(__dirname, "..");

const require = createRequire(path.join(pkgRoot, "package.json"));
let workletsVersion;
try {
  const pkgPath = require.resolve("react-native-worklets/package.json");
  workletsVersion = JSON.parse(fs.readFileSync(pkgPath, "utf8")).version;
} catch (e) {
  console.error(
    "verify-worklets-dist: could not resolve react-native-worklets from",
    pkgRoot,
  );
  process.exit(1);
}

const distDir = path.join(pkgRoot, "dist");
if (!fs.existsSync(distDir)) {
  console.error(
    "verify-worklets-dist: missing dist/ — run npm run build first",
  );
  process.exit(1);
}

const PLUGIN_RE = /__pluginVersion\s*=\s*"([^"]+)"/g;

function walkJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walkJsFiles(p));
    else if (name.isFile() && name.name.endsWith(".js")) out.push(p);
  }
  return out;
}

/** @type {Set<string>} */
const found = new Set();
for (const file of walkJsFiles(distDir)) {
  const text = fs.readFileSync(file, "utf8");
  let m;
  PLUGIN_RE.lastIndex = 0;
  while ((m = PLUGIN_RE.exec(text)) !== null) {
    found.add(m[1]);
  }
}

if (found.size === 0) {
  console.error(
    "verify-worklets-dist: no __pluginVersion markers in dist/ — build may be stale or Worklets plugin did not run",
  );
  process.exit(1);
}

if (found.size > 1) {
  console.error(
    "verify-worklets-dist: multiple plugin versions in dist/:",
    [...found].join(", "),
  );
  process.exit(1);
}

const [distVersion] = [...found];
if (distVersion !== workletsVersion) {
  console.error(
    `verify-worklets-dist: mismatch — dist has __pluginVersion "${distVersion}" but react-native-worklets is "${workletsVersion}". Rebuild dist/ after bumping Worklets.`,
  );
  process.exit(1);
}

console.log(
  `verify-worklets-dist: ok — dist __pluginVersion matches react-native-worklets@${workletsVersion}`,
);
