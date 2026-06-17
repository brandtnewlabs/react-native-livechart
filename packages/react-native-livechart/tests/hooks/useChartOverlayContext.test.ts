import { renderHook } from "@testing-library/react-native";

import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import {
  useChartOverlayContext,
  usePriceY,
  useTimeX,
} from "../../src/hooks/useChartOverlayContext";
import { withSharedValueAccessors } from "../support/sharedValueMock";

// padding: top=12, right=80, bottom=28, left=12 → plot right=320, bottom=272,
// chartH=260. Window 30s ending at timestamp 0.
const PADDING = { top: 12, right: 80, bottom: 28, left: 12 };

function engine(
  partial: Partial<{
    canvasWidth: number;
    canvasHeight: number;
    displayMin: number;
    displayMax: number;
    timestamp: number;
    displayWindow: number;
  }> = {},
): ChartEngineLayout {
  // Bare `{ value }` doubles + `.get()/.set()` so the hook's `.get()` reads work.
  return withSharedValueAccessors({
    displayMin: { value: partial.displayMin ?? 0 },
    displayMax: { value: partial.displayMax ?? 100 },
    displayWindow: { value: partial.displayWindow ?? 30 },
    timeWindow: { value: partial.displayWindow ?? 30 },
    canvasWidth: { value: partial.canvasWidth ?? 400 },
    canvasHeight: { value: partial.canvasHeight ?? 300 },
    timestamp: { value: partial.timestamp ?? 0 },
  }) as unknown as ChartEngineLayout;
}

describe("useChartOverlayContext", () => {
  it("derives the live scale snapshot from the engine + padding", () => {
    const { result } = renderHook(() =>
      useChartOverlayContext(engine(), PADDING),
    );
    const s = result.current.scale.get();
    expect(s).toEqual({
      min: 0,
      max: 100,
      window: 30,
      now: 0,
      plot: { left: 12, top: 12, right: 320, bottom: 272, width: 400, height: 300 },
    });
  });

  it("exposes mapping worklets that project against a scale snapshot", () => {
    const { result } = renderHook(() =>
      useChartOverlayContext(engine(), PADDING),
    );
    const { priceToY, yToPrice, timeToX, xToTime, scale } = result.current;
    const s = scale.get();
    // max → plot top, min → plot bottom.
    expect(priceToY(100, s)).toBeCloseTo(12);
    expect(priceToY(0, s)).toBeCloseTo(272);
    expect(yToPrice(priceToY(50, s), s)).toBeCloseTo(50);
    // right plot edge is "now" (timestamp 0); left edge is the window start.
    expect(timeToX(0, s)).toBeCloseTo(320);
    expect(xToTime(320, s)).toBeCloseTo(0);
  });

  it("tracks engine changes through the scale snapshot", () => {
    const eng = engine({ displayMin: 20, displayMax: 120, timestamp: 1000 });
    const { result } = renderHook(() => useChartOverlayContext(eng, PADDING));
    const s = result.current.scale.get();
    expect(s.min).toBe(20);
    expect(s.max).toBe(120);
    expect(s.now).toBe(1000);
  });

  it("returns a stable context identity across re-renders", () => {
    const eng = engine();
    const { result, rerender } = renderHook(() =>
      useChartOverlayContext(eng, PADDING),
    );
    const first = result.current;
    rerender({});
    expect(result.current).toBe(first);
  });
});

describe("usePriceY / useTimeX", () => {
  it("usePriceY projects a price to its live canvas Y", () => {
    const { result } = renderHook(() => {
      const ctx = useChartOverlayContext(engine(), PADDING);
      return usePriceY(ctx, 50);
    });
    // mid of a 0..100 range over a 260px plot starting at top=12 → 142.
    expect(result.current.get()).toBeCloseTo(142);
  });

  it("useTimeX projects a timestamp to its live canvas X", () => {
    const { result } = renderHook(() => {
      const ctx = useChartOverlayContext(engine(), PADDING);
      return useTimeX(ctx, 0);
    });
    // now=0 sits at the right plot edge (canvasWidth 400 - right 80 = 320).
    expect(result.current.get()).toBeCloseTo(320);
  });
});
