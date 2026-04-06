import * as entry from "../src/index";
import * as hooks from "../src/hooks";

describe("package entry", () => {
  it("exports LiveChart and LiveChartSeries", () => {
    expect(entry.LiveChart).toBeDefined();
    expect(entry.LiveChartSeries).toBeDefined();
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
