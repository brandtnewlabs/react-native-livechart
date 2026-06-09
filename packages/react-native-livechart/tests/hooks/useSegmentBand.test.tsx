import { renderHook } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { resolveSegment } from "../../src/core/resolveSegment";
import { useSegmentBand } from "../../src/hooks/useSegmentBand";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;

// padding left=10, right=10 → plot [10, 390] at width 400; window [100,130].
const PADDING = { top: 12, right: 10, bottom: 28, left: 10 };

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

const scrub = (x: number, active: boolean) =>
  ({
    scrubX: { value: x } as unknown as SharedValue<number>,
    scrubActive: { value: active } as unknown as SharedValue<boolean>,
  });

describe("useSegmentBand", () => {
  it("is invisible when the canvas is not laid out", () => {
    const { scrubX, scrubActive } = scrub(-1, false);
    const { result } = renderHook(() =>
      useSegmentBand(
        engine({ canvasWidth: 0 }),
        PADDING,
        resolveSegment({ from: 110, to: 120 }, "#fff"),
        scrubX,
        scrubActive,
        font,
      ),
    );
    expect(result.current.value.visible).toBe(false);
  });

  it("is invisible for an off-screen range", () => {
    const { scrubX, scrubActive } = scrub(-1, false);
    const { result } = renderHook(() =>
      useSegmentBand(
        engine(),
        PADDING,
        resolveSegment({ from: 50, to: 70 }, "#fff"),
        scrubX,
        scrubActive,
        font,
      ),
    );
    expect(result.current.value.visible).toBe(false);
  });

  it("projects a visible band with plot top/bottom edges", () => {
    const { scrubX, scrubActive } = scrub(-1, false);
    const { result } = renderHook(() =>
      useSegmentBand(
        engine(),
        PADDING,
        resolveSegment({ from: 110, to: 120 }, "#fff"),
        scrubX,
        scrubActive,
        font,
      ),
    );
    const l = result.current.value;
    expect(l.visible).toBe(true);
    expect(l.x2).toBeGreaterThan(l.x1);
    expect(l.yTop).toBe(PADDING.top);
    expect(l.yBottom).toBe(300 - PADDING.bottom);
    expect(l.highlighted).toBe(false);
  });

  it("highlights while scrubbing inside the band", () => {
    const { scrubX, scrubActive } = scrub(250, true);
    const { result } = renderHook(() =>
      useSegmentBand(
        engine(),
        PADDING,
        resolveSegment({ from: 110, to: 125 }, "#fff"),
        scrubX,
        scrubActive,
        font,
      ),
    );
    expect(result.current.value.highlighted).toBe(true);
  });

  it("highlights when active even without scrubbing", () => {
    const { scrubX, scrubActive } = scrub(-1, false);
    const { result } = renderHook(() =>
      useSegmentBand(
        engine(),
        PADDING,
        resolveSegment({ from: 110, to: 120, active: true }, "#fff"),
        scrubX,
        scrubActive,
        font,
      ),
    );
    expect(result.current.value.highlighted).toBe(true);
  });

  it("anchors a right-positioned label inside the band", () => {
    const { scrubX, scrubActive } = scrub(-1, false);
    const { result } = renderHook(() =>
      useSegmentBand(
        engine(),
        PADDING,
        resolveSegment(
          { from: 110, to: 120, label: "AH", labelPosition: "right" },
          "#fff",
        ),
        scrubX,
        scrubActive,
        font,
      ),
    );
    const l = result.current.value;
    expect(l.label).toBe("AH");
    // right anchor: label sits left of the band's right edge.
    expect(l.labelX).toBeLessThan(l.x2);
  });
});
