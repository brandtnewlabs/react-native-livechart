import { useImage } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  LiveChart,
  type Marker,
  type MarkerKind,
} from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { useSimulatedChartData } from "../../sim/useSimulatedChartData";
import { DemoScreen } from "./lib/DemoScreen";
import { ACCENT } from "./lib/shared";
import { demoStyles } from "./lib/styles";

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

/** Visible time window (s). Markers are kept until they scroll just past it. */
const WINDOW = 30;

export default function MarkersScreen() {
  const { data, value } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: false,
    tradeStream: false,
    startValue: 100,
  });

  const logo = useImage(require("../../assets/images/react-logo.png"));

  const markers = useSharedValue<Marker[]>([]);
  const counter = useRef(0);
  const [auto, setAuto] = useState(true);
  const [glyph, setGlyph] = useState<GlyphMode>("shape");
  const [hover, setHover] = useState("Tap a marker glyph");

  // Latest glyph mode for the interval closure without re-arming it each toggle.
  const glyphRef = useRef(glyph);
  useEffect(() => {
    glyphRef.current = glyph;
  });

  const decorate = (kind: MarkerKind): Partial<Marker> => {
    const mode = glyphRef.current;
    if (mode === "symbol") return { icon: SYMBOLS[kind] };
    if (mode === "image" && logo) return { image: logo, size: 22 };
    return {};
  };

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
        ...decorate(kind),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- glyph read via ref
  }, [auto, markers, value]);

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
        ...decorate(kind),
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
        ...decorate(m.kind),
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- decorate reads glyphRef + logo
  }, [glyph, logo, markers]);

  return (
    <DemoScreen
      description="markers[] — 5 kinds, tap to hover (onMarkerHover + markerHitRadius)"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme="dark"
          timeWindow={WINDOW}
          markers={markers}
          markerHitRadius={22}
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

      <Text style={demoStyles.sectionLabel}>Markers</Text>
      <View style={demoStyles.buttonRow}>
        <Pressable
          style={[demoStyles.chip, auto && demoStyles.chipActive]}
          onPress={() => setAuto((v) => !v)}
        >
          <Text style={[demoStyles.chipText, auto && demoStyles.chipTextActive]}>
            {auto ? "Auto-spawn on" : "Auto-spawn off"}
          </Text>
        </Pressable>
        <Pressable style={demoStyles.chip} onPress={spawnAll}>
          <Text style={demoStyles.chipText}>One of each</Text>
        </Pressable>
        <Pressable
          style={demoStyles.chip}
          onPress={() => {
            markers.set([]);
          }}
        >
          <Text style={demoStyles.chipText}>Clear</Text>
        </Pressable>
      </View>
      <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
        trade = ring · boost = asterisk · graduation = flag · winner = star ·
        clawback = square
      </Text>

      <Text style={demoStyles.sectionLabel}>Glyph</Text>
      <View style={demoStyles.buttonRow}>
        {(
          [
            ["shape", "Shapes"],
            ["symbol", "Symbols"],
            ["image", "Image"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[demoStyles.chip, glyph === k && demoStyles.chipActive]}
            onPress={() => setGlyph(k)}
          >
            <Text
              style={[
                demoStyles.chipText,
                glyph === k && demoStyles.chipTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[demoStyles.chipText, { opacity: 0.6, marginTop: 8 }]}>
        Per-marker glyph: built-in shape, a text/emoji `icon`, or an `image`
        (Skia SkImage). Image precedence: image &gt; icon &gt; shape.
      </Text>
    </DemoScreen>
  );
}
