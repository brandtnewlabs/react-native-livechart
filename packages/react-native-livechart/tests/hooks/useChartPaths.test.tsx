import { DEFAULT_PADDING } from "../../src/draw/line";
import type { SingleEngineState } from "../../src/core/useLiveChartEngine";
import { renderHook } from "@testing-library/react-native";
import { useChartPaths } from "../../src/hooks/useChartPaths";
import { useSharedValue } from "react-native-reanimated";
import { withSharedValueAccessors } from "../support/sharedValueMock";

function makeEngine(
  overrides: Partial<SingleEngineState> = {},
): SingleEngineState {
  const base = {
    data: { value: [{ time: 1000, value: 1 }] },
    value: { value: 1 },
    displayValue: { value: 1 },
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
  }) as unknown as SingleEngineState;
}

describe("useChartPaths", () => {
  it("returns paths for chart data", () => {
    const { result } = renderHook(() =>
      useChartPaths(makeEngine(), DEFAULT_PADDING),
    );
    expect(result.current.linePath.value).toBeDefined();
    expect(result.current.fillPath.value).toBeDefined();
  });

  it("handles too few points for spline", () => {
    const { result } = renderHook(() =>
      useChartPaths(
        makeEngine({
          data: { value: [{ time: 1000, value: 1 }] },
          displayMin: { value: 0 },
          displayMax: { value: 0 },
        } as unknown as Partial<SingleEngineState>),
        DEFAULT_PADDING,
      ),
    );
    expect(result.current.linePath.value).toBeDefined();
  });

  it("builds straight-polyline paths when linear, incl. the threshold band", () => {
    const { result } = renderHook(() => {
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
        } as unknown as Partial<SingleEngineState>),
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

  it("builds the threshold band from the shader samples (series threshold)", () => {
    const { result } = renderHook(() => {
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
        } as unknown as Partial<SingleEngineState>),
        DEFAULT_PADDING,
        undefined, // morphT
        undefined, // thresholdY (constant) — superseded by the samples below
        false, // linear
        undefined, // edgeValue
        false, // followViewEdge
        undefined, // squiggleAmplitude
        undefined, // squiggleSpeed
        thresholdSamples, // time-varying band bottom
      );
    });
    expect(result.current.thresholdFillPath.value).toBeDefined();
  });

  it("blends toward squiggly when morphT < 1", () => {
    const { result } = renderHook(() => {
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
        } as unknown as Partial<SingleEngineState>),
        DEFAULT_PADDING,
        morphT,
      );
    });
    expect(result.current.linePath.value).toBeDefined();
    expect(result.current.fillPath.value).toBeDefined();
  });

  it("tips the line at edgeValue when followViewEdge is on (time-scroll)", () => {
    // While scrolled back, the right-edge tip should use the view-edge price
    // (edgeValue), not the live displayValue — so the line doesn't drop to the
    // off-screen live value.
    const { result } = renderHook(() => {
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
        } as unknown as Partial<SingleEngineState>),
        DEFAULT_PADDING,
        undefined,
        undefined,
        false,
        edgeValue,
        true, // followViewEdge → tip uses edgeValue
      );
    });
    expect(result.current.linePath.value).toBeDefined();
    expect(result.current.fillPath.value).toBeDefined();
  });
});
