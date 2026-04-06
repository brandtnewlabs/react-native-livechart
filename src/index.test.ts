import * as entry from "./index";
import * as hooks from "./hooks";

describe("package entry", () => {
  it("exports Liveline runtime", () => {
    expect(entry.Liveline).toBeDefined();
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
  });
});
