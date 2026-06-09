import { renderHook } from "@testing-library/react-native";

import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { resolveSegment } from "../../src/core/resolveSegment";
import { useSegmentDivider } from "../../src/hooks/useSegmentDivider";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;

// padding left=10, right=10 → plot [10, 390] at width 400; window [100,130].
const PADDING = { top: 12, right: 10, bottom: 28, left: 10 };
const DEFAULTS = { muted: "#9aa0a6", divider: "#5b5b5b", label: "#cccccc" };

function engine(
  partial: Partial<{ canvasWidth: number; canvasHeight: number }> = {},
): ChartEngineLayout {
  return {
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: partial.canvasWidth ?? 400 },
    canvasHeight: { value: partial.canvasHeight ?? 300 },
    timestamp: { value: 130 },
  } as unknown as ChartEngineLayout;
}

describe("useSegmentDivider", () => {
  it("is invisible when the canvas is not laid out", () => {
    const { result } = renderHook(() =>
      useSegmentDivider(
        engine({ canvasWidth: 0 }),
        PADDING,
        resolveSegment({ from: 110, to: 120 }, DEFAULTS),
        font,
      ),
    );
    expect(result.current.value.visible).toBe(false);
  });

  it("is invisible for an off-screen range", () => {
    const { result } = renderHook(() =>
      useSegmentDivider(
        engine(),
        PADDING,
        resolveSegment({ from: 50, to: 70 }, DEFAULTS),
        font,
      ),
    );
    expect(result.current.value.visible).toBe(false);
  });

  it("projects a visible segment with plot top/bottom edges", () => {
    const { result } = renderHook(() =>
      useSegmentDivider(
        engine(),
        PADDING,
        resolveSegment({ from: 110, to: 120 }, DEFAULTS),
        font,
      ),
    );
    const l = result.current.value;
    expect(l.visible).toBe(true);
    expect(l.x2).toBeGreaterThan(l.x1);
    expect(l.yTop).toBe(PADDING.top);
    expect(l.yBottom).toBe(300 - PADDING.bottom);
  });

  it("anchors a right-positioned label inside the segment", () => {
    const { result } = renderHook(() =>
      useSegmentDivider(
        engine(),
        PADDING,
        resolveSegment(
          { from: 110, to: 120, label: "AH", labelPosition: "right" },
          DEFAULTS,
        ),
        font,
      ),
    );
    const l = result.current.value;
    expect(l.label).toBe("AH");
    // right anchor: label sits left of the segment's right edge.
    expect(l.labelX).toBeLessThan(l.x2);
  });
});
