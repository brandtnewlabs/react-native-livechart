import { DEFAULT_PADDING } from "../../src/draw/line";
import type {
  ChartEngineEdge,
  ChartEngineScroll,
  SingleEngineState,
} from "../../src/core/useLiveChartEngine";
import { renderHook } from "@testing-library/react-native";
import {
  resolveLineTipValue,
  useChartPaths,
} from "../../src/hooks/useChartPaths";
import { useSharedValue } from "react-native-reanimated";
import { withSharedValueAccessors } from "../support/sharedValueMock";

type ChartPathsEngine = SingleEngineState & ChartEngineScroll & ChartEngineEdge;

function makeEngine(
  overrides: Partial<ChartPathsEngine> = {},
): ChartPathsEngine {
  const base = {
    data: { value: [{ time: 1000, value: 1 }] },
    value: { value: 1 },
    displayValue: { value: 1 },
    edgeValue: { value: 1 },
    viewEnd: { value: null },
    displayMin: { value: 0 },
    displayMax: { value: 2 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 200 },
    canvasHeight: { value: 120 },
    timestamp: { value: 1000 },
  };
  return withSharedValueAccessors({
    ...base,
    ...overrides,
  }) as unknown as ChartPathsEngine;
}

describe("useChartPaths", () => {
  it("returns paths for chart data", async () => {
    const { result } = await renderHook(() =>
      useChartPaths(makeEngine(), DEFAULT_PADDING),
    );
    expect(result.current.linePath.value).toBeDefined();
    expect(result.current.fillPath.value).toBeDefined();
  });

  it("handles too few points for spline", async () => {
    const { result } = await renderHook(() =>
      useChartPaths(
        makeEngine({
          data: { value: [{ time: 1000, value: 1 }] },
          displayMin: { value: 0 },
          displayMax: { value: 0 },
        } as unknown as Partial<ChartPathsEngine>),
        DEFAULT_PADDING,
      ),
    );
    expect(result.current.linePath.value).toBeDefined();
  });

  it("builds straight-polyline paths when linear, incl. the threshold band", async () => {
    const { result } = await renderHook(() => {
      const thresholdY = useSharedValue(60);
      return useChartPaths(
        makeEngine({
          data: {
            value: [
              { time: 980, value: 1 },
              { time: 990, value: 1.5 },
              { time: 1000, value: 2 },
            ],
          },
        } as unknown as Partial<ChartPathsEngine>),
        DEFAULT_PADDING,
        undefined,
        thresholdY,
        true, // linear
      );
    });
    expect(result.current.linePath.value).toBeDefined();
    expect(result.current.fillPath.value).toBeDefined();
    expect(result.current.thresholdFillPath.value).toBeDefined();
  });

  it("builds the threshold band from the shader samples (series threshold)", async () => {
    const { result } = await renderHook(() => {
      // The split shader's evenly-spaced pixel-Y samples — used as the band's
      // bottom edge so it matches the shader (no bleed at step risers).
      const thresholdSamples = useSharedValue([50, 48, 44, 46, 45]);
      return useChartPaths(
        makeEngine({
          data: {
            value: [
              { time: 980, value: 1 },
              { time: 990, value: 1.5 },
              { time: 1000, value: 2 },
            ],
          },
        } as unknown as Partial<ChartPathsEngine>),
        DEFAULT_PADDING,
        undefined, // morphT
        undefined, // thresholdY (constant) — superseded by the samples below
        false, // linear
        undefined, // squiggleAmplitude
        undefined, // squiggleSpeed
        thresholdSamples, // time-varying band bottom
      );
    });
    expect(result.current.thresholdFillPath.value).toBeDefined();
  });

  it("splits line, area, and threshold geometry around explicit line gaps", async () => {
    const { result } = await renderHook(() => {
      const thresholdSamples = useSharedValue([50, 48, 44, 46, 45]);
      return useChartPaths(
        makeEngine({
          data: {
            value: [
              { time: 980, value: 1 },
              { time: 990, value: 1.5 },
              { time: 1_000, value: 2 },
            ],
          },
        } as unknown as Partial<ChartPathsEngine>),
        DEFAULT_PADDING,
        undefined,
        undefined,
        false,
        undefined,
        undefined,
        thresholdSamples,
        0,
        [{ from: 981, to: 989, kind: "unavailable" }],
      );
    });
    expect(result.current.linePath.value).toBeDefined();
    expect(result.current.fillPath.value).toBeDefined();
    expect(result.current.thresholdFillPath.value).toBeDefined();
  });

  it("blends toward squiggly when morphT < 1", async () => {
    const { result } = await renderHook(() => {
      const morphT = useSharedValue(0.5);
      return useChartPaths(
        makeEngine({
          data: {
            value: [
              { time: 980, value: 1 },
              { time: 990, value: 1.5 },
              { time: 1000, value: 2 },
            ],
          },
        } as unknown as Partial<ChartPathsEngine>),
        DEFAULT_PADDING,
        morphT,
      );
    });
    expect(result.current.linePath.value).toBeDefined();
    expect(result.current.fillPath.value).toBeDefined();
  });

  it("simplifies the rendered path with a screen-space tolerance", async () => {
    const { result } = await renderHook(() =>
      useChartPaths(
        makeEngine({
          data: {
            value: [
              { time: 970, value: 1 },
              { time: 980, value: 1.001 },
              { time: 990, value: 0.999 },
              { time: 1000, value: 1 },
            ],
          },
        } as unknown as Partial<ChartPathsEngine>),
        DEFAULT_PADDING,
        undefined,
        undefined,
        false,
        undefined,
        undefined,
        undefined,
        1,
      ),
    );
    expect(result.current.linePath.value).toBeDefined();
    expect(result.current.fillPath.value).toBeDefined();
  });

  it("tips a live window at displayValue", () => {
    expect(resolveLineTipValue(9, 4, null)).toBe(9);
  });

  it("tips a historical window at edgeValue independently of indicator options", () => {
    // No badge.followViewEdge or hideLiveOnScrollBack input exists here:
    // presentation flags cannot change the plotted series geometry.
    expect(resolveLineTipValue(9, 4, 1_000)).toBe(4);
  });

  it("builds a historical line using the engine edge value", async () => {
    const { result } = await renderHook(() => {
      const edgeValue = useSharedValue(1.5);
      return useChartPaths(
        makeEngine({
          data: {
            value: [
              { time: 980, value: 1 },
              { time: 990, value: 1.5 },
              { time: 1000, value: 2 },
            ],
          },
          displayValue: { value: 999 },
          edgeValue,
          viewEnd: { value: 1_000 },
        } as unknown as Partial<ChartPathsEngine>),
        DEFAULT_PADDING,
      );
    });
    expect(result.current.linePath.value).toBeDefined();
    expect(result.current.fillPath.value).toBeDefined();
  });
});
