// Generates the npm package README from the root README.
//
// The root README is the single source of truth and is rendered on GitHub,
// which supports inline <video>. npm does NOT render <video>, so this script
// derives an npm-safe README:
//   - removes GitHub-only blocks  (<!-- gh-only:start --> … <!-- gh-only:end -->)
//   - reveals npm-only blocks      (<!-- npm-only:start … npm-only:end -->),
//     which are kept inside an HTML comment so they stay hidden on GitHub.
// Run automatically from the package `prepack`; safe to run by hand.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let md = readFileSync(join(root, "README.md"), "utf8");
md = md.replace(/[ \t]*<!-- gh-only:start -->\n?[\s\S]*?<!-- gh-only:end -->\n?/g, "");
md = md.replace(/[ \t]*<!-- npm-only:start\n([\s\S]*?)\nnpm-only:end -->\n?/g, "$1\n");

writeFileSync(join(root, "packages", "react-native-livechart", "README.md"), md);
console.log("Generated packages/react-native-livechart/README.md (npm) from README.md");
