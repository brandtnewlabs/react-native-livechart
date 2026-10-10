import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const tag = process.env.npm_config_tag ?? "latest";

// Workspace publishing can ignore publishConfig.tag. Require an explicit tag
// for prereleases rather than allowing npm's default to replace stable latest.
if (manifest.version.includes("-") && tag === "latest") {
  throw new Error(
    `Refusing to publish ${manifest.version} to latest. ` +
      "Use npm run publish:lib:next (or npm publish -w react-native-livechart --tag next).",
  );
}
