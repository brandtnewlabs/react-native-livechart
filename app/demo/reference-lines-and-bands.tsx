import { useState } from "react";
import { LiveChart, type ReferenceLine } from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Reference lines & bands" };

const START = 100;

export default function ReferenceLinesScreen() {
  const [lines, setLines] = useState(true);
  const [valueBand, setValueBand] = useState(false);
  const [timeBand, setTimeBand] = useState(false);
  const [offAxis, setOffAxis] = useState(false);
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

  const { data, value } = useSimulatedChartData({
    multiSeries: false,
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
      value: START * 1.05,
      label: "+5%",
      color: "#34d399",
      fullWidth,
    });
    referenceLines.push({
      value: START * 0.95,
      label: "-5%",
      color: "#f87171",
      strokeWidth: 2,
      intervals: [6, 4],
      fullWidth,
    });
  }
  if (valueBand) {
    referenceLines.push({
      valueFrom: START * 0.98,
      valueTo: START * 1.02,
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
      value: START * 1.5,
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
      // Modern pill badge: pins to `position`, carries an icon, and supports an
      // icon-only (text:false) variant. Supersedes the legacy `offAxisBadge`.
      ...(badgeMode === "modern"
        ? {
            badge: {
              position: badgePosition,
              icon: "▲",
              text: !badgeIconOnly,
            },
          }
        : {
            // Legacy off-axis badge — pinned edge chevron, in-range it falls back
            // to the plain gutter label. No icon / position / icon-only knobs.
            offAxisBadge: true,
            offAxisBadgeLabel: "Target",
          }),
    });
  }

  return (
    <DemoScreen
      title="Reference lines & bands"
      docs="guides/reference-lines-and-bands"
      description="referenceLines array — lines, value bands, time bands, off-axis badge"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          referenceLines={referenceLines}
          valueLine={valueLine}
          scrub={false}
        />
      }
    >
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
          label="Off-axis target"
          value={offAxis}
          onChange={setOffAxis}
        />
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
      {offAxis ? (
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
    </DemoScreen>
  );
}
