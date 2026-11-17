import { useState } from "react";
import { Pressable, Text } from "react-native";
import {
  LiveChart,
  LiveChartSeries,
  type ReferenceLine,
  type ReferenceLineRenderProps,
} from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT, formatWholeValue } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

const START = 100;

type ChartKind = "single" | "multi";

const CHART_OPTIONS: { value: ChartKind; label: string }[] = [
  { value: "single", label: "LiveChart" },
  { value: "multi", label: "LiveChartSeries" },
];

function targetValue(location: "above" | "in" | "below", center: number) {
  if (location === "above") return center * 3;
  if (location === "below") return -center;
  return center;
}

function renderTargetTag(line: ReferenceLine, onPress: () => void) {
  if (line.id !== "target" && line.id !== "second") return null;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Custom ${line.label}`}
    onPress={onPress}
    style={{ padding: 12, backgroundColor: "#6b21a8", borderRadius: 8 }}
  ><Text style={{ color: "white" }}>{line.label}</Text></Pressable>;
}

export default function ReferenceLinesScreen() {
  const [chartKind, setChartKind] = useState<ChartKind>("single");
  const [lines, setLines] = useState(true);
  const [valueBand, setValueBand] = useState(false);
  const [timeBand, setTimeBand] = useState(false);
  const [offAxis, setOffAxis] = useState(false);
  const [offAxisBehavior, setOffAxisBehavior] = useState<"pin" | "hide">("pin");
  const [targetLocation, setTargetLocation] = useState<"above" | "in" | "below">("above");
  const [targetRenderer, setTargetRenderer] = useState<"builtin" | "custom" | "off-axis">("builtin");
  const [stackTargets, setStackTargets] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState(false);
  const [presses, setPresses] = useState(0);
  const [valueLine, setValueLine] = useState(true);
  // Span lines/bands edge-to-edge through the Y-axis gutter (vs stop at the plot).
  const [fullWidth, setFullWidth] = useState(false);
  // How the off-axis target tags itself: the modern `badge` pill (icon + the
  // `position`/`text` knobs) vs the legacy `offAxisBadge`. Modern is the default
  // so the interactive badge controls below drive the visible path.
  const [badgeMode, setBadgeMode] = useState<"modern" | "legacy">("modern");
  // Which plot edge the modern badge pins to ("center" floats it with no connector).
  const [badgePosition, setBadgePosition] = useState<
    "left" | "center" | "right"
  >("left");
  // text:false → icon-only pill (just the chevron glyph, no label/value text).
  const [badgeIconOnly, setBadgeIconOnly] = useState(false);
  const [alignedYAxis, setAlignedYAxis] = useState(true);
  const referenceCenter = chartKind === "multi" ? 33.3 : START;

  const { data, value, series } = useSimulatedChartData({
    multiSeries: chartKind === "multi",
    candleAggregation: false,
    tradeStream: false,
    startValue: START,
    // Dense seed so the line weaves through the reference lines/bands from the
    // first frame instead of sitting flat until live ticks fill the window.
    historySpanSeconds: 40,
    historyRange: "1m",
  });

  // Pin the time band ONCE when it's enabled (the band lives in absolute
  // unix-seconds space, so it then scrolls smoothly leftward with the chart).
  // Re-pinning on an interval would make it jump back to the right each tick.
  // Pinned directly in the toggle handler below — it's a response to the button
  // press, not derived state, so it doesn't belong in an effect.
  const [timeWindow, setTimeWindow] = useState<{
    from: number;
    to: number;
  } | null>(null);

  const toggleTimeBand = (next: boolean) => {
    setTimeBand(next);
    if (next) {
      const now = Date.now() / 1000;
      setTimeWindow({ from: now - 20, to: now - 8 });
    }
  };

  const referenceLines: ReferenceLine[] = [];
  if (lines) {
    referenceLines.push({
      value: referenceCenter * 1.05,
      label: "+5%",
      color: "#34d399",
      fullWidth,
    });
    referenceLines.push({
      value: referenceCenter * 0.95,
      label: "-5%",
      color: "#f87171",
      strokeWidth: 2,
      intervals: [6, 4],
      fullWidth,
    });
  }
  if (valueBand) {
    referenceLines.push({
      valueFrom: referenceCenter * 0.98,
      valueTo: referenceCenter * 1.02,
      color: "#fbbf24",
      label: "±2% band",
      // strokeWidth adds a dashed border; fillOpacity tunes the fill alpha.
      strokeWidth: 1,
      intervals: [4, 3],
      fillOpacity: 0.18,
      fullWidth,
    });
  }
  if (timeBand && timeWindow) {
    referenceLines.push({
      from: timeWindow.from,
      to: timeWindow.to,
      color: "#60a5fa",
      label: "event",
      strokeWidth: 1,
      intervals: [4, 3],
    });
  }
  if (offAxis) {
    referenceLines.push({
      id: "target",
      value: targetValue(targetLocation, referenceCenter),
      offAxis: offAxisBehavior,
      valueBadge: true,
      draggable: true,
      label: "Target",
      excludeFromRange: true,
      color: "#a855f7",
      showValue: !badgeIconOnly,
      // Target panel styling: background / border / radius. These are the
      // fallbacks the modern `badge` also reads (badge.background / .borderColor
      // / .radius), so the panel looks the same in either mode.
      badgeBackground: "rgba(168,85,247,0.18)",
      badgeBorderColor: "#a855f7",
      badgeRadius: 8,
      ...targetBadge(badgeMode, badgePosition, badgeIconOnly),
    });
  }

  if (offAxis && duplicateTarget) {
    referenceLines.push({ ...referenceLines[referenceLines.length - 1], id: "second", label: "Second" });
  }
  const onTargetPress = () => setPresses((count) => count + 1);
  const renderTarget = ({ line }: ReferenceLineRenderProps) => renderTargetTag(line, onTargetPress);
  const customTags = {
    renderReferenceLine: targetRenderer === "custom" ? renderTarget : undefined,
    renderOffAxisReferenceLine: targetRenderer === "off-axis" ? renderTarget : undefined,
  };

  const yAxis = alignedYAxis
    ? { labelRightMargin: 24, gridEndGap: 12 }
    : true;

  return (
    <DemoScreen
      title="Reference lines & bands"
      docs="guides/reference-lines-and-bands"
      description="referenceLines array — lines, value bands, time bands, off-axis badge"
      chart={
        chartKind === "single" ? (
          <LiveChart
            data={data}
            value={value}
            accentColor={ACCENT}
            theme={APP_THEME}
            referenceLines={referenceLines}
            {...customTags}
            referenceLineGrouping={{ mode: stackTargets ? "stack" : "collapse" }}
            onReferenceLinePress={onTargetPress}
            valueLine={valueLine}
            scrub={false}
            yAxis={yAxis}
            formatValue={formatWholeValue}
          />
        ) : (
          <LiveChartSeries
            series={series}
            accentColor={ACCENT}
            theme={APP_THEME}
            referenceLines={referenceLines}
            {...customTags}
            dot={{ valueLine }}
            legend={false}
            scrub={false}
            yAxis={yAxis}
            formatValue={formatWholeValue}
          />
        )
      }
    >
      <ChipRow
        label="Chart"
        options={CHART_OPTIONS}
        value={chartKind}
        onChange={setChartKind}
      />
      <ControlRow label={`Target presses: ${presses}`}>
        <ToggleChip label="Off-axis target" value={offAxis} onChange={setOffAxis} />
      </ControlRow>
      <TargetControls offAxis={offAxis} chartKind={chartKind}
        offAxisBehavior={offAxisBehavior} setOffAxisBehavior={setOffAxisBehavior}
        targetLocation={targetLocation} setTargetLocation={setTargetLocation}
        targetRenderer={targetRenderer} setTargetRenderer={setTargetRenderer}
        stackTargets={stackTargets} setStackTargets={setStackTargets}
        duplicateTarget={duplicateTarget} setDuplicateTarget={setDuplicateTarget} />
      <ControlRow label="Contribution preview">
        <ToggleChip
          label="Aligned Y column (24 / 12 px)"
          value={alignedYAxis}
          onChange={setAlignedYAxis}
        />
      </ControlRow>
      <ControlRow label="Reference forms">
        <ToggleChip label="Lines (±5%)" value={lines} onChange={setLines} />
        <ToggleChip
          label="Value band"
          value={valueBand}
          onChange={setValueBand}
        />
        <ToggleChip label="Time band" value={timeBand} onChange={toggleTimeBand} />
      </ControlRow>
      <ControlRow>
        <ToggleChip
          label="Value line"
          value={valueLine}
          onChange={setValueLine}
        />
        <ToggleChip
          label="Full width"
          value={fullWidth}
          onChange={setFullWidth}
        />
      </ControlRow>
      <BadgeControls enabled={offAxis} badgeMode={badgeMode} setBadgeMode={setBadgeMode}
        badgePosition={badgePosition} setBadgePosition={setBadgePosition}
        badgeIconOnly={badgeIconOnly} setBadgeIconOnly={setBadgeIconOnly} />
    </DemoScreen>
  );
}

function BadgeControls({ enabled, badgeMode, setBadgeMode, badgePosition, setBadgePosition, badgeIconOnly, setBadgeIconOnly }: {
  enabled: boolean;
  badgeMode: "modern" | "legacy";
  setBadgeMode: (value: "modern" | "legacy") => void;
  badgePosition: "left" | "center" | "right";
  setBadgePosition: (value: "left" | "center" | "right") => void;
  badgeIconOnly: boolean;
  setBadgeIconOnly: (value: boolean) => void;
}) {
  return (<>
      {enabled ? (
        <>
          <ChipRow<"modern" | "legacy">
            label="Target tag"
            options={[
              { value: "modern", label: "Badge pill" },
              { value: "legacy", label: "offAxisBadge (legacy)" },
            ]}
            value={badgeMode}
            onChange={setBadgeMode}
          />
          {badgeMode === "modern" ? (
            <>
              <ChipRow<"left" | "center" | "right">
                label="Badge position"
                options={[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Center" },
                  { value: "right", label: "Right" },
                ]}
                value={badgePosition}
                onChange={setBadgePosition}
              />
              <ControlRow>
                <ToggleChip
                  label="Icon-only (text: false)"
                  value={badgeIconOnly}
                  onChange={setBadgeIconOnly}
                />
              </ControlRow>
            </>
          ) : null}
        </>
      ) : null}
  </>);
}

function TargetControls({ offAxis, chartKind, offAxisBehavior, setOffAxisBehavior, targetLocation, setTargetLocation, targetRenderer, setTargetRenderer, stackTargets, setStackTargets, duplicateTarget, setDuplicateTarget }: {
  offAxis: boolean;
  chartKind: ChartKind;
  offAxisBehavior: "pin" | "hide";
  setOffAxisBehavior: (value: "pin" | "hide") => void;
  targetLocation: "above" | "in" | "below";
  setTargetLocation: (value: "above" | "in" | "below") => void;
  targetRenderer: "builtin" | "custom" | "off-axis";
  setTargetRenderer: (value: "builtin" | "custom" | "off-axis") => void;
  stackTargets: boolean;
  setStackTargets: (value: boolean) => void;
  duplicateTarget: boolean;
  setDuplicateTarget: (value: boolean) => void;
}) {
  return (<>
      {offAxis ? <>
        <ChipRow label="Off-axis behavior" options={[{ value: "pin", label: "Pin" }, { value: "hide", label: "Hide" }]} value={offAxisBehavior} onChange={setOffAxisBehavior} />
        <ChipRow label="Target value" options={[{ value: "above", label: "Above" }, { value: "in", label: "In range" }, { value: "below", label: "Below" }]} value={targetLocation} onChange={setTargetLocation} />
        <ChipRow label="Renderer" options={[{ value: "builtin", label: "Built-in" }, { value: "custom", label: "Custom" }, { value: "off-axis", label: "Custom off-axis" }]} value={targetRenderer} onChange={setTargetRenderer} />
        {chartKind === "single" ? <ControlRow label="Collision handling">
          <ToggleChip label="Stack tags" value={stackTargets} onChange={setStackTargets} />
          <ToggleChip label="Second target" value={duplicateTarget} onChange={setDuplicateTarget} />
        </ControlRow> : null}
      </> : null}
  </>);
}

function targetBadge(mode: "modern" | "legacy", position: "left" | "center" | "right", iconOnly: boolean): Partial<ReferenceLine> {
  // The legacy badge pins only off-axis; the modern badge also renders in range.
  return mode === "modern"
    ? { badge: { position, icon: "▲", text: !iconOnly } }
    : { offAxisBadge: true, offAxisBadgeLabel: "Target" };
}
