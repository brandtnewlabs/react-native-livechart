import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import { useLiveChartEngine } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { useMarkers } from "../../src/hooks/useMarkers";
import type { Marker } from "../../src/types";

function useMakeEngine() {
  const data = useSharedValue([{ time: 1_700_000_000, value: 50 }]);
  const value = useSharedValue(50);
  return useLiveChartEngine({ data, value, timeWindow: 100, smoothing: 0.08 });
}

describe("useMarkers", () => {
  it("returns a projected buffer and a tap gesture when active", () => {
    const { result } = renderHook(() => {
      const engine = useMakeEngine();
      const markers = useSharedValue<Marker[]>([
        { id: "a", time: 1_700_000_000, kind: "trade", value: 50 },
      ]);
      return useMarkers(engine, DEFAULT_PADDING, markers, true, 16, jest.fn());
    });
    expect(result.current.projected).toBeDefined();
    expect(result.current.tapGesture).toBeDefined();
  });

  it("works when inactive and without an onMarkerPress callback", () => {
    const { result } = renderHook(() => {
      const engine = useMakeEngine();
      const markers = useSharedValue<Marker[]>([]);
      return useMarkers(engine, DEFAULT_PADDING, markers, false, 16);
    });
    expect(result.current.projected.value).toEqual([]);
  });

  it("accepts a stacked cluster config and exposes a hit-test", () => {
    const { result } = renderHook(() => {
      const engine = useMakeEngine();
      const markers = useSharedValue<Marker[]>([
        { id: "a", time: 1_700_000_000, kind: "trade", value: 50, side: "above" },
        { id: "b", time: 1_700_000_000, kind: "trade", value: 50, side: "above" },
      ]);
      return useMarkers(
        engine,
        DEFAULT_PADDING,
        markers,
        true,
        16,
        jest.fn(),
        undefined,
        undefined,
        true,
        false,
        { mode: "stacked", overlap: 0.6, gap: 2, maxBeforeGroup: 5 },
      );
    });
    expect(typeof result.current.hitTest).toBe("function");
  });
});
