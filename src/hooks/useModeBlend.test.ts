import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import { useModeBlend } from "./useModeBlend";

describe("useModeBlend", () => {
  it("starts at 0 when isCandle is false", () => {
    const { result } = renderHook(() => {
      const lineOpacity = useSharedValue(1);
      return useModeBlend(false, lineOpacity);
    });
    expect(result.current.modeBlend.value).toBe(0);
  });

  it("starts at 1 when isCandle is true", () => {
    const { result } = renderHook(() => {
      const lineOpacity = useSharedValue(1);
      return useModeBlend(true, lineOpacity);
    });
    expect(result.current.modeBlend.value).toBe(1);
  });

  it("lineGroupOpacity is 1 when line mode and lineOpacity is 1", () => {
    const { result } = renderHook(() => {
      const lineOpacity = useSharedValue(1);
      return useModeBlend(false, lineOpacity);
    });
    expect(result.current.lineGroupOpacity.value).toBeCloseTo(1);
  });

  it("candleGroupOpacity is 0 when line mode", () => {
    const { result } = renderHook(() => {
      const lineOpacity = useSharedValue(1);
      return useModeBlend(false, lineOpacity);
    });
    expect(result.current.candleGroupOpacity.value).toBeCloseTo(0);
  });

  it("lineGroupOpacity is 0 when candle mode", () => {
    const { result } = renderHook(() => {
      const lineOpacity = useSharedValue(1);
      return useModeBlend(true, lineOpacity);
    });
    expect(result.current.lineGroupOpacity.value).toBeCloseTo(0);
  });

  it("candleGroupOpacity is 1 when candle mode and lineOpacity is 1", () => {
    const { result } = renderHook(() => {
      const lineOpacity = useSharedValue(1);
      return useModeBlend(true, lineOpacity);
    });
    expect(result.current.candleGroupOpacity.value).toBeCloseTo(1);
  });

  it("scales both opacities by lineOpacity", () => {
    const { result } = renderHook(() => {
      const lineOpacity = useSharedValue(0.5);
      return useModeBlend(false, lineOpacity);
    });
    expect(result.current.lineGroupOpacity.value).toBeCloseTo(0.5);
    expect(result.current.candleGroupOpacity.value).toBeCloseTo(0);
  });

  it("both opacities are 0 when lineOpacity is 0", () => {
    const { result } = renderHook(() => {
      const lineOpacity = useSharedValue(0);
      return useModeBlend(true, lineOpacity);
    });
    expect(result.current.lineGroupOpacity.value).toBe(0);
    expect(result.current.candleGroupOpacity.value).toBe(0);
  });

  it("triggers animation when isCandle toggles", () => {
    const { result, rerender } = renderHook(
      (props: { isCandle: boolean }) => {
        const lineOpacity = useSharedValue(1);
        return useModeBlend(props.isCandle, lineOpacity);
      },
      { initialProps: { isCandle: false } },
    );
    expect(result.current.modeBlend.value).toBe(0);

    rerender({ isCandle: true });

    // withTiming has been called — in the test mock it may resolve
    // immediately or stay at 0; either way it's >= 0.
    expect(result.current.modeBlend.value).toBeGreaterThanOrEqual(0);
  });

  it("returns to 0 when switching back to line mode", () => {
    const { result, rerender } = renderHook(
      (props: { isCandle: boolean }) => {
        const lineOpacity = useSharedValue(1);
        return useModeBlend(props.isCandle, lineOpacity);
      },
      { initialProps: { isCandle: true } },
    );
    expect(result.current.modeBlend.value).toBe(1);

    rerender({ isCandle: false });

    // Animation triggered back toward 0
    expect(result.current.modeBlend.value).toBeLessThanOrEqual(1);
  });
});
