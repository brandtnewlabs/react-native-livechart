import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Workspace publishing can ignore publishConfig.tag. Require an explicit tag
// matching the release line, including future 4.x maintenance under legacy.
export function assertPublishTag(manifest, tag = "latest") {
  const prerelease = manifest.version.includes("-");
  const expected = manifest.publishConfig?.tag ?? (prerelease ? "next" : "latest");
  if ((prerelease && tag === "latest") || tag !== expected) {
    throw new Error(
      `Refusing to publish ${manifest.version} to ${tag}. ` +
        `Use npm publish -w react-native-livechart --tag ${expected}.`,
    );
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  assertPublishTag(manifest, process.env.npm_config_tag);
}
