import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repoRoot = path.resolve(packageRoot, "../..");
const patchName = "react-native-skia+3.3.0.patch";

copyFileSync(path.join(repoRoot, "README.md"), path.join(packageRoot, "README.md"));
mkdirSync(path.join(packageRoot, "patches"), { recursive: true });
// Keep the tested example patch as the single source. Consumers opt in;
// installing LiveChart does not modify their native peer dependency.
copyFileSync(
  path.join(repoRoot, "patches", patchName),
  path.join(packageRoot, "patches", patchName),
);
