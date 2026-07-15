import { execFileSync } from "node:child_process";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");

function loadCacheVersion(
  run: string,
  mode: string,
  cadence: string,
): string {
  return execFileSync(
    process.execPath,
    [
      "-e",
      "process.stdout.write(String(require('./metro.config').cacheVersion))",
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        EXPO_PUBLIC_MEMORY_PROFILE_RUN: run,
        EXPO_PUBLIC_MEMORY_PROFILE_MODE: mode,
        EXPO_PUBLIC_MEMORY_PROFILE_CADENCE: cadence,
      },
    },
  ).trim();
}

describe("renderer profiling Metro cache", () => {
  it("uses a separate transform cache for every profiling selector", () => {
    const baseline = loadCacheVersion("static-control", "static", "display");

    expect(baseline).toContain(
      "renderer-profile:static-control:static:display",
    );
    expect(loadCacheVersion("live-control", "static", "display")).not.toBe(
      baseline,
    );
    expect(loadCacheVersion("static-control", "live", "display")).not.toBe(
      baseline,
    );
    expect(loadCacheVersion("static-control", "static", "adaptive")).not.toBe(
      baseline,
    );
  });
});
