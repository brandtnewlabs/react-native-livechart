import { useState } from "react";
import {
  TextInput,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { ResolvedAxisLabelConfig } from "../core/resolveConfig";
import type {
  ChartEngineExtrema,
  ChartEngineLayout,
} from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import type { FontWeight } from "../types";

/** Resolved text-styling knobs shared by the edge and extrema built-in labels. */
interface LabelFontStyle {
  fontSize?: number;
  fontWeight?: FontWeight;
  fontFamily?: string;
}

/** Pluck the font knobs off a resolved axis-label config. */
function labelFont(cfg: ResolvedAxisLabelConfig): LabelFontStyle {
  return {
    fontSize: cfg.fontSize,
    fontWeight: cfg.fontWeight,
    fontFamily: cfg.fontFamily,
  };
}

/** Editable={false} TextInput so its `text` prop can be animated on the UI thread. */
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Marker dot drawn at the exact extrema point (built-in `"extrema"` label). */
const EXTREMA_DOT_SIZE = 7;
/** Gap (px) between the extrema dot and its value text. */
const EXTREMA_GAP = 3;
/** How far off-plot (px) the extrema point may sit before the label is hidden. */
const EXTREMA_CULL = 24;
/** `"extrema-edge"` top label's inset from the very top of the chart (px). The
 *  connector ({@link ExtremaConnectorOverlay}) reads this to stop at the label. */
export const EXTREMA_EDGE_INSET = 2;
/** Default value-text size (px). Mirrors `styles.extremaText`; the connector
 *  reads it to estimate where the edge label ends. */
export const EXTREMA_LABEL_FONT_SIZE = 11;

/**
 * The batteries-included axis edge label — an animated RN text driven by a
 * `SharedValue<number>` (the chart's current top / bottom Y-axis bound). The
 * value updates each frame on the UI thread via `useDerivedValue` +
 * `useAnimatedProps`, so the label tracks the live range without JS re-renders.
 *
 * Scoped into its own subcomponent so these hooks only run when the built-in
 * label is active (not when a custom `render` is supplied).
 */
function BuiltInAxisValueLabel({
  value,
  format,
  color,
  position,
  font,
}: {
  value: SharedValue<number>;
  format: (v: number) => string;
  color: string;
  position: "left" | "right" | "extrema" | "extrema-edge";
  font: LabelFontStyle;
}) {
  const text = useDerivedValue(() => format(value.get()));
  const animatedProps = useAnimatedProps(() => {
    const t = text.get();
    return { text: t, defaultValue: t };
  });
  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      style={{
        color,
        textAlign: position === "left" ? "left" : "right",
        padding: 0,
        // undefined keys are ignored by RN, so each falls back to its default.
        fontSize: font.fontSize,
        fontWeight: font.fontWeight,
        fontFamily: font.fontFamily,
      }}
      animatedProps={animatedProps}
    />
  );
}

/**
 * An axis label floated at the *actual data point* where the extreme value
 * occurs — `topLabel` over the highest point, `bottomLabel` under the lowest —
 * rather than pinned to a fixed plot edge. The chart projects the extremum's
 * (time, value) to a canvas pixel each frame and positions the label there on
 * the UI thread, so the dot + value track the point as the chart scrolls and
 * the Y-axis rescales (the same projection the markers / scrub dot use).
 *
 * The value text rides a JS-thread `useState` rather than UI-thread animated
 * text: it changes only when a *new* extremum appears (not every frame), and a
 * plain `<Text>` re-measures on change so the box stays correctly centered over
 * the point (an animated `TextInput`'s width is fixed at its last layout, which
 * would clip / drift as the digit count changes). Hidden (`opacity: 0`) when the
 * window holds no data (value is `NaN`) or the point scrolls off-plot.
 */
function ExtremaAxisLabel({
  side,
  timeSV,
  valueSV,
  timeOffset,
  edgeAnchor,
  engine,
  padding,
  format,
  color,
  font,
  dotColor,
  dotSize,
  dot,
  render,
}: {
  /** `"top"` floats above the max point; `"bottom"` below the min point. */
  side: "top" | "bottom";
  timeSV: SharedValue<number>;
  valueSV: SharedValue<number>;
  /**
   * `"extrema-edge"` mode: pin the value label to the plot's top / bottom edge
   * (x-aligned with the extremum) instead of floating it over the point. The dot
   * still sits on the point; a connector line (drawn in Skia) joins them.
   */
  edgeAnchor: boolean;
  /**
   * Seconds added to the extremum time before projecting to x. `0` for line /
   * multi-series (the point sits at its exact time); half a candle width in
   * candle mode so the dot lands on the candle's drawn center, not its left edge.
   */
  timeOffset: number;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  format: (v: number) => string;
  color: string;
  font: LabelFontStyle;
  /** Dot color; falls back to `color`. */
  dotColor?: string;
  /** Dot diameter (px); falls back to the built-in default. */
  dotSize?: number;
  /** Whether to draw the marker dot. */
  dot: boolean;
  render?: () => React.ReactElement | null;
}) {
  const isCustom = render != null;
  // Resolved dot geometry. `hasDot` also gates the label's vertical offset (it
  // sits past the dot when shown, otherwise just past the point).
  const dotSizePx = dotSize ?? EXTREMA_DOT_SIZE;
  const hasDot = !isCustom && dot;
  // Measured size of the content (text or custom element) — used only to center
  // and clamp the LABEL horizontally. The dot is pinned to the point regardless.
  const size = useSharedValue({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    size.value = { width, height };
  };

  // The value text changes only when the extremum does, so push it to JS state
  // (a re-measured <Text>) instead of UI-thread animated text. Skipped when a
  // custom element owns the content.
  const [valueText, setValueText] = useState("");
  useAnimatedReaction(
    () => {
      const v = valueSV.get();
      return isCustom || !Number.isFinite(v) ? "" : format(v);
    },
    (curr, prev) => {
      if (curr !== prev) scheduleOnRN(setValueText, curr);
    },
  );

  // Project the extremum's (time, value) to a canvas pixel once; the dot and the
  // label both read it. `visible` is false when the window is empty or the point
  // scrolls off-plot.
  const proj = useDerivedValue(() => {
    const value = valueSV.get();
    const time = timeSV.get();
    const cw = engine.canvasWidth.get();
    const ch = engine.canvasHeight.get();
    const displayMin = engine.displayMin.get();
    const displayMax = engine.displayMax.get();
    const win = engine.displayWindow.get();
    const ts = engine.timestamp.get();

    const chartLeft = padding.left;
    const chartRight = cw - padding.right;
    const chartW = chartRight - chartLeft;
    const chartTop = padding.top;
    const chartBottom = ch - padding.bottom;
    const chartH = chartBottom - chartTop;
    const valRange = displayMax - displayMin;

    if (
      !Number.isFinite(value) ||
      cw === 0 ||
      ch === 0 ||
      chartW <= 0 ||
      chartH <= 0 ||
      win <= 0 ||
      valRange <= 0
    ) {
      return { px: 0, py: 0, visible: false };
    }

    const winStart = ts - win;
    const px = chartLeft + ((time + timeOffset - winStart) / win) * chartW;
    const py = chartTop + ((displayMax - value) / valRange) * chartH;
    // Scrolled out of view — hide rather than clamp it to the edge.
    const visible = px >= chartLeft - EXTREMA_CULL && px <= chartRight + EXTREMA_CULL;
    return { px, py, visible };
  });

  // The dot sits EXACTLY on the data point (its center at px, py) — never
  // clamped, so it always marks where the high / low occurred.
  const dotStyle = useAnimatedStyle(() => {
    const p = proj.get();
    if (!p.visible) return { opacity: 0 };
    return {
      opacity: 1,
      transform: [
        { translateX: p.px - dotSizePx / 2 },
        { translateY: p.py - dotSizePx / 2 },
      ],
    };
  });

  // The label is centered on the point but clamped into the plot width so it
  // stays readable near an edge — independent of the dot, which stays on-point.
  const labelStyle = useAnimatedStyle(() => {
    const p = proj.get();
    const s = size.get();
    if (!p.visible) {
      return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    }
    const cw = engine.canvasWidth.get();
    const chartLeft = padding.left;
    const chartRight = cw - padding.right;
    const rightBound = chartRight - s.width;
    const x = Math.min(
      Math.max(p.px - s.width / 2, chartLeft),
      Math.max(chartLeft, rightBound),
    );
    let y: number;
    if (edgeAnchor) {
      // Pin to the OUTERMOST edge (x stays aligned with the extremum): the top
      // label rides the very top of the chart; the bottom label sits flush with
      // the plot's bottom (clear of the x-axis below). The connector stops at the
      // label, so the line never runs through the text.
      const ch = engine.canvasHeight.get();
      y =
        side === "top"
          ? EXTREMA_EDGE_INSET
          : ch - padding.bottom - s.height;
    } else {
      // Sit just past the dot (max → above it, min → below it). With no dot (or a
      // custom element), sit just past the point itself.
      const gap = hasDot ? dotSizePx / 2 + EXTREMA_GAP : EXTREMA_GAP;
      y = side === "top" ? p.py - gap - s.height : p.py + gap;
    }
    return { opacity: 1, transform: [{ translateX: x }, { translateY: y }] };
  });

  return (
    <>
      {hasDot && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.extremaDot,
            {
              width: dotSizePx,
              height: dotSizePx,
              borderRadius: dotSizePx / 2,
              backgroundColor: dotColor ?? color,
            },
            dotStyle,
          ]}
        />
      )}
      <Animated.View
        pointerEvents="none"
        onLayout={onLayout}
        style={[styles.extremaAnchor, labelStyle]}
      >
        {isCustom ? (
          render()
        ) : (
          <Text
            style={[
              styles.extremaText,
              {
                color,
                // undefined keys fall back to the base style / RN defaults.
                fontSize: font.fontSize,
                fontWeight: font.fontWeight,
                fontFamily: font.fontFamily,
              },
            ]}
          >
            {valueText}
          </Text>
        )}
      </Animated.View>
    </>
  );
}

/**
 * React Native overlay (NOT Skia) floating axis edge labels over the Skia
 * canvas — `topLabel` pinned to the plot's top edge and `bottomLabel` to its
 * bottom edge (Robinhood-style high/low values).
 *
 * For each side: a resolved config with a `render` floats that custom element;
 * otherwise the built-in {@link BuiltInAxisValueLabel} shows the chart's current
 * `engine.displayMax` (top) / `engine.displayMin` (bottom) — the live Y-axis
 * bounds — formatted with the config's `format` (falling back to the chart's
 * `formatValue`) in the config `color` (falling back to `defaultColor`).
 *
 * When a side's `position` is `"extrema"` (and the engine exposes the live
 * extrema), it instead floats at the actual data point where the high / low
 * occurs via {@link ExtremaAxisLabel}.
 *
 * Because the chart's `<View>` is the canvas size, the plot's top edge sits
 * `padding.top` px from the top and its bottom edge `padding.bottom` px from
 * the bottom — so positioning needs only the resolved padding (no live height,
 * no SharedValues). `pointerEvents="none"` keeps the labels display-only so they
 * never intercept the scrub pan gesture.
 */
export function AxisLabelOverlay({
  topLabel,
  bottomLabel,
  engine,
  formatValue,
  defaultColor,
  padding,
  extremaTimeOffset = 0,
}: {
  topLabel: ResolvedAxisLabelConfig | null;
  bottomLabel: ResolvedAxisLabelConfig | null;
  engine: ChartEngineLayout & Partial<ChartEngineExtrema>;
  formatValue: (v: number) => string;
  defaultColor: string;
  padding: ChartPadding;
  /**
   * Seconds added to each extremum time before projecting (for `"extrema"`
   * labels). Half a candle width in candle mode so the dot aligns with the
   * candle's drawn center; `0` (default) for line / multi-series.
   */
  extremaTimeOffset?: number;
}) {
  if (!topLabel && !bottomLabel) return null;

  // Both extrema modes need the engine's live extrema SharedValues; without them
  // (e.g. an engine that doesn't track them) fall back to the edge label.
  const topMode = topLabel?.position;
  const bottomMode = bottomLabel?.position;
  const topExtrema =
    (topMode === "extrema" || topMode === "extrema-edge") &&
    engine.extremaMaxTime != null &&
    engine.extremaMaxValue != null;
  const bottomExtrema =
    (bottomMode === "extrema" || bottomMode === "extrema-edge") &&
    engine.extremaMinTime != null &&
    engine.extremaMinValue != null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {topLabel &&
        (topExtrema ? (
          <ExtremaAxisLabel
            side="top"
            timeSV={engine.extremaMaxTime!}
            valueSV={engine.extremaMaxValue!}
            timeOffset={extremaTimeOffset}
            edgeAnchor={topMode === "extrema-edge"}
            engine={engine}
            padding={padding}
            format={topLabel.format ?? formatValue}
            color={topLabel.color ?? defaultColor}
            font={labelFont(topLabel)}
            dotColor={topLabel.dotColor}
            dotSize={topLabel.dotSize}
            dot={topLabel.dot}
            render={topLabel.render ?? undefined}
          />
        ) : (
          <View
            style={{
              position: "absolute",
              top: padding.top,
              left: padding.left,
              right: padding.right,
            }}
          >
            {topLabel.render ? (
              topLabel.render()
            ) : (
              <BuiltInAxisValueLabel
                value={engine.displayMax}
                format={topLabel.format ?? formatValue}
                color={topLabel.color ?? defaultColor}
                position={topLabel.position}
                font={labelFont(topLabel)}
              />
            )}
          </View>
        ))}
      {bottomLabel &&
        (bottomExtrema ? (
          <ExtremaAxisLabel
            side="bottom"
            timeSV={engine.extremaMinTime!}
            valueSV={engine.extremaMinValue!}
            timeOffset={extremaTimeOffset}
            edgeAnchor={bottomMode === "extrema-edge"}
            engine={engine}
            padding={padding}
            format={bottomLabel.format ?? formatValue}
            color={bottomLabel.color ?? defaultColor}
            font={labelFont(bottomLabel)}
            dotColor={bottomLabel.dotColor}
            dotSize={bottomLabel.dotSize}
            dot={bottomLabel.dot}
            render={bottomLabel.render ?? undefined}
          />
        ) : (
          <View
            style={{
              position: "absolute",
              bottom: padding.bottom,
              left: padding.left,
              right: padding.right,
            }}
          >
            {bottomLabel.render ? (
              bottomLabel.render()
            ) : (
              <BuiltInAxisValueLabel
                value={engine.displayMin}
                format={bottomLabel.format ?? formatValue}
                color={bottomLabel.color ?? defaultColor}
                position={bottomLabel.position}
                font={labelFont(bottomLabel)}
              />
            )}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // top/left 0 + a measured transform places each piece over the point.
  extremaAnchor: { position: "absolute", top: 0, left: 0, alignItems: "center" },
  // The dot, pinned exactly on the data point (transform lands its center there).
  // Size + radius are applied inline (configurable via `dotSize`).
  extremaDot: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  extremaText: {
    fontSize: EXTREMA_LABEL_FONT_SIZE,
    padding: 0,
    fontVariant: ["tabular-nums"],
  },
});
