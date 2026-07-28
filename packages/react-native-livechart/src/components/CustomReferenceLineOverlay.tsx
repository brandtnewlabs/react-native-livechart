import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { computeScrubDotY } from "../hooks/crosshairShared";
import {
  classifyReferenceEdge,
  referenceLineForm,
  referenceLineReactKeys,
  resolveReferenceBadge,
} from "../math/referenceLines";
import type { ReferenceLine, ReferenceLineRenderProps } from "../types";

/** Horizontal anchor for the floated tag, mirroring the built-in badge/label. */
type HAnchor = "left" | "center" | "right";

/** Pin gap from the anchored plot edge, in px (matches the badge edge inset). */
const ANCHOR_INSET = 2;
/** Off-screen edge inset for the pinned handle, in px (matches the off-axis badge). */
const EDGE_INSET = 12;

/** Where a custom tag pins horizontally: the badge position, else the label
 *  position, else inside the left edge. */
function resolveAnchor(line: ReferenceLine): HAnchor {
  const badge = resolveReferenceBadge(line);
  if (badge) return badge.position;
  return line.labelPosition ?? "left";
}

/** Lightweight stand-in SharedValue for the suppression probe (see
 *  {@link customReferenceLineFlags}); never bound to the UI thread, so only the
 *  read accessors a render might touch are provided. */
function stub<T>(v: T): SharedValue<T> {
  return { value: v, get: () => v } as unknown as SharedValue<T>;
}

/** Whether a custom tag owns every state or only an off-axis tag. */
export type CustomReferenceLineMode = "always" | "off-axis";

/**
 * Which Form-A reference lines a custom renderer returns an element for. This
 * initial probe determines a line's static eligibility only; `"off-axis"` still
 * switches the built-in tag and the RN tag on the UI thread as the edge changes.
 * Index-aligned with `lines`.
 */
export function customReferenceLineFlags(
  lines: ReferenceLine[],
  render?: (
    ctx: ReferenceLineRenderProps,
  ) => React.ReactElement | null | undefined,
  mode: CustomReferenceLineMode = "always",
): boolean[] {
  if (!render) return lines.map(() => false);
  const offAxisOnly = mode === "off-axis";
  return lines.map((line, index) => {
    if (referenceLineForm(line) !== "line") return false;
    return (
      render({
        line,
        index,
        value: stub(line.value ?? 0),
        valueStr: stub(""),
        y: stub(-1),
        inRange: stub(!offAxisOnly),
        edge: stub<"above" | "in" | "below">(
          offAxisOnly ? "above" : "in",
        ),
        dragging: stub(false),
      }) != null
    );
  });
}

/**
 * One custom-rendered reference-line tag: a React Native element floated over the
 * canvas, vertically centered on the line's value-Y and horizontally pinned to the
 * badge / label position. Mirrors `CustomMarkerView` — each tag projects its own
 * value every frame, so the transform runs on the UI thread with no JS re-render
 * as the chart rescales or the line is dragged. `pointerEvents="box-none"` lets
 * empty space fall through to the chart gestures while an interactive leaf inside
 * the custom element can still be touched.
 */
function CustomReferenceLineView({
  line,
  index,
  render,
  engine,
  padding,
  formatValue,
  dragValues,
  dragActive,
  tagWidths,
  offAxisOnly,
}: {
  line: ReferenceLine;
  index: number;
  render: (
    ctx: ReferenceLineRenderProps,
  ) => React.ReactElement | null | undefined;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  formatValue: (v: number) => string;
  /** Optional live overrides used by draggable single-series lines. */
  dragValues?: SharedValue<number[]>;
  /** Optional drag state used by draggable single-series lines. */
  dragActive?: SharedValue<boolean[]>;
  /** Measured custom-tag widths, index-aligned for the Skia connector. */
  tagWidths?: SharedValue<number[]>;
  /** Show this custom tag only while its line is pinned above or below the plot. */
  offAxisOnly: boolean;
}) {
  const staticValue = line.value ?? 0;

  // Live value: a drag override (if present) else the static prop value.
  const value = useDerivedValue<number>(() => {
    const dv = dragValues?.get()[index];
    return dv != null ? dv : staticValue;
  });
  const valueStr = useDerivedValue(() => formatValue(value.get()));
  const edge = useDerivedValue<"above" | "in" | "below">(() =>
    classifyReferenceEdge(
      value.get(),
      engine.displayMin.get(),
      engine.displayMax.get(),
    ),
  );
  const inRange = useDerivedValue(() => edge.get() === "in");
  const dragging = useDerivedValue(
    () => dragActive?.get()[index] === true,
  );

  // Canvas Y of the value (the element's vertical center). Off-screen values pin
  // to the nearest plot edge (inset), matching the built-in off-axis badge.
  const y = useDerivedValue(() => {
    const ch = engine.canvasHeight.get();
    // `computeScrubDotY` also returns negative values for legitimate prices above
    // the visible range, so use the layout dimensions—not the projected Y—to
    // distinguish an unmeasured canvas from an off-axis line.
    if (ch - padding.top - padding.bottom <= 0) return -1;
    const raw = computeScrubDotY(
      value.get(),
      engine.displayMin.get(),
      engine.displayMax.get(),
      ch,
      padding.top,
      padding.bottom,
    );
    const top = padding.top + EDGE_INSET;
    const bottom = ch - padding.bottom - EDGE_INSET;
    return Math.min(bottom, Math.max(top, raw));
  });

  // Measured element size, so the transform can center / pin it.
  const size = useSharedValue({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    size.set({ width, height });
    if (tagWidths) {
      const previous = tagWidths.get();
      if (previous[index] === width) return;
      const widths = previous.slice();
      widths[index] = width;
      tagWidths.set(widths);
    }
  };

  const anchor = resolveAnchor(line);
  const animatedStyle = useAnimatedStyle(() => {
    const yy = y.get();
    const s = size.get();
    const w = engine.canvasWidth.get();
    const visible = yy >= 0 && w > 0 && (!offAxisOnly || edge.get() !== "in");
    const x1 = padding.left;
    const x2 = w - padding.right;
    let tx: number;
    if (anchor === "right") tx = x2 - ANCHOR_INSET - s.width;
    else if (anchor === "center") tx = (x1 + x2) / 2 - s.width / 2;
    else tx = x1 + ANCHOR_INSET;
    return {
      opacity: visible ? 1 : 0,
      transform: [{ translateX: tx }, { translateY: yy - s.height / 2 }],
    };
  });

  const element = render({
    line,
    index,
    value,
    valueStr,
    y,
    inRange,
    edge,
    dragging,
  });
  if (element == null) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      onLayout={onLayout}
      style={[styles.anchor, animatedStyle]}
    >
      {element}
    </Animated.View>
  );
}

/**
 * React Native overlay (NOT Skia) that floats `renderReferenceLine` elements over
 * the canvas, one per Form-A line the consumer customizes. Rendered as a sibling
 * of `<Canvas>` (like {@link CustomMarkerOverlay}) so the tags can be any RN view
 * and stay crisp at native resolution. Lines whose render returns an element hide
 * their built-in pill / label upstream (see {@link customReferenceLineFlags}); a
 * badged line's Skia connector remains, measured against the native tag's width.
 */
export function CustomReferenceLineOverlay({
  lines,
  renderReferenceLine,
  custom,
  engine,
  padding,
  formatValue,
  dragValues,
  dragActive,
  tagWidths,
  offAxisOnly = false,
}: {
  lines: ReferenceLine[];
  renderReferenceLine: (
    ctx: ReferenceLineRenderProps,
  ) => React.ReactElement | null | undefined;
  /**
   * Index-aligned flags (from {@link customReferenceLineFlags}) marking which
   * lines the render owns — only these get a floated view, matching the built-in
   * tags suppressed upstream. Avoids re-probing the render here.
   */
  custom: boolean[];
  engine: ChartEngineLayout;
  padding: ChartPadding;
  formatValue: (v: number) => string;
  /** Optional live overrides used by draggable single-series lines. */
  dragValues?: SharedValue<number[]>;
  /** Optional drag state used by draggable single-series lines. */
  dragActive?: SharedValue<boolean[]>;
  /** Measured custom-tag widths, index-aligned for the Skia connector. */
  tagWidths?: SharedValue<number[]>;
  /** Keep the built-in in-range tag and show this RN tag only off-axis. */
  offAxisOnly?: boolean;
}) {
  const children: React.ReactElement[] = [];
  const lineKeys = referenceLineReactKeys(lines);
  for (let i = 0; i < lines.length; i++) {
    if (!custom[i]) continue;
    children.push(
      <CustomReferenceLineView
        key={lineKeys[i]}
        line={lines[i]}
        index={i}
        render={renderReferenceLine}
        engine={engine}
        padding={padding}
        formatValue={formatValue}
        dragValues={dragValues}
        dragActive={dragActive}
        tagWidths={tagWidths}
        offAxisOnly={offAxisOnly}
      />,
    );
  }
  if (children.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // top/left 0 + translate so the measured element can be pinned to the value.
  anchor: { position: "absolute", top: 0, left: 0 },
});
