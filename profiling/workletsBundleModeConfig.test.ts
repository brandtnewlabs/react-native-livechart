import { execFileSync } from "node:child_process";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");

function loadConfig(bundleMode: boolean) {
  const script = `
    const babel = require('./babel.config')({ cache: { using() {} } });
    const metro = require('./metro.config');
    const plugin = babel.plugins.at(-1);
    process.stdout.write(JSON.stringify({
      plugin,
      cacheVersion: metro.cacheVersion,
      moduleIdFactory: metro.serializer.createModuleIdFactory.name,
    }));
  `;
  return JSON.parse(
    execFileSync(process.execPath, ["-e", script], {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        WORKLETS_BUNDLE_MODE: bundleMode ? "1" : "0",
      },
    }),
  );
}

describe("Worklets Bundle Mode build configuration", () => {
  it("keeps legacy mode reproducible", () => {
    const config = loadConfig(false);
    expect(config.plugin).toEqual(["react-native-worklets/plugin", {}]);
    expect(config.cacheVersion).toContain("worklets-legacy");
    expect(config.moduleIdFactory).not.toBe("bundleModeCreateModuleIdFactory");
  });

  it("enables matching Babel and Metro bundle-mode transforms", () => {
    const config = loadConfig(true);
    expect(config.plugin).toEqual([
      "react-native-worklets/plugin",
      { bundleMode: true, strictGlobal: true },
    ]);
    expect(config.cacheVersion).toContain("worklets-bundle");
    expect(config.moduleIdFactory).toBe("bundleModeCreateModuleIdFactory");
  });
});
