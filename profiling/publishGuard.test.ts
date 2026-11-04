import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const guard = pathToFileURL(
  path.resolve(__dirname, "../packages/react-native-livechart/scripts/check-publish-tag.mjs"),
).href;

function check(version: string, configuredTag?: string, requestedTag?: string) {
  return spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    `import { assertPublishTag } from ${JSON.stringify(guard)};
     assertPublishTag(JSON.parse(process.argv[1]), JSON.parse(process.argv[2]) ?? undefined);`,
    JSON.stringify({ version, publishConfig: { tag: configuredTag } }),
    JSON.stringify(requestedTag ?? null),
  ], { encoding: "utf8" });
}

describe("release line publication guard", () => {
  test.each<[string, string | undefined, string | undefined]>([
    ["5.0.0-rc.0", "next", "next"],
    ["4.30.3", "legacy", "legacy"],
    ["5.0.0", "latest", "latest"],
    ["5.0.0-rc.1", undefined, "next"],
    ["5.0.1", undefined, "latest"],
  ])("allows %s configured for %s with requested tag %s", (version, configured, requested) => {
    expect(check(version, configured, requested).status).toBe(0);
  });

  test.each([
    ["5.0.0-rc.0", "next", "latest"],
    ["5.0.0-rc.0", "next", "beta"],
    ["4.30.3", "legacy", "latest"],
    ["5.0.0", "latest", "next"],
    ["5.0.0-rc.0", "latest", "latest"],
  ])("rejects %s published to %s/%s", (version, configured, requested) => {
    const result = check(version, configured, requested);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`Refusing to publish ${version} to ${requested}`);
  });

  test("rejects an untagged workspace publish of the candidate", () => {
    const result = spawnSync(process.execPath, [
      path.resolve(__dirname, "../packages/react-native-livechart/scripts/check-publish-tag.mjs"),
    ], { env: { ...process.env, npm_config_tag: "latest" }, encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--tag next");
  });
});
