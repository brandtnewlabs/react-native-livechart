import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import {
  LiveChart,
  type BadgeConfig,
  type LiveChartPoint,
  type YAxisConfig,
} from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { APP_FONT_FAMILY } from "../../demo-lib/fonts";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";

type Price = "99.95" | "100.00" | "repeat";
type Axis = "column" | "default" | "float" | "left";
type Gutter = "balanced" | "roomy" | "tight";
type Panel = "comparison" | "layout";

const PANELS = [
  { value: "comparison", label: "Compare" },
  { value: "layout", label: "Layout checks" },
] as const;

const ALIGNMENTS = [
  { value: "center", label: "Centered" },
  { value: "yAxisColumn", label: "Axis column" },
] as const;
const PRICES = [
  { value: "99.95", label: "$99.95" },
  { value: "100.00", label: "$100.00" },
  { value: "repeat", label: "Repeat transition" },
] as const;
const AXES = [
  { value: "column", label: "Column" },
  { value: "default", label: "Default" },
  { value: "float", label: "Floating" },
  { value: "left", label: "Left" },
] as const;
const GUTTERS = [
  { value: "balanced", label: "Balanced" },
  { value: "roomy", label: "Roomy" },
  { value: "tight", label: "Tight" },
] as const;
const Y_AXES: Record<Axis, YAxisConfig> = {
  column: { count: 4, labelRightMargin: 8, gridEndGap: 6 },
  default: { count: 4 },
  float: { count: 4, float: true, labelRightMargin: 8, gridEndGap: 6 },
  left: { count: 4, side: "left", labelRightMargin: 8, gridEndGap: 6 },
};
const INSETS: Record<Gutter, number> = { balanced: 84, roomy: 116, tight: 78 };
const LARGE_FONT_INSETS: Record<Gutter, number> = {
  balanced: 108,
  roomy: 140,
  tight: 104,
};

function formatPrice(price: number) {
  "worklet";
  return `$${price.toFixed(2)}`;
}

/** A narrow range makes the extra digit entering/leaving the label column visible. */
function historyAt(time: number, price: number): LiveChartPoint[] {
  return Array.from({ length: 81 }, (_, i) => ({
    time: time - (80 - i) * 0.25,
    value: price + Math.sin((i * Math.PI) / 20) * 0.025,
  }));
}

function alignmentHint(
  axis: Axis,
  leftBadge: boolean,
  offset: boolean,
  gutter: Gutter,
  largeFont: boolean,
  alignment: BadgeConfig["textAlign"],
): string {
  if (axis !== "column" || leftBadge) {
    return "This layout keeps the badge centered. Column alignment needs a right-side label column and a badge in the right gutter.";
  }
  if (offset) {
    return "The offset moves both the pill and its value 12 px left, away from the axis column.";
  }
  if (gutter === "tight") {
    return "The value stays inside the pill's padding. When it cannot fit with that padding, it falls back to centered. Try Roomy with the larger font.";
  }
  if (alignment === "center") {
    return "The value is centered in the pill. Compare its first character with the labels below it.";
  }
  if (largeFont) {
    return "The larger value ends at the column's right edge. The axis column is still measured with the chart font.";
  }
  return "The value starts at the labels' left edge. The whole column moves when an extra digit enters or leaves it.";
}

export default function BadgeAlignmentScreen() {
  const [panel, setPanel] = useState<Panel>("comparison");
  const [alignment, setAlignment] =
    useState<NonNullable<BadgeConfig["textAlign"]>>("yAxisColumn");
  const [price, setPrice] = useState<Price>("99.95");
  const [axis, setAxis] = useState<Axis>("column");
  const [gutter, setGutter] = useState<Gutter>("balanced");
  const [tail, setTail] = useState(true);
  const [largeFont, setLargeFont] = useState(false);
  const [leftBadge, setLeftBadge] = useState(false);
  const [offset, setOffset] = useState(false);
  const [time] = useState(() => Date.now() / 1000);
  const data = useSharedValue<LiveChartPoint[]>([]);
  const value = useSharedValue(99.95);

  useEffect(() => {
    const show = (next: number) => {
      data.set(historyAt(time, next));
      value.set(next);
    };
    show(price === "100.00" ? 100 : 99.95);
    if (price !== "repeat") return;
    let above = false;
    const timer = setInterval(() => {
      above = !above;
      show(above ? 100 : 99.95);
    }, 2400);
    return () => clearInterval(timer);
  }, [price, time, data, value]);

  const explanation = alignmentHint(
    axis,
    leftBadge,
    offset,
    gutter,
    largeFont,
    alignment,
  );

  return (
    <DemoScreen
      title="Badge alignment"
      description="Compare a centered price with one aligned to the Y-axis label column. Repeat the transition across $100 to watch the column change width."
      docs="guides/badge-alignment"
      chart={
        <LiveChart
          data={data}
          value={value}
          nowOverride={time}
          timeWindow={20}
          static={price !== "repeat"}
          accentColor={ACCENT}
          theme={APP_THEME}
          formatValue={formatPrice}
          font={{ fontSize: 11 }}
          yAxis={Y_AXES[axis]}
          insets={{
            right: axis === "float" ? 0 : (largeFont ? LARGE_FONT_INSETS : INSETS)[gutter],
            left: axis === "left" ? 84 : 12,
          }}
          metrics={{ badge: { marginEdge: 4, padX: 4 } }}
          badge={{
            textAlign: alignment,
            tail,
            position: leftBadge ? "left" : "right",
            fontSize: largeFont ? 16 : undefined,
            offsetX: offset ? -12 : 0,
            background: ACCENT,
          }}
          scrub={false}
          pulse={false}
        />
      }
    >
      <ChipRow options={PANELS} value={panel} onChange={setPanel} />
      {panel === "comparison" ? (
        <>
          <ChipRow
            label="Value alignment"
            options={ALIGNMENTS}
            value={alignment}
            onChange={setAlignment}
          />
          <ChipRow label="Price" options={PRICES} value={price} onChange={setPrice} />
        </>
      ) : (
        <ChipRow
          label="Y-axis layout"
          options={AXES}
          value={axis}
          onChange={setAxis}
        />
      )}
      <ChipRow
        label="Right gutter"
        options={GUTTERS}
        value={gutter}
        onChange={setGutter}
      />
      {panel === "layout" ? (
        <ControlRow label="Badge appearance">
          <ToggleChip label="Tail" value={tail} onChange={setTail} />
          <ToggleChip label="Larger font" value={largeFont} onChange={setLargeFont} />
          <ToggleChip label="Left of dot" value={leftBadge} onChange={setLeftBadge} />
          <ToggleChip label="Offset −12" value={offset} onChange={setOffset} />
        </ControlRow>
      ) : null}
      <Text style={styles.explanation}>{explanation}</Text>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  explanation: {
    color: colors.textMuted,
    fontFamily: APP_FONT_FAMILY,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
});
