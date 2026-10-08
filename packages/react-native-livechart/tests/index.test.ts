import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as entry from "../src/index";
import * as hooks from "../src/hooks";

/** Types declared in `src/types.ts` that are deliberately not public. */
const INTERNAL_TYPES: string[] = [];

function readSource(file: string): string {
  return readFileSync(join(__dirname, "../src", file), "utf8");
}

describe("package entry", () => {
  it("exports LiveChart and LiveChartSeries", () => {
    expect(entry.LiveChart).toBeDefined();
    expect(entry.LiveChartSeries).toBeDefined();
  });

  // Type-only exports are erased before Jest runs, so read the sources: a type
  // added to types.ts must also be listed in the entry (or in INTERNAL_TYPES).
  it("re-exports every type declared in types.ts", () => {
    const declared = [
      ...readSource("types.ts").matchAll(/^export\s+(?:interface|type)\s+(\w+)/gm),
    ].map((m) => m[1]);
    const list = /export\s+type\s*\{([^}]*)\}\s*from\s*"\.\/types"/.exec(
      readSource("index.ts"),
    );
    expect(declared.length).toBeGreaterThan(0);
    expect(list).not.toBeNull();

    const exported = new Set(
      (list?.[1] ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    );
    const missing = declared.filter(
      (name) => !exported.has(name) && !INTERNAL_TYPES.includes(name),
    );
    expect(missing).toEqual([]);
  });
});

describe("hooks barrel", () => {
  it("re-exports hooks", () => {
    expect(hooks.useBadge).toBeDefined();
    expect(hooks.useCanvasLayout).toBeDefined();
    expect(hooks.useChartPaths).toBeDefined();
    expect(hooks.useLiveDot).toBeDefined();
    expect(hooks.useReferenceLine).toBeDefined();
    expect(hooks.useXAxis).toBeDefined();
    expect(hooks.useYAxis).toBeDefined();
    expect(hooks.useCrosshairSeries).toBeDefined();
  });
});
