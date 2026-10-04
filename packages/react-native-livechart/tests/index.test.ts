import * as entry from "../src/index";
import * as hooks from "../src/hooks";
import type {
  DotConfig,
  DotRingConfig,
  LineStyleConfig,
  LiveChartProps,
  TimeScrollConfig,
} from "../src/index";

describe("package entry", () => {
  it("exports LiveChart and LiveChartSeries", () => {
    expect(entry.LiveChart).toBeDefined();
    expect(entry.LiveChartSeries).toBeDefined();
  });

  it("exports the config types the docs name", () => {
    // Compile-time check (`npm run typecheck`): each type must be importable
    // from the entry and accepted where the public props use it.
    const ring: DotRingConfig = { width: 2 };
    const dot: DotConfig = { radius: 4, ring };
    const timeScroll: TimeScrollConfig = { gesture: "axisDrag" };
    const connector: LineStyleConfig = { intervals: [3, 3] };
    const props: Pick<LiveChartProps, "dot" | "timeScroll" | "topLabel"> = {
      dot,
      timeScroll,
      topLabel: { connector },
    };

    expect(props).toEqual({ dot, timeScroll, topLabel: { connector } });
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
