import { BlurView } from "expo-blur";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LiveChart, type Marker } from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { Chip, ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT, VOLATILITY_MODES } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Markers" };

type Side = "buy" | "sell";

// Tailwind green-600 / red-600 — saturated enough for the white +/− to read.
const BUY_COLOR = "#16a34a";
const SELL_COLOR = "#dc2626";

const VOLATILITY_OPTIONS = VOLATILITY_MODES.map((m) => ({ value: m, label: m }));

/** Fan-overlap presets for the `markerCluster` object form. */
const OVERLAP_OPTIONS = [
  { value: 0.3, label: "30%" },
  { value: 0.5, label: "50%" },
  { value: 0.6, label: "60%" },
  { value: 0.75, label: "75%" },
  { value: 0.9, label: "90%" },
];

/** Visible time window (s). Markers are kept until they scroll just past it. */
const WINDOW = 30;

/**
 * Buy = green `+` pill below the line, sell = red `−` pill above it. `value` is
 * omitted so the marker anchors to the line at `time`; `side` lifts it off the
 * line; `pill` draws the colored badge around the icon. With
 * `markerCluster="stacked"` co-located buys/sells fan apart and collapse to a
 * count badge when a burst runs out of room.
 */
function makeMarker(id: string, time: number, side: Side): Marker {
  return {
    id,
    time,
    kind: "trade", // built-in shape is overridden by the pill + icon below
    color: side === "buy" ? BUY_COLOR : SELL_COLOR,
    icon: side === "buy" ? "+" : "−",
    pill: true,
    side: side === "buy" ? "below" : "above",
    data: { side },
  };
}

/**
 * Custom-rendered marker: an iOS-style "glass" badge built from an `expo-blur`
 * `<BlurView>` — a NON-Skia native view that the Skia canvas can't draw. This is
 * exactly what `renderMarker` unlocks: the chart floats it over the canvas,
 * pinned to the marker's live position, crisp at native resolution.
 */
function GlassMarker({ side }: { side: Side }) {
  const color = side === "buy" ? BUY_COLOR : SELL_COLOR;
  return (
    <BlurView
      intensity={28}
      tint={APP_THEME === "dark" ? "dark" : "light"}
      style={glass.badge}
    >
      <View style={[glass.dot, { backgroundColor: color }]} />
      <Text style={[glass.text, { color }]}>
        {side === "buy" ? "BUY" : "SELL"}
      </Text>
    </BlurView>
  );
}

export default function MarkersScreen() {
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState("Tap a marker");
  const [streamOn, setStreamOn] = useState(false);
  const [custom, setCustom] = useState(false);
  const [stacked, setStacked] = useState(false);
  const [overlap, setOverlap] = useState(0.75);
  const [vol, setVol] = useState<(typeof VOLATILITY_MODES)[number]>("normal");

  const { data, value, tradeStream } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: streamOn,
    volatilityMode: vol,
    tradesPerSecond: 5,
    tokenSymbol: "SIM",
    startValue: 100,
    // Fill the 30s window with a lively seed so markers land on a real line from
    // the first frame (a sparse default seed leaves it flat until live ticks land).
    historySpanSeconds: 40,
    historyRange: "1m",
  });

  const markers = useSharedValue<Marker[]>([]);
  const counter = useRef(0);

  const spawn = (side: Side) => {
    const now = Date.now() / 1000;
    counter.current += 1;
    const m = makeMarker(`m${counter.current}`, now - 1, side);
    // Keep markers until they scroll just past the left edge of the window; the
    // generous slice is only an unbounded-growth safety net.
    markers.set(
      [...markers.get(), m]
        .filter((x) => x.time > now - (WINDOW + 4))
        .slice(-60),
    );
  };

  // Drop `n` buys at one instant — co-located, so `markerCluster="stacked"` fans
  // them horizontally (with overlap); past the group threshold it collapses to a
  // count badge. `Fan ×4` shows the overlap; `Burst ×12` shows the collapse.
  const spawnCluster = (n: number) => {
    const now = Date.now() / 1000;
    const t = now - 1;
    const added: Marker[] = [];
    for (let i = 0; i < n; i++) {
      counter.current += 1;
      added.push(makeMarker(`m${counter.current}`, t, "buy"));
    }
    markers.set(
      [...markers.get(), ...added]
        .filter((x) => x.time > now - (WINDOW + 4))
        .slice(-60),
    );
  };

  // Auto-spawn: alternate buy / sell near the live edge every 1.5s.
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      const now = Date.now() / 1000;
      counter.current += 1;
      const side: Side = counter.current % 2 === 0 ? "buy" : "sell";
      const m = makeMarker(`m${counter.current}`, now - 1, side);
      markers.set(
        [...markers.get(), m]
          .filter((x) => x.time > now - (WINDOW + 4))
          .slice(-60),
      );
    }, 1500);
    return () => clearInterval(id);
  }, [auto, markers]);

  return (
    <DemoScreen
      title="Markers & trades"
      docs="guides/markers-and-references"
      description="Buy / sell markers anchored to the line — green + pill (buy), red − pill (sell). Tap a pill to hover; optional tradeStream overlay."
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={WINDOW}
          markers={markers}
          markerHitRadius={22}
          markerCluster={stacked ? { mode: "stacked", overlap } : "anchored"}
          renderMarker={
            custom
              ? (m) => (
                  <GlassMarker
                    side={(m.data as { side?: Side })?.side ?? "buy"}
                  />
                )
              : undefined
          }
          tradeStream={streamOn ? tradeStream : undefined}
          onMarkerPress={(e) => {
            const side = (e?.marker.data as { side?: Side } | undefined)?.side;
            setHover(
              e
                ? e.isGrouped
                  ? `group of ${e.members?.length ?? 0} (tap #${e.index})`
                  : `${side ?? "marker"} @ (${e.point.x.toFixed(0)}, ${e.point.y.toFixed(0)})`
                : "missed — tap a pill",
            );
          }}
          scrub={false}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>Hover readout</Text>
      <Text style={[demoStyles.chipText, { marginBottom: 8 }]}>{hover}</Text>

      <ControlRow label="Markers">
        <Chip
          label={auto ? "Auto-spawn on" : "Auto-spawn off"}
          active={auto}
          onPress={() => setAuto((v) => !v)}
        />
        <Chip label="Buy +" active={false} onPress={() => spawn("buy")} />
        <Chip label="Sell −" active={false} onPress={() => spawn("sell")} />
        <Chip label="Fan ×4" active={false} onPress={() => spawnCluster(4)} />
        <Chip label="Burst ×9" active={false} onPress={() => spawnCluster(9)} />
        <Chip label="Burst ×12" active={false} onPress={() => spawnCluster(12)} />
        <Chip label="Clear" active={false} onPress={() => markers.set([])} />
      </ControlRow>
      <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
        Green + = buy (below the line) · red − = sell (above). Markers omit
        `value`, so each anchors to the line at its time; `side` lifts it off.
      </Text>

      <ControlRow label="Collision">
        <ToggleChip label="markerCluster: stacked" value={stacked} onChange={setStacked} />
      </ControlRow>
      <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
        With stacking on, co-located markers fan apart horizontally (overlapping,
        left-over-right); a dense burst collapses to a count badge (tap it for the
        member list).
      </Text>
      {stacked ? (
        <ChipRow
          label="Overlap"
          options={OVERLAP_OPTIONS}
          value={overlap}
          onChange={setOverlap}
        />
      ) : null}

      <ControlRow label="Custom render">
        <ToggleChip label="renderMarker" value={custom} onChange={setCustom} />
      </ControlRow>
      <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
        `renderMarker` floats your own RN element at each marker — here a real
        expo-blur `BlurView` glass badge, the kind of non-Skia view the canvas
        can&apos;t draw.
      </Text>

      <ControlRow label="Trade stream">
        <ToggleChip label="tradeStream" value={streamOn} onChange={setStreamOn} />
      </ControlRow>
      <ChipRow
        label="Volatility"
        options={VOLATILITY_OPTIONS}
        value={vol}
        onChange={setVol}
      />
    </DemoScreen>
  );
}

const glass = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    // Hairline rim sells the "glass" edge; overflow clips the blur to the pill.
    borderColor: APP_THEME === "dark" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.12)",
    overflow: "hidden",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
