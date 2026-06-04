import { DEFAULT_PADDING } from "../../src/draw/line";
import type { EngineState } from "../../src/core/useLiveChartEngine";
import { renderHook } from "@testing-library/react-native";
import { useReferenceLine } from "../../src/hooks/useReferenceLine";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;

// padding: top=12, right=80, bottom=28, left=12 → chartH = 300-12-28 = 260
const PADDING = { top: 12, right: 80, bottom: 28, left: 12 };
const fmt = (v: number) => v.toFixed(2);

function engine(
  partial: Partial<{
    canvasWidth: number;
    canvasHeight: number;
    displayMin: number;
    displayMax: number;
  }> = {},
): EngineState {
  return {
    data: { value: [] },
    value: { value: 0 },
    displayValue: { value: 0 },
    displayMin: { value: partial.displayMin ?? 0 },
    displayMax: { value: partial.displayMax ?? 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: partial.canvasWidth ?? 400 },
    canvasHeight: { value: partial.canvasHeight ?? 300 },
    timestamp: { value: 0 },
  } as unknown as EngineState;
}

describe("useReferenceLine", () => {
  // ── invisible guard branches ───────────────────────────────────────────────

  it("returns invisible when referenceLine is undefined", () => {
    const { result } = renderHook(() =>
      useReferenceLine(engine(), PADDING, undefined, fmt, font),
    );
    expect(result.current.value.visible).toBe(false);
  });

  it("returns invisible when valRange is zero", () => {
    const { result } = renderHook(() =>
      useReferenceLine(
        engine({ displayMin: 50, displayMax: 50 }),
        PADDING,
        { value: 50 },
        fmt,
        font,
      ),
    );
    expect(result.current.value.visible).toBe(false);
  });

  it("returns invisible when canvas width is zero", () => {
    const { result } = renderHook(() =>
      useReferenceLine(
        engine({ canvasWidth: 0 }),
        PADDING,
        { value: 50 },
        fmt,
        font,
      ),
    );
    expect(result.current.value.visible).toBe(false);
  });

  it("returns invisible when canvas height is zero", () => {
    const { result } = renderHook(() =>
      useReferenceLine(
        engine({ canvasHeight: 0 }),
        PADDING,
        { value: 50 },
        fmt,
        font,
      ),
    );
    expect(result.current.value.visible).toBe(false);
  });

  it("returns invisible when ref value projects above the chart area", () => {
    // ref=110 > displayMax=100 → y < padding.top → clipped
    const { result } = renderHook(() =>
      useReferenceLine(engine(), PADDING, { value: 110 }, fmt, font),
    );
    expect(result.current.value.visible).toBe(false);
  });

  it("returns invisible when ref value projects below the chart area", () => {
    // ref=-10 < displayMin=0 → y > h - padding.bottom → clipped
    const { result } = renderHook(() =>
      useReferenceLine(engine(), PADDING, { value: -10 }, fmt, font),
    );
    expect(result.current.value.visible).toBe(false);
  });

  // ── visible happy-path ─────────────────────────────────────────────────────

  it("returns visible with correct y for a mid-range value", () => {
    // chartH = 300 - 12 - 28 = 260; ref=50, range=100
    // y = 12 + 260 * (1 - (50-0)/100) = 12 + 130 = 142
    const { result } = renderHook(() =>
      useReferenceLine(engine(), PADDING, { value: 50 }, fmt, font),
    );
    const layout = result.current.value;
    expect(layout.visible).toBe(true);
    expect(layout.y).toBeCloseTo(142);
  });

  it("sets x1 = padding.left and x2 = width - padding.right", () => {
    const { result } = renderHook(() =>
      useReferenceLine(engine(), PADDING, { value: 50 }, fmt, font),
    );
    const layout = result.current.value;
    expect(layout.x1).toBe(PADDING.left);
    expect(layout.x2).toBe(400 - PADDING.right);
  });

  it("uses the explicit label when provided", () => {
    const { result } = renderHook(() =>
      useReferenceLine(
        engine(),
        PADDING,
        { value: 50, label: "+5%" },
        fmt,
        font,
      ),
    );
    expect(result.current.value.label).toBe("+5%");
  });

  it("falls back to formatValue(ref.value) when no label is provided", () => {
    const { result } = renderHook(() =>
      useReferenceLine(engine(), PADDING, { value: 50 }, fmt, font),
    );
    expect(result.current.value.label).toBe("50.00");
  });

  it("uses DEFAULT_PADDING correctly", () => {
    const { result } = renderHook(() =>
      useReferenceLine(engine(), DEFAULT_PADDING, { value: 50 }, fmt, font),
    );
    expect(result.current.value.visible).toBe(true);
    expect(result.current.value.x1).toBe(DEFAULT_PADDING.left);
  });

  // ── Form B — value band ─────────────────────────────────────────────────────

  it("renders a value band with top above bottom", () => {
    const { result } = renderHook(() =>
      useReferenceLine(engine(), PADDING, { valueFrom: 20, valueTo: 60 }, fmt, font),
    );
    const l = result.current.value;
    expect(l.visible).toBe(true);
    expect(l.yBottom).toBeGreaterThan(l.y);
  });

  it("returns invisible for a value band fully outside the range", () => {
    const { result } = renderHook(() =>
      useReferenceLine(
        engine({ displayMin: 0, displayMax: 10 }),
        PADDING,
        { valueFrom: 50, valueTo: 80 },
        fmt,
        font,
      ),
    );
    expect(result.current.value.visible).toBe(false);
  });

  it("normalizes a reversed value band (valueFrom > valueTo)", () => {
    const { result } = renderHook(() =>
      useReferenceLine(engine(), PADDING, { valueFrom: 60, valueTo: 20 }, fmt, font),
    );
    const l = result.current.value;
    expect(l.visible).toBe(true);
    expect(l.yBottom).toBeGreaterThan(l.y);
  });

  it("clamps a value band that overflows both edges to the plot area", () => {
    const { result } = renderHook(() =>
      useReferenceLine(
        engine(),
        PADDING,
        { valueFrom: -50, valueTo: 150 },
        fmt,
        font,
      ),
    );
    const l = result.current.value;
    expect(l.visible).toBe(true);
    expect(l.y).toBe(PADDING.top);
    expect(l.yBottom).toBe(300 - PADDING.bottom);
  });

  it("returns invisible for a value band when the range is degenerate", () => {
    const { result } = renderHook(() =>
      useReferenceLine(
        engine({ displayMin: 50, displayMax: 50 }),
        PADDING,
        { valueFrom: 20, valueTo: 60 },
        fmt,
        font,
      ),
    );
    expect(result.current.value.visible).toBe(false);
  });

  // ── Form C — time band ──────────────────────────────────────────────────────

  it("renders a time band spanning part of the window", () => {
    // timestamp=0, window=30 → winStart=-30
    const { result } = renderHook(() =>
      useReferenceLine(engine(), PADDING, { from: -20, to: -5 }, fmt, font),
    );
    const l = result.current.value;
    expect(l.visible).toBe(true);
    expect(l.x2).toBeGreaterThan(l.x1);
  });

  it("returns invisible for a time band entirely before the window", () => {
    const { result } = renderHook(() =>
      useReferenceLine(engine(), PADDING, { from: -100, to: -60 }, fmt, font),
    );
    expect(result.current.value.visible).toBe(false);
  });

  it("normalizes a reversed time band and clamps to the chart edges", () => {
    // from later than to → swapped; spans beyond both window edges → clamped.
    const { result } = renderHook(() =>
      useReferenceLine(engine(), PADDING, { from: 50, to: -50 }, fmt, font),
    );
    const l = result.current.value;
    expect(l.visible).toBe(true);
    expect(l.x1).toBe(PADDING.left);
    expect(l.x2).toBe(400 - PADDING.right);
  });

  // ── Off-axis badge ──────────────────────────────────────────────────────────

  it("shows an off-axis badge with an up chevron when above the range", () => {
    const { result } = renderHook(() =>
      useReferenceLine(
        engine(),
        PADDING,
        { value: 150, offAxisBadge: true, offAxisBadgeLabel: "Target" },
        fmt,
        font,
      ),
    );
    const l = result.current.value;
    expect(l.visible).toBe(true);
    expect(l.offAxis).toBe(true);
    expect(l.chevronUp).toBe(true);
    expect(l.label).toContain("Target");
  });

  it("shows an off-axis badge with a down chevron when below the range", () => {
    const { result } = renderHook(() =>
      useReferenceLine(
        engine(),
        PADDING,
        { value: -50, offAxisBadge: true },
        fmt,
        font,
      ),
    );
    const l = result.current.value;
    expect(l.offAxis).toBe(true);
    expect(l.chevronUp).toBe(false);
  });

  // ── Label placement + showValue ─────────────────────────────────────────────

  it("appends the value when showValue and a label are set", () => {
    const { result } = renderHook(() =>
      useReferenceLine(
        engine(),
        PADDING,
        { value: 50, label: "Tgt", showValue: true },
        fmt,
        font,
      ),
    );
    expect(result.current.value.label).toBe("Tgt 50.00");
  });

  it("center-aligns the label when labelPosition is 'center'", () => {
    const { result } = renderHook(() =>
      useReferenceLine(
        engine(),
        PADDING,
        { value: 50, labelPosition: "center" },
        fmt,
        font,
      ),
    );
    // center is left of the right-gutter default (x2 + 4 = 324)
    expect(result.current.value.labelX).toBeLessThan(324);
  });
});
