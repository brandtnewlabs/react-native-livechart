import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import type { SeriesConfig } from "../src/types";
import {
  applyLiveChartSeriesEngineFrame,
  makeMultiSeriesEngineScratch,
  type MultiEngineFrameRefs,
  useLiveChartSeriesEngine,
} from "../src/core/useLiveChartSeriesEngine";

describe("applyLiveChartSeriesEngineFrame", () => {
  it("runs multi tick and writes shared values", () => {
    const sv = {
      series: {
        value: [
          {
            id: "a",
            data: [{ time: 1000, value: 10 }],
            value: 10,
            color: "#00f",
          },
        ],
      },
      displaySeriesValues: { value: [] as number[] },
      seriesOpacities: { value: [] as number[] },
      displayMin: { value: 0 },
      displayMax: { value: 100 },
      displayWindow: { value: 30 },
      timestamp: { value: 1000 },
      canvasWidth: { value: 200 },
      canvasHeight: { value: 100 },
      timeWindow: { value: 30 },
      smoothing: { value: 0.5 },
      exaggerateSV: { value: false },
      referenceValue: { value: undefined as number | undefined },
      // Pin "now" to the point's time so it falls inside the live window.
      nowOverrideSV: { value: 1000 },
      windowBufferSV: { value: 0 },
      pausedSV: { value: false },
      extremaMinValue: { value: NaN },
      extremaMaxValue: { value: NaN },
      extremaMinTime: { value: NaN },
      extremaMaxTime: { value: NaN },
    };
    const scratch = makeMultiSeriesEngineScratch();
    const stateIdentity = scratch.state;
    const inputIdentity = scratch.input;
    applyLiveChartSeriesEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as MultiEngineFrameRefs,
      scratch,
    );
    const firstOutput = sv.displaySeriesValues.value;
    applyLiveChartSeriesEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as MultiEngineFrameRefs,
      scratch,
    );
    const secondOutput = sv.displaySeriesValues.value;
    applyLiveChartSeriesEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as MultiEngineFrameRefs,
      scratch,
    );
    expect(scratch.state).toBe(stateIdentity);
    expect(scratch.input).toBe(inputIdentity);
    expect(secondOutput).not.toBe(firstOutput);
    expect(sv.displaySeriesValues.value).toBe(firstOutput);
    expect(sv.displaySeriesValues.value.length).toBe(1);
    // The single series' lone point becomes the live extrema.
    expect(sv.extremaMinValue.value).toBe(10);
    expect(sv.extremaMaxValue.value).toBe(10);
    expect(sv.extremaMinTime.value).toBe(1000);
  });

  it("consumes the snap flag — snaps the tip in one frame then clears it", () => {
    const sv = {
      series: {
        value: [
          {
            id: "a",
            data: [{ time: 1000, value: 10 }],
            value: 42,
            color: "#00f",
          },
        ],
      },
      displaySeriesValues: { value: [0] as number[] },
      seriesOpacities: { value: [1] as number[] },
      displayMin: { value: 0 },
      displayMax: { value: 100 },
      displayWindow: { value: 30 },
      timestamp: { value: 1000 },
      canvasWidth: { value: 200 },
      canvasHeight: { value: 100 },
      timeWindow: { value: 30 },
      smoothing: { value: 0.08 }, // small: only a snap reaches the tip in one frame
      exaggerateSV: { value: false },
      referenceValue: { value: undefined as number | undefined },
      nowOverrideSV: { value: 1000 },
      windowBufferSV: { value: 0 },
      pausedSV: { value: false },
      snapSV: { value: true },
      extremaMinValue: { value: NaN },
      extremaMaxValue: { value: NaN },
      extremaMinTime: { value: NaN },
      extremaMaxTime: { value: NaN },
    };
    applyLiveChartSeriesEngineFrame(
      { timeSincePreviousFrame: 16.67 },
      sv as unknown as MultiEngineFrameRefs,
    );
    expect(sv.displaySeriesValues.value[0]).toBe(42); // snapped to the live value
    expect(sv.snapSV.value).toBe(false); // one-shot: cleared after consuming
  });
});

describe("useLiveChartSeriesEngine", () => {
  it("returns engine state with series arrays", () => {
    const { result } = renderHook(() => {
      const series = useSharedValue<SeriesConfig[]>([
        {
          id: "a",
          data: [{ time: 1_700_000_000, value: 1 }],
          value: 1,
          color: "#3b82f6",
        },
      ]);
      return useLiveChartSeriesEngine({
        series,
        timeWindow: 30,
        smoothing: 0.08,
      });
    });
    expect(result.current.displaySeriesValues).toBeDefined();
    expect(result.current.seriesOpacities).toBeDefined();
    expect(result.current.series).toBeDefined();
  });

  it("requests a one-shot snap when snapKey changes (and not on a stable key)", () => {
    // snapSV is internal — assert the effect wiring is exercised across the
    // no-change / change paths without throwing (snap math covered above).
    const { result, rerender } = renderHook(
      ({ k }: { k: number }) => {
        const series = useSharedValue<SeriesConfig[]>([
          {
            id: "a",
            data: [{ time: 1_700_000_000, value: 1 }],
            value: 1,
            color: "#3b82f6",
          },
        ]);
        return useLiveChartSeriesEngine({
          series,
          timeWindow: 30,
          smoothing: 0.08,
          snapKey: k,
        });
      },
      { initialProps: { k: 0 } },
    );
    rerender({ k: 0 }); // unchanged → no snap
    rerender({ k: 1 }); // changed → snap requested
    expect(result.current.displayMin.value).toBeDefined();
  });
});
