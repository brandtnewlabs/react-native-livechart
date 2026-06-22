import { useState } from "react";
import {
  LiveChart,
  type ChartSegment,
  type LiveChartPoint,
} from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { Chip, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";

export const options = { title: "Segments" };

// Three sessions (pre-market | regular | after-hours) partition the chart. The
// line is ONE color at rest; scrubbing a session keeps it full and de-emphasizes
// the others (the Robinhood model). Framed with nowOverride + timeWindow so the
// timeframe is fixed (no scrolling) while the chart stays scrubbable.
const SPAN = 600; // visible window, seconds
const COUNT = 170;
const T1_FRACTION = 1 / 3; // pre-market → regular boundary
const T2_FRACTION = 2 / 3; // regular → after-hours boundary

// De-emphasis color choices (rgb triples → rgba() at the chosen opacity).
const COLORS = [
  { label: "Grey", rgb: "154,160,166" },
  { label: "Blue", rgb: "59,130,246" },
  { label: "Orange", rgb: "249,115,22" },
  { label: "Green", rgb: "52,211,153" },
];
const OPACITIES = [0.25, 0.5, 0.75, 1];

function seedSession(endTime: number) {
  const start = endTime - SPAN;
  const points: LiveChartPoint[] = [];
  let v = 100;
  for (let i = 0; i < COUNT; i++) {
    const time = start + (i / (COUNT - 1)) * SPAN;
    v += (Math.random() - 0.5) * 1.3 + 0.04;
    points.push({ time, value: v });
  }
  return {
    points,
    t1: start + T1_FRACTION * SPAN,
    t2: start + T2_FRACTION * SPAN,
    maxT: endTime,
  };
}

export default function SegmentsScreen() {
  const [showSegments, setShowSegments] = useState(true);
  const [divider, setDivider] = useState(true);
  const [active, setActive] = useState(false);
  const [regularRecolor, setRegularRecolor] = useState(true);
  const [gradientLine, setGradientLine] = useState(false);
  const [colorIdx, setColorIdx] = useState(0);
  const [opacity, setOpacity] = useState(0.5);

  // Seed the fixed dataset once.
  const [seed] = useState(() => seedSession(Date.now() / 1000));
  const data = useSharedValue<LiveChartPoint[]>(seed.points);
  const value = useSharedValue(seed.points[seed.points.length - 1].value);

  const rgb = COLORS[colorIdx].rgb;
  const dim = `rgba(${rgb},${opacity})`; // a non-focused session's line color
  // "Gradient line" fades a de-emphasized session out along its length — a
  // pronounced drop so the gradient reads clearly during scrub / active.
  const dimSoft = `rgba(${rgb},${(opacity * 0.12).toFixed(3)})`;

  // Shared styling: at rest every session is the base line color (uniform line).
  // When a session is focused (scrubbed / active) it stays the base color; the
  // OTHERS take this de-emphasis color (set by the Color + Opacity controls). The
  // divider + label need no color — they inherit the chart palette.
  const dimStyle: Partial<ChartSegment> = {
    recolorLine: true,
    mutedColor: dim,
    mutedColors: gradientLine ? [dim, dimSoft] : undefined,
  };

  const segments: ChartSegment[] = [];
  if (showSegments) {
    segments.push(
      { ...dimStyle, to: seed.t1 }, // pre-market: left edge → t1
      // `recolorLine: false` opts "Regular" out of scrub-focus de-emphasis — it
      // still draws its divider + label but never dims, acting as a focus gap
      // while the others react to scrub focus.
      {
        ...dimStyle,
        recolorLine: regularRecolor,
        from: seed.t1,
        to: seed.t2,
        divider,
        label: "Regular",
      },
      // after-hours: t2 → live edge. `active` force-focuses it (others dim).
      { ...dimStyle, from: seed.t2, divider, label: "After hours", active },
    );
  }

  return (
    <DemoScreen
      title="Segments"
      docs="guides/segments"
      description="scrub focus: the whole line is one color; scrub a session (or toggle Active) to keep it full while the others are de-emphasized"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          // Fixed (non-scrolling) timeframe via nowOverride + timeWindow — the
          // historical-data-fill pattern — so the chart stays fully scrubbable.
          // The live pulse is off because nowOverride pins the timestamp it
          // animates from; a historical snapshot has no live tip to pulse.
          timeWindow={SPAN}
          nowOverride={seed.maxT}
          pulse={false}
          // Strip the value line, value badge and Y-axis so the plot fills the
          // full width — keeps the focus on the segments.
          valueLine={false}
          badge={false}
          yAxis={false}
          // Disable the crosshair's right-side dim (dimOpacity: 1) — the segment
          // de-emphasis already provides the scrub focus, so the extra overlay
          // would just double up.
          scrub={{ dimOpacity: 1 }}
          segments={segments}
        />
      }
    >
      <ControlRow label="Sessions">
        <ToggleChip
          label="Show"
          value={showSegments}
          onChange={setShowSegments}
        />
        <ToggleChip label="Dividers" value={divider} onChange={setDivider} />
      </ControlRow>
      <ControlRow label="De-emphasis color">
        {COLORS.map((c, i) => (
          <Chip
            key={c.label}
            label={c.label}
            active={colorIdx === i}
            onPress={() => setColorIdx(i)}
          />
        ))}
      </ControlRow>
      <ControlRow label="De-emphasis opacity">
        {OPACITIES.map((o) => (
          <Chip
            key={o}
            label={`${Math.round(o * 100)}%`}
            active={opacity === o}
            onPress={() => setOpacity(o)}
          />
        ))}
      </ControlRow>
      <ControlRow label="Focus (or scrub the chart)">
        <ToggleChip
          label="Active (after-hours)"
          value={active}
          onChange={setActive}
        />
        <ToggleChip
          label="Regular opts out"
          value={!regularRecolor}
          onChange={(v) => setRegularRecolor(!v)}
        />
        <ToggleChip
          label="Gradient line"
          value={gradientLine}
          onChange={setGradientLine}
        />
      </ControlRow>
    </DemoScreen>
  );
}
