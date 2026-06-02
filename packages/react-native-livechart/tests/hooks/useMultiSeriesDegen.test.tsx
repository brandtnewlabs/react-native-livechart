import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";

import { resolveDegen } from "../../src/core/resolveConfig";
import { useLiveChartSeriesEngine } from "../../src/core/useLiveChartSeriesEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { useMultiSeriesDegen } from "../../src/hooks/useMultiSeriesDegen";
import type { SeriesConfig } from "../../src/types";

function useMakeEngine() {
  const series = useSharedValue<SeriesConfig[]>([
    {
      id: "a",
      data: [{ time: 1_700_000_000, value: 50 }],
      value: 50,
      color: "#3b82f6",
    },
  ]);
  return useLiveChartSeriesEngine({ series, timeWindow: 100, smoothing: 0.08 });
}

describe("useMultiSeriesDegen", () => {
  it("returns pack / packRevision / shakeTransform when enabled", () => {
    const { result } = renderHook(() => {
      const engine = useMakeEngine();
      return useMultiSeriesDegen(engine, DEFAULT_PADDING, resolveDegen(true));
    });
    expect(result.current.pack.value).toBeInstanceOf(Float64Array);
    expect(result.current.packRevision).toBeDefined();
    expect(result.current.shakeTransform).toBeDefined();
  });

  it("returns a pack when cfg is null (disabled)", () => {
    const { result } = renderHook(() => {
      const engine = useMakeEngine();
      return useMultiSeriesDegen(engine, DEFAULT_PADDING, null);
    });
    expect(result.current.pack.value).toBeInstanceOf(Float64Array);
  });

  it("accepts shake:false, downMomentum:true and an onShake callback", () => {
    const onShake = jest.fn();
    const { result } = renderHook(() => {
      const engine = useMakeEngine();
      return useMultiSeriesDegen(
        engine,
        DEFAULT_PADDING,
        resolveDegen({ shake: false, downMomentum: true }),
        onShake,
      );
    });
    expect(result.current.shakeTransform).toBeDefined();
  });
});
