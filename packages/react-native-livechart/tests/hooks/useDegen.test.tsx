import { useSharedValue } from "react-native-reanimated";

import { renderHook } from "@testing-library/react-native";

import { resolveDegen } from "../../src/core/resolveConfig";
import { useLiveChartEngine } from "../../src/core/useLiveChartEngine";
import { useDegen } from "../../src/hooks/useDegen";

function useMakeEngine() {
  const data = useSharedValue([{ time: 1_700_000_000, value: 50 }]);
  const value = useSharedValue(50);
  return useLiveChartEngine({ data, value, timeWindow: 100, smoothing: 0.08 });
}

describe("useDegen", () => {
  it("returns pack and shake shared values", () => {
    const { result } = renderHook(() => {
      const engine = useMakeEngine();
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(80);
      const momentum = useSharedValue<"flat" | "up" | "down">("flat");
      return useDegen(engine, dotX, dotY, momentum, resolveDegen(true));
    });

    expect(result.current.pack).toBeDefined();
    expect(result.current.pack.value).toBeInstanceOf(Float64Array);
    expect(result.current.shakeTransform).toBeDefined();
  });

  it("returns zeroed pack when cfg is null", () => {
    const { result } = renderHook(() => {
      const engine = useMakeEngine();
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(80);
      const momentum = useSharedValue<"flat" | "up" | "down">("flat");
      return useDegen(engine, dotX, dotY, momentum, null);
    });

    expect(result.current.pack.value).toBeInstanceOf(Float64Array);
  });

  it("accepts shake: false config", () => {
    const { result } = renderHook(() => {
      const engine = useMakeEngine();
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(80);
      const momentum = useSharedValue<"flat" | "up" | "down">("flat");
      return useDegen(
        engine,
        dotX,
        dotY,
        momentum,
        resolveDegen({ shake: false }),
      );
    });

    expect(result.current.shakeTransform).toBeDefined();
  });

  it("accepts downMomentum: true config", () => {
    const { result } = renderHook(() => {
      const engine = useMakeEngine();
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(80);
      const momentum = useSharedValue<"flat" | "up" | "down">("flat");
      return useDegen(
        engine,
        dotX,
        dotY,
        momentum,
        resolveDegen({ downMomentum: true }),
      );
    });

    expect(result.current.pack).toBeDefined();
  });

  it("accepts optional onShake callback", () => {
    const onShake = jest.fn();
    const { result } = renderHook(() => {
      const engine = useMakeEngine();
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(80);
      const momentum = useSharedValue<"flat" | "up" | "down">("flat");
      return useDegen(
        engine,
        dotX,
        dotY,
        momentum,
        resolveDegen(true),
        onShake,
      );
    });

    expect(result.current.shakeTransform).toBeDefined();
  });
});
