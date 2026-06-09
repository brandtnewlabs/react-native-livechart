import { renderHook } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { resolveSegment } from "../../src/core/resolveSegment";
import { useSegmentLineGradient } from "../../src/hooks/useSegmentLineGradient";

const PADDING = { top: 12, right: 10, bottom: 28, left: 10 };
const DEFAULTS = { muted: "#9aa0a6", divider: "#5b5b5b", label: "#cccccc" };

function engine(
  partial: Partial<{ canvasWidth: number }> = {},
): ChartEngineLayout {
  return {
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: partial.canvasWidth ?? 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 130 }, // window [100, 130]
  } as unknown as ChartEngineLayout;
}

const scrub = (x: number, active: boolean) => ({
  scrubX: { value: x } as unknown as SharedValue<number>,
  scrubActive: { value: active } as unknown as SharedValue<boolean>,
});

describe("useSegmentLineGradient", () => {
  const BASE = "#0000ff";

  it("de-emphasizes a segment with base + dim stops while scrubbing outside it", () => {
    // Segment ≈ px[137, 263]; scrub at 50 is left of it → segment is dimmed.
    const { scrubX, scrubActive } = scrub(50, true);
    const { result } = renderHook(() =>
      useSegmentLineGradient(
        engine(),
        [resolveSegment({ from: 110, to: 120, mutedColor: "#abc" }, DEFAULTS)],
        PADDING,
        BASE,
        scrubX,
        scrubActive,
      ),
    );
    expect(result.current.colors.value).toContain("#abc");
    expect(result.current.colors.value).toContain(BASE);
    expect(result.current.positions.value.length).toBe(
      result.current.colors.value.length,
    );
    expect(result.current.gradientEnd.value.x).toBe(400);
  });

  it("falls back to a flat base-color gradient at rest", () => {
    const { scrubX, scrubActive } = scrub(-1, false);
    const { result } = renderHook(() =>
      useSegmentLineGradient(
        engine(),
        [resolveSegment({ from: 110, to: 120 }, DEFAULTS)],
        PADDING,
        BASE,
        scrubX,
        scrubActive,
      ),
    );
    expect(result.current.colors.value).toEqual([BASE, BASE]);
    expect(result.current.positions.value).toEqual([0, 1]);
  });

  it("keeps the gradient end at least 1px wide before layout", () => {
    const { scrubX, scrubActive } = scrub(50, true);
    const { result } = renderHook(() =>
      useSegmentLineGradient(
        engine({ canvasWidth: 0 }),
        [resolveSegment({ from: 110, to: 120 }, DEFAULTS)],
        PADDING,
        BASE,
        scrubX,
        scrubActive,
      ),
    );
    expect(result.current.gradientEnd.value.x).toBe(1);
  });
});
