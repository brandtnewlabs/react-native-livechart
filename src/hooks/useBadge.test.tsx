import { BADGE_DOT_GAP, BADGE_PILL_PAD_X } from "../constants";
import { DEFAULT_PADDING, badgeTailAndCap, pillTextLeftX } from "../draw/line";

import type { SkFont } from "@shopify/react-native-skia";
import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";
import { measureFontTextWidth } from "../measureFontTextWidth";
import { resolveTheme } from "../theme";
import type { EngineState } from "../useLiveChartEngine";
import { useBadge } from "./useBadge";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({
    x: 0,
    y: 0,
    width: s.length * 7,
    height: 12,
  }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as unknown as SkFont;

function makeEngine(w: number, h: number): EngineState {
  return {
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 50 },
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: w },
    canvasHeight: { value: h },
    timestamp: { value: 1000 },
  } as unknown as EngineState;
}

describe("useBadge", () => {
  const palette = resolveTheme("#3b82f6", "dark");

  it("returns empty path when canvas not laid out", () => {
    const { result } = renderHook(() =>
      useBadge(
        makeEngine(0, 0),
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
      ),
    );
    expect(result.current.value.text).toBe("");
  });

  it("builds badge with tail for default variant", () => {
    const { result } = renderHook(() =>
      useBadge(
        makeEngine(400, 300),
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
      ),
    );
    expect(result.current.value.text).toBeTruthy();
  });

  it("badge text matches pillTextLeftX — same horizontal position as y-axis labels", () => {
    const w = 400;
    // minPaddingRightForBadgeYAxisAlign(12, 35) = 8 + 14 + 20 + 35 + 4 = 81
    const pad = { ...DEFAULT_PADDING, right: 81 };
    const { result } = renderHook(() =>
      useBadge(
        makeEngine(w, 300),
        pad,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
      ),
    );
    const textW = measureFontTextWidth(font, "50.00");
    const tl = badgeTailAndCap(font.getSize());
    expect(result.current.value.textX).toBeCloseTo(
      pillTextLeftX(w, pad.right, BADGE_DOT_GAP + tl, textW),
      4,
    );
  });

  it("still lays out badge with a custom right padding override", () => {
    const pad = { ...DEFAULT_PADDING, right: 81 };
    const { result } = renderHook(() =>
      useBadge(
        makeEngine(400, 300),
        pad,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
      ),
    );
    expect(result.current.value.text).toBe("50.00");
    expect(Number.isFinite(result.current.value.textX)).toBe(true);
  });

  it("uses minimal colors and no tail", () => {
    const { result } = renderHook(() =>
      useBadge(
        makeEngine(400, 300),
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "minimal",
        false,
      ),
    );
    expect(result.current.value.bgColor).toContain("255");
  });

  it("no-tail pill uses minimal variant colors", () => {
    const pad = { ...DEFAULT_PADDING, right: 81 };
    const { result } = renderHook(() =>
      useBadge(
        makeEngine(400, 300),
        pad,
        palette,
        (v) => v.toFixed(2),
        font,
        "minimal",
        false,
      ),
    );
    expect(result.current.value.text).toBe("50.00");
  });

  it("centers badge vertically when value range is zero", () => {
    const eng = {
      ...makeEngine(400, 300),
      displayMin: { value: 5 },
      displayMax: { value: 5 },
      displayValue: { value: 5 },
    } as unknown as EngineState;
    const { result } = renderHook(() =>
      useBadge(eng, DEFAULT_PADDING, palette, (v) => v.toFixed(2), font),
    );
    expect(result.current.value.text).toBeTruthy();
  });

  it("lerps badge background when momentum shared value is provided", () => {
    const eng = makeEngine(400, 300);
    const { result } = renderHook(() => {
      const momentum = useSharedValue<"up" | "down" | "flat">("up");
      return useBadge(
        eng,
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
        momentum,
      );
    });
    expect(result.current.value.bgColor.startsWith("rgb")).toBe(true);
  });

  it("lerps toward down momentum target", () => {
    const eng = makeEngine(400, 300);
    const { result } = renderHook(() => {
      const momentum = useSharedValue<"up" | "down" | "flat">("down");
      return useBadge(
        eng,
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
        momentum,
      );
    });
    expect(result.current.value.bgColor.startsWith("rgb")).toBe(true);
  });

  it("lerps toward flat momentum target", () => {
    const eng = makeEngine(400, 300);
    const { result } = renderHook(() => {
      const momentum = useSharedValue<"up" | "down" | "flat">("flat");
      return useBadge(
        eng,
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
        momentum,
      );
    });
    expect(result.current.value.bgColor.startsWith("rgb")).toBe(true);
  });

  it("left-position badge is a pill only (ignores showTail)", () => {
    const w = 400;
    const pad = { top: 12, right: 64, bottom: 28, left: 12 };
    const eng = makeEngine(w, 300);
    const { result } = renderHook(() =>
      useBadge(
        eng,
        pad,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
        undefined,
        "left",
      ),
    );
    const dotX = w - pad.right;
    const text = "50.00";
    const textW = measureFontTextWidth(font, text);
    const pillW = 2 * BADGE_PILL_PAD_X + textW;
    const bodyRight = dotX - BADGE_DOT_GAP;
    const bodyLeft = bodyRight - pillW;
    expect(result.current.value.text).toBe(text);
    expect(result.current.value.textX).toBeCloseTo(
      (bodyLeft + bodyRight - textW) / 2,
      4,
    );
    expect(result.current.value.path).toBeDefined();
  });

  it("no-tail right-position badge uses reduced offset for text alignment", () => {
    const w = 400;
    const pad = { ...DEFAULT_PADDING, right: 76 };
    const { result } = renderHook(() =>
      useBadge(
        makeEngine(w, 300),
        pad,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        false,
      ),
    );
    const textW = measureFontTextWidth(font, "50.00");
    const tl = badgeTailAndCap(font.getSize(), false);
    expect(result.current.value.textX).toBeCloseTo(
      pillTextLeftX(w, pad.right, BADGE_DOT_GAP + tl, textW),
      4,
    );
  });

  it("uses fixed background color when background override is provided", () => {
    const eng = makeEngine(400, 300);
    const { result } = renderHook(() =>
      useBadge(
        eng,
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
        undefined,
        "right",
        "#ff0000",
      ),
    );
    expect(result.current.value.bgColor).toBe("#ff0000");
  });
});
