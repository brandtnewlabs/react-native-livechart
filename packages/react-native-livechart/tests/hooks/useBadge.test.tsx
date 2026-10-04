import { BADGE_DOT_GAP, BADGE_PILL_PAD_X } from "../../src/constants";
import {
  rightAnchoredYAxisColumnLayout,
  type YAxisEntry,
} from "../../src/draw/grid";
import { DEFAULT_PADDING, badgeTailAndCap, pillTextLeftX } from "../../src/draw/line";

import type { SkFont } from "@shopify/react-native-skia";
import { render, renderHook } from "@testing-library/react-native";
import { View } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { measureFontTextWidth } from "../../src/lib/measureFontTextWidth";
import { resolveTheme } from "../../src/theme";
import type { EngineState } from "../../src/core/useLiveChartEngine";
import { YAxisOverlay } from "../../src/components/YAxisOverlay";
import { useBadge } from "../../src/hooks/useBadge";
import { getAllByHostType } from "../rntl14";
import { withSharedValueAccessors } from "../support/sharedValueMock";

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
  return withSharedValueAccessors({
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 50 },
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: w },
    canvasHeight: { value: h },
    timestamp: { value: 1000 },
  }) as unknown as EngineState;
}

describe("useBadge", () => {
  const palette = resolveTheme("#3b82f6", "dark");

  it("returns empty path when canvas not laid out", async () => {
    const { result } = await renderHook(() =>
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

  it("builds badge with tail for default variant", async () => {
    const { result } = await renderHook(() =>
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

  it("badge text matches pillTextLeftX — same horizontal position as y-axis labels", async () => {
    const w = 400;
    // minPaddingRightForBadgeYAxisAlign(12, 35) = 8 + 14 + 20 + 35 + 4 = 81
    const pad = { ...DEFAULT_PADDING, right: 81 };
    const { result } = await renderHook(() =>
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

  it("still lays out badge with a custom right padding override", async () => {
    const pad = { ...DEFAULT_PADDING, right: 81 };
    const { result } = await renderHook(() =>
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

  it("uses minimal colors and no tail", async () => {
    const { result } = await renderHook(() =>
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

  it("no-tail pill uses minimal variant colors", async () => {
    const pad = { ...DEFAULT_PADDING, right: 81 };
    const { result } = await renderHook(() =>
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

  it("centers badge vertically when value range is zero", async () => {
    const eng = withSharedValueAccessors({
      ...makeEngine(400, 300),
      displayMin: { value: 5 },
      displayMax: { value: 5 },
      displayValue: { value: 5 },
    }) as unknown as EngineState;
    const { result } = await renderHook(() =>
      useBadge(eng, DEFAULT_PADDING, palette, (v) => v.toFixed(2), font),
    );
    expect(result.current.value.text).toBeTruthy();
  });

  it("lerps badge background when momentum shared value is provided", async () => {
    const eng = makeEngine(400, 300);
    const { result } = await renderHook(() => {
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

  it("lerps toward down momentum target", async () => {
    const eng = makeEngine(400, 300);
    const { result } = await renderHook(() => {
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

  it("lerps toward flat momentum target", async () => {
    const eng = makeEngine(400, 300);
    const { result } = await renderHook(() => {
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

  it("left-position badge is a pill only (ignores showTail)", async () => {
    const w = 400;
    const pad = { top: 12, right: 64, bottom: 28, left: 12 };
    const eng = makeEngine(w, 300);
    const { result } = await renderHook(() =>
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

  it("no-tail right-position badge uses reduced offset for text alignment", async () => {
    const w = 400;
    const pad = { ...DEFAULT_PADDING, right: 76 };
    const { result } = await renderHook(() =>
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

  it("uses fixed background color when background override is provided", async () => {
    const eng = makeEngine(400, 300);
    const { result } = await renderHook(() =>
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

  // pillH = font size (12) + padY*2 (6) = 18, so the capsule radius (midY) is 9.
  it("applies a small custom corner radius in tail mode (rounded-corner branch)", async () => {
    const { result } = await renderHook(() =>
      useBadge(
        makeEngine(400, 300),
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
        undefined,
        "right",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        3, // radius < midY → square body with rounded right corners
      ),
    );
    expect(result.current.value.text).toBe("50.00");
    expect(result.current.value.path).toBeDefined();
  });

  it("clamps a large radius back to the capsule (semicircle branch)", async () => {
    const { result } = await renderHook(() =>
      useBadge(
        makeEngine(400, 300),
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
        undefined,
        "right",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        999, // radius > midY → clamped to the capsule cap
      ),
    );
    expect(result.current.value.text).toBe("50.00");
    expect(result.current.value.path).toBeDefined();
  });

  it("clamps a negative radius to square corners on the no-tail pill", async () => {
    const { result } = await renderHook(() =>
      useBadge(
        makeEngine(400, 300),
        { ...DEFAULT_PADDING, right: 76 },
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        false, // no tail → addRRect with the clamped radius
        undefined,
        "right",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        -5, // clamped to 0 (square corners)
      ),
    );
    expect(result.current.value.text).toBe("50.00");
    expect(result.current.value.path).toBeDefined();
  });

  it("uses the text color override when provided", async () => {
    const { result } = await renderHook(() =>
      useBadge(
        makeEngine(400, 300),
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
        undefined,
        "right",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        "#00ff00", // textColor override
      ),
    );
    expect(result.current.value.textColor).toBe("#00ff00");
  });
});

// `textAlign: "yAxisColumn"` — LiveChart hands useBadge the Y-axis entries,
// `labelRightMargin` and the axis font only when the option is on.
describe("useBadge in the right-anchored Y-axis label column", () => {
  const palette = resolveTheme("#3b82f6", "dark");
  const w = 400;
  const labelRightMargin = 14;
  // A right inset wider than "50.00" (35 px with the mock font) needs: the pill
  // body runs 331..396, so a centered value has spare room on both sides. With
  // the default 10 px padX the value may sit anywhere from 341 to 351.
  const pad = { ...DEFAULT_PADDING, right: 95 };
  const paddedLeft = 331 + BADGE_PILL_PAD_X;
  const paddedRight = 396 - BADGE_PILL_PAD_X;
  const formatValue = (v: number) => v.toFixed(2);
  const textW = measureFontTextWidth(font, "50.00");
  const centered = pillTextLeftX(
    w,
    pad.right,
    BADGE_DOT_GAP + badgeTailAndCap(font.getSize()),
    textW,
  );

  function entriesOf(labels: string[]): SharedValue<YAxisEntry[]> {
    return withSharedValueAccessors({
      entries: {
        value: labels.map((label, i) => ({ y: 40 + i * 40, label, alpha: 1 })),
      },
    }).entries as unknown as SharedValue<YAxisEntry[]>;
  }

  function columnLabelX(labels: string[], margin = labelRightMargin) {
    return rightAnchoredYAxisColumnLayout(
      w,
      entriesOf(labels).value,
      font,
      margin,
    ).labelX;
  }

  async function renderBadge(
    labels: string[],
    {
      badgeFont = font,
      position = "right",
      float = false,
      margin = labelRightMargin,
      padRight = pad.right,
    }: {
      badgeFont?: SkFont;
      position?: "right" | "left";
      float?: boolean;
      /** `null` → no labelRightMargin (option off). */
      margin?: number | null;
      padRight?: number;
    } = {},
  ) {
    const { result } = await renderHook(() =>
      useBadge(
        makeEngine(w, 300),
        { ...pad, right: padRight },
        palette,
        formatValue,
        badgeFont,
        "default",
        true,
        undefined,
        position,
        undefined,
        undefined,
        undefined,
        float,
        undefined,
        undefined,
        undefined,
        undefined,
        margin === null ? undefined : entriesOf(labels),
        margin ?? undefined,
        font,
      ),
    );
    return result.current.value;
  }

  it("starts the value at the X where YAxisOverlay draws the labels", async () => {
    const labels = ["10", "100000"];
    function Axis() {
      return (
        <YAxisOverlay
          entries={entriesOf(labels)}
          engine={makeEngine(w, 300)}
          padding={pad}
          palette={palette}
          font={font}
          labelRightMargin={8}
        />
      );
    }
    const screen = await render(<Axis />);
    const labelXs = getAllByHostType(screen, View)
      .filter((view) => labels.includes(view.props.text?.value))
      .map((view) => view.props.x.value);
    const badge = await renderBadge(labels, { margin: 8 });

    // 400 canvas - 8 margin - 42 widest label = 350 for both labels.
    expect(labelXs).toEqual([350, 350]);
    expect(badge.textX).toBe(350);
    expect(centered).not.toBeCloseTo(350, 4);
  });

  it("ends the value where the labels end, not centered in the wider pill body", async () => {
    const labels = ["40.00", "60.00"];
    const badge = await renderBadge(labels);

    expect(badge.text).toBe("50.00");
    expect(badge.textX).toBeCloseTo(columnLabelX(labels), 4);
    expect(badge.textX + textW).toBeCloseTo(w - labelRightMargin, 4);
    // Centering leaves the value 5 px short of the column's right edge.
    expect(centered + textW).toBeCloseTo(w - labelRightMargin - 5, 4);
  });

  it("starts the value at the labels' shared left X when the widest label is wider", async () => {
    const labels = ["100.00", "40.00"];
    const badge = await renderBadge(labels);

    // "100.00" fills the column; "40.00" and the value both start at its left X.
    expect(badge.textX).toBeCloseTo(
      w - labelRightMargin - measureFontTextWidth(font, "100.00"),
      4,
    );
  });

  it("ends a value wider than every label at the column's right edge", async () => {
    const labels = ["5.00"];
    const badge = await renderBadge(labels);

    expect(badge.textX).toBeLessThan(columnLabelX(labels));
    expect(badge.textX + textW).toBeCloseTo(w - labelRightMargin, 4);
  });

  it("measures the column with the Y-axis font, not the badge font", async () => {
    const badgeFont = {
      ...font,
      getSize: () => 14,
      measureText: (s: string) => ({
        x: 0,
        y: 0,
        width: s.length * 8,
        height: 14,
      }),
    } as unknown as SkFont;
    const labels = ["1000.00"];
    // A wider inset (pill body 307..396) keeps both candidates inside the padding.
    const badge = await renderBadge(labels, { badgeFont, padRight: 120 });

    // Axis font: "1000.00" is 49 px → labelX 337. Measuring it with the badge
    // font (56 px) would put the column — and the value — at 330.
    expect(badge.textX).toBeCloseTo(columnLabelX(labels), 4);
    expect(badge.textX).toBeCloseTo(337, 4);
  });

  it("keeps the value inside the pill's padding when the column ends past it", async () => {
    // Column edge 398 is past the pill (body ends at 396): the value ends padX
    // short of the pill's end instead, clear of the rounded cap.
    const badge = await renderBadge(["40.00"], { margin: 2 });

    expect(columnLabelX(["40.00"], 2)).toBeCloseTo(363, 4);
    expect(badge.textX + textW).toBeCloseTo(paddedRight, 4);
  });

  it("keeps the value inside the pill's padding when the column starts left of it", async () => {
    // Column 305..340 starts left of the pill body (331).
    const badge = await renderBadge(["40.00"], { margin: 60 });

    expect(columnLabelX(["40.00"], 60)).toBeCloseTo(305, 4);
    expect(badge.textX).toBeCloseTo(paddedLeft, 4);
  });

  it("centers a value that doesn't fit inside the pill's padding", async () => {
    // Right inset 75 → pill body 351..396: 45 px holds the 35 px value but not
    // with 10 px of padding on each side.
    const badge = await renderBadge(["40.00"], { padRight: 75 });

    expect(badge.textX).toBeCloseTo(
      pillTextLeftX(w, 75, BADGE_DOT_GAP + badgeTailAndCap(12), textW),
      4,
    );
  });

  it("keeps the value centered without the column (textAlign off)", async () => {
    const badge = await renderBadge(["40.00"], { margin: null });

    expect(badge.textX).toBeCloseTo(centered, 4);
  });

  it("leaves the floating badge at its own position", async () => {
    // A column 20 px from the edge, so it differs from the floating pill's text.
    const badge = await renderBadge(["40.00"], { float: true, margin: 20 });
    const floatRight = w - 4;
    const floatLeft = floatRight - (2 * BADGE_PILL_PAD_X + textW);

    expect(badge.textX).toBeCloseTo((floatLeft + floatRight - textW) / 2, 4);
    expect(badge.textX).not.toBeCloseTo(columnLabelX(["40.00"], 20), 4);
  });

  it("leaves the left-position badge at its own position", async () => {
    const badge = await renderBadge(["40.00"], { position: "left" });
    const right = w - pad.right - BADGE_DOT_GAP;
    const left = right - (2 * BADGE_PILL_PAD_X + textW);

    expect(badge.textX).toBeCloseTo((left + right - textW) / 2, 4);
  });
});
