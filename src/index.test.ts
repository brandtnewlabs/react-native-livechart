import * as entry from "./index";
import * as hooks from "./hooks";

describe("package entry", () => {
  it("exports Liveline and LivelineMulti", () => {
    expect(entry.Liveline).toBeDefined();
    expect(entry.LivelineMulti).toBeDefined();
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
    expect(hooks.useCrosshairMulti).toBeDefined();
  });
});
