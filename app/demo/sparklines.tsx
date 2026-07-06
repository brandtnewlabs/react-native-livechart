import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LiveChart, type LiveChartPoint } from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT, ACCENT_PRESETS } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import { demoStyles } from "../../demo-lib/styles";

export const options = { title: "Sparklines" };

const CELL_COUNT = 24;
const POINTS_PER_CELL = 40;
const CELL_SPAN = 60; // seconds of history per sparkline

/**
 * Mulberry32 — a tiny, fast, deterministic PRNG. Seeded so every cell renders the
 * same walk on every launch (no `Math.random`, no live feed).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic seeded random walk: `count` points ending at `endTime`. */
function seededWalk(seed: number, count: number, endTime: number): LiveChartPoint[] {
  const rand = mulberry32(seed);
  const out: LiveChartPoint[] = [];
  let v = 50 + rand() * 50;
  for (let i = 0; i < count; i++) {
    v += (rand() - 0.48) * 6;
    out.push({
      time: endTime - CELL_SPAN + (i / (count - 1)) * CELL_SPAN,
      value: v,
    });
  }
  return out;
}

type CellSeed = {
  id: number;
  points: LiveChartPoint[];
  last: number;
  endTime: number;
  color: string;
};

/**
 * One static mini-chart. Wraps its fixed array in shared values (so the chart's
 * UI-thread reads work) and frames it edge-to-edge with `timeWindow` +
 * `nowOverride` (the historical-data-fill pattern). `static` disables every
 * per-frame loop, so dozens of these cost almost nothing.
 */
function SparklineCell({ seed }: { seed: CellSeed }) {
  const dataSV = useSharedValue<LiveChartPoint[]>(seed.points);
  const valSV = useSharedValue(seed.last);
  return (
    <View style={styles.cell}>
      <LiveChart
        static
        data={dataSV}
        value={valSV}
        accentColor={seed.color}
        theme={APP_THEME}
        timeWindow={CELL_SPAN}
        nowOverride={seed.endTime}
        windowBuffer={0}
        line={{ width: 1.5 }}
        badge={false}
        yAxis={false}
        xAxis={false}
        scrub={false}
        pulse={false}
        dot={{ radius: 2.5, ring: false }}
        leftEdgeFade={false}
        style={styles.cellChart}
      />
    </View>
  );
}

export default function SparklinesScreen() {
  // Build the 24 fixed datasets once. `nowOverride` is pinned per-cell so the
  // most recent point sits exactly at the right edge. The anchor time is read
  // once at mount via a lazy initializer to keep render pure.
  const [endTime] = useState(() => Date.now() / 1000);
  const seeds = useMemo<CellSeed[]>(() => {
    return Array.from({ length: CELL_COUNT }, (_, i) => {
      const points = seededWalk(i * 1000 + 7, POINTS_PER_CELL, endTime);
      return {
        id: i,
        points,
        last: points[points.length - 1].value,
        endTime,
        color: ACCENT_PRESETS[i % ACCENT_PRESETS.length],
      };
    });
  }, [endTime]);

  // Featured larger sparkline shown in the fixed chart slot above the grid.
  const featuredData = useSharedValue<LiveChartPoint[]>(seeds[0].points);
  const featuredValue = useSharedValue(seeds[0].last);
  // A static chart is still scrubbable — the gesture is event-driven, so the
  // render loop stays off until you touch. Toggle it on the featured chart.
  const [scrubFeatured, setScrubFeatured] = useState(true);

  return (
    <DemoScreen
      title="Sparklines"
      docs="guides/sparklines"
      description="static — many mini-charts in a list with zero per-chart animation loops (still scrubbable on touch)"
      chart={
        <LiveChart
          static
          data={featuredData}
          value={featuredValue}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={CELL_SPAN}
          nowOverride={seeds[0].endTime}
          windowBuffer={0}
          scrub={scrubFeatured}
          pulse={false}
        />
      }
    >
      <ControlRow label="Featured chart (static)">
        <ToggleChip
          label="Scrub on touch"
          value={scrubFeatured}
          onChange={setScrubFeatured}
        />
      </ControlRow>
      <Text style={[demoStyles.chipText, { opacity: 0.6, marginBottom: 12 }]}>
        The featured chart above is {`static`} — no render loop — yet stays
        scrubbable: drag across it to reveal the crosshair. {`scrub`} is an
        on-demand gesture, so the loop stays off until you touch.
      </Text>
      <Text style={demoStyles.sectionLabel}>{CELL_COUNT} static sparklines</Text>
      <Text style={[demoStyles.chipText, { opacity: 0.6, marginBottom: 12 }]}>
        Each cell renders once from a fixed seeded walk. No frame callback, no
        pulse, no entry animation — so a long list of them stays cheap. (These
        leave {`scrub`} off too; a thumbnail rarely needs it.)
      </Text>
      <View style={styles.grid}>
        {seeds.map((seed) => (
          <SparklineCell key={seed.id} seed={seed} />
        ))}
      </View>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cell: {
    width: "48%",
    height: 56,
    marginBottom: 10,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.chipBackground,
  },
  cellChart: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
