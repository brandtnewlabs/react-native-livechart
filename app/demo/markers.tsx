import { useImage, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import {
  LiveChart,
  type Marker,
  type MarkerKind,
} from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { Chip, ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT, VOLATILITY_MODES } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Markers" };

const KINDS: MarkerKind[] = [
  "trade",
  "boost",
  "graduation",
  "winner",
  "clawback",
];

/** Plain text/symbol glyphs (render in the chart's mono font). */
const SYMBOLS: Record<MarkerKind, string> = {
  trade: "$",
  boost: "*",
  graduation: "^",
  winner: "+",
  clawback: "x",
};

type GlyphMode = "shape" | "symbol" | "image";

const GLYPH_OPTIONS: { value: GlyphMode; label: string }[] = [
  { value: "shape", label: "Shapes" },
  { value: "symbol", label: "Symbols" },
  { value: "image", label: "Image" },
];

const VOLATILITY_OPTIONS = VOLATILITY_MODES.map((m) => ({
  value: m,
  label: m,
}));

/** Visible time window (s). Markers are kept until they scroll just past it. */
const WINDOW = 30;

/** Per-kind glyph decoration for the current mode (shape = no icon/image override). */
function decorate(
  kind: MarkerKind,
  mode: GlyphMode,
  logo: SkImage | null,
): Partial<Marker> {
  if (mode === "symbol") return { icon: SYMBOLS[kind] };
  if (mode === "image" && logo) return { image: logo, size: 22 };
  return {};
}

export default function MarkersScreen() {
  const [auto, setAuto] = useState(true);
  const [glyph, setGlyph] = useState<GlyphMode>("shape");
  const [hover, setHover] = useState("Tap a marker glyph");
  const [streamOn, setStreamOn] = useState(false);
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

  const logo = useImage(require("../../assets/images/react-logo.png"));

  const markers = useSharedValue<Marker[]>([]);
  const counter = useRef(0);

  // Drop a marker (cycling kinds) near the live edge every 1.5s.
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      const now = Date.now() / 1000;
      const kind = KINDS[counter.current % KINDS.length];
      counter.current += 1;
      const m: Marker = {
        id: `m${counter.current}`,
        time: now - 1,
        kind,
        value: value.get(),
        data: { kind },
        ...decorate(kind, glyph, logo),
      };
      // Keep markers until they scroll just past the left edge of the window
      // (not a fixed count — a low cap would evict still-visible markers
      // mid-chart). The generous slice is only an unbounded-growth safety net.
      markers.set(
        [...markers.get(), m]
          .filter((x) => x.time > now - (WINDOW + 4))
          .slice(-60),
      );
    }, 1500);
    return () => clearInterval(id);
  }, [auto, markers, value, glyph, logo]);

  const spawnAll = () => {
    const now = Date.now() / 1000;
    const v = value.get();
    markers.set(
      KINDS.map((kind, i) => ({
        id: `all-${kind}`,
        time: now - 2 - i * 1.5,
        kind,
        value: v * (1 + (i - 2) * 0.01),
        data: { kind },
        ...decorate(kind, glyph, logo),
      })),
    );
  };

  // Re-decorate existing markers when the glyph mode changes.
  useEffect(() => {
    markers.set(
      markers.get().map((m) => ({
        ...m,
        icon: undefined,
        image: undefined,
        size: undefined,
        ...decorate(m.kind, glyph, logo),
      })),
    );
  }, [glyph, logo, markers]);

  return (
    <DemoScreen
      title="Markers & trades"
      docs="guides/markers-and-references"
      description="markers[] — 5 kinds, tap to hover (onMarkerHover + markerHitRadius). Optional tradeStream overlay."
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={WINDOW}
          markers={markers}
          markerHitRadius={22}
          tradeStream={streamOn ? tradeStream : undefined}
          onMarkerHover={(e) => {
            setHover(
              e
                ? `${e.marker.kind} @ ${e.marker.value?.toFixed(2)} (${e.point.x.toFixed(0)}, ${e.point.y.toFixed(0)})`
                : "missed — tap a glyph",
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
        <Chip label="One of each" active={false} onPress={spawnAll} />
        <Chip
          label="Clear"
          active={false}
          onPress={() => {
            markers.set([]);
          }}
        />
      </ControlRow>
      <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
        trade = ring · boost = asterisk · graduation = flag · winner = star ·
        clawback = square
      </Text>

      <ChipRow
        label="Glyph"
        options={GLYPH_OPTIONS}
        value={glyph}
        onChange={setGlyph}
      />
      <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
        Per-marker glyph: built-in shape, a text/emoji `icon`, or an `image`
        (Skia SkImage). Image precedence: image &gt; icon &gt; shape.
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
