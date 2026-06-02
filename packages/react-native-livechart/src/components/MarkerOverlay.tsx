import {
  Circle,
  Group,
  Image as SkiaImage,
  Path,
  Skia,
  Text as SkiaText,
  type SkFont,
  type SkPath,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAnimatedReaction,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import { markersSignature, projectPoint } from "../math/markers";
import type {
  LiveChartPalette,
  Marker,
  MarkerKind,
  SeriesConfig,
} from "../types";

/** Default glyph color per kind when `marker.color` is unset. */
function defaultMarkerColor(kind: MarkerKind, palette: LiveChartPalette): string {
  switch (kind) {
    case "trade":
      return palette.line;
    case "boost":
      return palette.refLine;
    case "graduation":
      return palette.dotUp;
    case "winner":
      return palette.dotUp;
    case "clawback":
      return palette.refLabel;
  }
}

const OFF = -9999;
const DEFAULT_ICON_SIZE = 16;

function MarkerGlyph({
  marker,
  color,
  engine,
  padding,
  seriesSV,
  font,
  axisY,
}: {
  marker: Marker;
  color: string;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  seriesSV?: SharedValue<SeriesConfig[]>;
  font: SkFont;
  axisY: SharedValue<number>;
}) {
  // Capture only primitive anchor fields — never the full marker (which may
  // carry non-serializable `data` / `image`) — in the worklet closure.
  const { kind, icon, image } = marker;
  const time = marker.time;
  const value = marker.value;
  const seriesId = marker.seriesId;
  const size = marker.size ?? DEFAULT_ICON_SIZE;

  // Each glyph projects its OWN marker — no shared index buffer, so reordering
  // the marker array can't make a glyph flash another marker's position.
  const layout = useDerivedValue(() =>
    projectPoint(time, value, seriesId, {
      canvasWidth: engine.canvasWidth.value,
      canvasHeight: engine.canvasHeight.value,
      padTop: padding.top,
      padBottom: padding.bottom,
      padLeft: padding.left,
      padRight: padding.right,
      timestamp: engine.timestamp.value,
      displayWindow: engine.displayWindow.value,
      displayMin: engine.displayMin.value,
      displayMax: engine.displayMax.value,
      series: seriesSV?.value,
    }),
  );

  const cx = useDerivedValue(() =>
    layout.value.visible ? layout.value.x : OFF,
  );
  const cy = useDerivedValue(() =>
    layout.value.visible ? layout.value.y : OFF,
  );
  const opacity = useDerivedValue(() => (layout.value.visible ? 1 : 0));

  const cache = useMemo(
    () => ({ a: Skia.Path.Make(), b: Skia.Path.Make(), tick: false }),
    [],
  );

  const glyphPath = useDerivedValue(() => {
    cache.tick = !cache.tick;
    const p: SkPath = cache.tick ? cache.a : cache.b;
    p.reset();
    const l = layout.value;
    if (!l.visible) return p;
    const x = l.x;
    const y = l.y;
    if (kind === "winner") {
      const outer = 7;
      const inner = 3;
      for (let k = 0; k < 10; k++) {
        const ang = -Math.PI / 2 + (k * Math.PI) / 5;
        const rad = k % 2 === 0 ? outer : inner;
        const px = x + rad * Math.cos(ang);
        const py = y + rad * Math.sin(ang);
        if (k === 0) p.moveTo(px, py);
        else p.lineTo(px, py);
      }
      p.close();
    } else if (kind === "boost") {
      const L = 6;
      for (let k = 0; k < 4; k++) {
        const ang = (k * Math.PI) / 4;
        const dx = L * Math.cos(ang);
        const dy = L * Math.sin(ang);
        p.moveTo(x - dx, y - dy);
        p.lineTo(x + dx, y + dy);
      }
    } else if (kind === "graduation") {
      p.moveTo(x, axisY.value);
      p.lineTo(x, y);
      p.moveTo(x, y - 7);
      p.lineTo(x + 8, y - 4);
      p.lineTo(x, y - 1);
      p.close();
    } else if (kind === "clawback") {
      const s = 5;
      const ay = axisY.value - s;
      p.moveTo(x - s, ay);
      p.lineTo(x + s, ay);
      p.lineTo(x + s, ay + s * 2);
      p.lineTo(x - s, ay + s * 2);
      p.close();
    }
    return p;
  });

  // Image icon centered on the marker.
  const imgX = useDerivedValue(() =>
    layout.value.visible ? layout.value.x - size / 2 : OFF,
  );
  const imgY = useDerivedValue(() =>
    layout.value.visible ? layout.value.y - size / 2 : OFF,
  );

  // Text / emoji icon centering — width + baseline shift depend only on the
  // (stable) font and icon, so measure once instead of every frame. Skia
  // `measureText`/`getMetrics` both allocate, so hoisting them out of the
  // per-frame worklet removes one measure + one metrics call per glyph/frame.
  const halfIconW = useMemo(
    () => measureFontTextWidth(font, icon ?? "") / 2,
    [font, icon],
  );
  const iconBaselineShift = useMemo(() => {
    const fm = font.getMetrics();
    return (fm.ascent + fm.descent) / 2;
  }, [font]);

  const iconX = useDerivedValue(() =>
    layout.value.visible ? layout.value.x - halfIconW : OFF,
  );
  const iconY = useDerivedValue(() =>
    layout.value.visible ? layout.value.y - iconBaselineShift : OFF,
  );

  if (image) {
    return (
      <Group opacity={opacity}>
        <SkiaImage
          image={image}
          x={imgX}
          y={imgY}
          width={size}
          height={size}
          fit="contain"
        />
      </Group>
    );
  }

  if (icon) {
    return (
      <Group opacity={opacity}>
        <SkiaText x={iconX} y={iconY} text={icon} font={font} color={color} />
      </Group>
    );
  }

  if (kind === "trade") {
    return (
      <Group opacity={opacity}>
        <Circle cx={cx} cy={cy} r={5} color={color} style="stroke" strokeWidth={2} />
        <Circle cx={cx} cy={cy} r={2} color={color} />
      </Group>
    );
  }

  const fill = kind === "winner" || kind === "clawback";
  return (
    <Group opacity={opacity}>
      <Path
        path={glyphPath}
        color={color}
        style={fill ? "fill" : "stroke"}
        strokeWidth={1.5}
        strokeCap="round"
        strokeJoin="round"
      />
    </Group>
  );
}

/**
 * Renders the `markers` SharedValue as canvas glyphs. Marker metadata is
 * mirrored into React state when it changes; each glyph projects its own
 * position every frame (keyed by id), so adding/removing markers never makes a
 * surviving glyph flash another marker's position.
 *
 * Glyph precedence per marker: `image` → `icon` (text) → built-in `kind` shape.
 */
export function MarkerOverlay({
  markers,
  engine,
  padding,
  palette,
  font,
  series,
}: {
  markers: SharedValue<Marker[]>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LiveChartPalette;
  font: SkFont;
  /** Multi-series data, used to anchor markers by `seriesId`. */
  series?: SharedValue<SeriesConfig[]>;
}) {
  const [snapshot, setSnapshot] = useState<Marker[]>([]);

  const pull = useCallback((sv: SharedValue<Marker[]>) => {
    setSnapshot(sv.value.slice());
  }, []);

  useAnimatedReaction(
    () => markersSignature(markers.value),
    /* istanbul ignore next -- scheduleOnRN from UI-thread reaction */
    (sig, prev) => {
      if (sig !== prev) scheduleOnRN(pull, markers);
    },
    [markers, pull],
  );

  useEffect(() => {
    setSnapshot(markers.value.slice());
  }, [markers, pull]);

  const axisY = useDerivedValue(
    () => engine.canvasHeight.value - padding.bottom,
  );

  return (
    <Group>
      {snapshot.map((m) => (
        <MarkerGlyph
          key={m.id}
          marker={m}
          color={m.color ?? defaultMarkerColor(m.kind, palette)}
          engine={engine}
          padding={padding}
          seriesSV={series}
          font={font}
          axisY={axisY}
        />
      ))}
    </Group>
  );
}
