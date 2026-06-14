import {
  Atlas,
  Group,
  Path,
  Skia,
  type SkFont,
} from "@shopify/react-native-skia";
import { useMemo, useRef, useState } from "react";
import { PixelRatio } from "react-native";
import {
  useDerivedValue,
  useAnimatedReaction,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { usePathBuilder } from "../hooks/usePathBuilder";
import {
  buildMarkerAtlas,
  defaultMarkerColor,
  isConnectorMarker,
  markerAppearanceSig,
  type AtlasCell,
} from "../draw/markerAtlas";
import {
  markersSignature,
  projectMarkers,
  projectPoint,
  type ProjectedMarker,
} from "../math/markers";
import type {
  LiveChartPalette,
  LiveChartPoint,
  Marker,
  SeriesConfig,
} from "../types";

const OFF = -9999;

/**
 * Self-projecting fallback for the axis-anchored kinds (graduation stem + flag,
 * clawback box) that can't be fixed-size atlas sprites. Rare, so the per-glyph
 * worklet cost here is negligible; each glyph still projects its OWN marker so
 * reordering the array can't make it flash another marker's position.
 */
function ConnectorGlyph({
  marker,
  color,
  engine,
  padding,
  seriesSV,
  lineDataSV,
  axisY,
}: {
  marker: Marker;
  color: string;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  seriesSV?: SharedValue<SeriesConfig[]>;
  lineDataSV?: SharedValue<LiveChartPoint[]>;
  axisY: SharedValue<number>;
}) {
  const { kind } = marker;
  const time = marker.time;
  const value = marker.value;
  const seriesId = marker.seriesId;

  const layout = useDerivedValue(() =>
    projectPoint(time, value, seriesId, {
      canvasWidth: engine.canvasWidth.get(),
      canvasHeight: engine.canvasHeight.get(),
      padTop: padding.top,
      padBottom: padding.bottom,
      padLeft: padding.left,
      padRight: padding.right,
      timestamp: engine.timestamp.get(),
      displayWindow: engine.displayWindow.get(),
      displayMin: engine.displayMin.get(),
      displayMax: engine.displayMax.get(),
      series: seriesSV?.get(),
      lineData: lineDataSV?.get(),
    }),
  );

  const opacity = useDerivedValue(() => (layout.get().visible ? 1 : 0));

  const glyphBuilder = usePathBuilder();

  const glyphPath = useDerivedValue(() => {
    const b = glyphBuilder.value;
    const l = layout.get();
    if (l.visible) {
      const x = l.x;
      const y = l.y;
      if (kind === "graduation") {
        b.moveTo(x, axisY.get());
        b.lineTo(x, y);
        b.moveTo(x, y - 7);
        b.lineTo(x + 8, y - 4);
        b.lineTo(x, y - 1);
        b.close();
      } else if (kind === "clawback") {
        const s = 5;
        const ay = axisY.get() - s;
        b.moveTo(x - s, ay);
        b.lineTo(x + s, ay);
        b.lineTo(x + s, ay + s * 2);
        b.lineTo(x - s, ay + s * 2);
        b.close();
      }
    }
    return b.detach();
  });

  const fill = kind === "clawback";
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
 * Renders the `markers` SharedValue as canvas glyphs.
 *
 * Every "stamp" glyph (icon, pill, image, and the trade/winner/boost shapes) is
 * pre-rasterized once per distinct appearance into a single packed atlas image,
 * then drawn each frame with ONE `drawAtlas` call driven by a single worklet —
 * so per-frame UI-thread cost is O(1) mappers + one draw, not O(markers × ~9
 * derived values + N Skia subtrees). Axis-anchored kinds (graduation/clawback)
 * fall back to `ConnectorGlyph`.
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
  lineData,
}: {
  markers: SharedValue<Marker[]>;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  palette: LiveChartPalette;
  font: SkFont;
  /** Multi-series data, used to anchor markers by `seriesId`. */
  series?: SharedValue<SeriesConfig[]>;
  /** Single-series line data; anchors markers that omit `value`. */
  lineData?: SharedValue<LiveChartPoint[]>;
}) {
  // Seed from the current markers at mount; the reaction below keeps it in sync.
  const [snapshot, setSnapshot] = useState<Marker[]>(() => markers.get().slice());

  // Read the `markers` prop from closure rather than a SharedValue passed
  // through `scheduleOnRN` (which loses `.get()`); mirrors the data model.
  const pull = () => {
    setSnapshot(markers.get().slice());
  };

  useAnimatedReaction(
    () => markersSignature(markers.get()),
    /* istanbul ignore next -- scheduleOnRN from UI-thread reaction */
    (sig, prev) => {
      if (sig !== prev) scheduleOnRN(pull);
    },
    [markers, pull],
  );

  // Rebuild the atlas image only when the set of distinct appearances or the
  // theme/font changes — never per frame. `markersSignature` already drives the
  // snapshot, so this useMemo re-runs at most at the snapshot cadence.
  const appearanceKey = useMemo(() => {
    const sigs = new Set<string>();
    for (let i = 0; i < snapshot.length; i++) {
      const m = snapshot[i];
      if (!isConnectorMarker(m)) sigs.add(markerAppearanceSig(m));
    }
    return Array.from(sigs).sort().join("\x1e");
  }, [snapshot]);
  // Cells bake in resolved colors; include the palette fields they depend on.
  const paletteKey = `${palette.bgRgb.join(",")}|${palette.line}|${palette.refLine}|${palette.dotUp}|${palette.refLabel}`;
  // Rasterize at the screen's device-pixel ratio so sprites stay crisp on
  // retina canvases instead of being upscaled from a logical-sized texture.
  const dpr = PixelRatio.get();
  const atlas = useMemo(
    () => buildMarkerAtlas(snapshot, palette, font, dpr),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appearanceKey/paletteKey capture the inputs that change cell pixels
    [appearanceKey, paletteKey, font, dpr],
  );
  const cells: Record<string, AtlasCell> = atlas.cells;
  const atlasImage = atlas.image;
  // Inverse of the texture's device-pixel scale; shrinks each hi-res cell back
  // to its logical on-canvas size in the per-frame blit.
  const invScale = 1 / atlas.scale;

  // One pooled, ping-ponged projection buffer reused every frame (no per-frame
  // array allocation for the projection itself).
  const projRef = useRef<{
    a: ProjectedMarker[];
    b: ProjectedMarker[];
    tick: boolean;
  } | null>(null);
  if (projRef.current === null) {
    projRef.current = { a: [], b: [], tick: false };
  }

  // Single per-frame worklet: project all markers, then emit a transform +
  // source rect for each visible atlas marker. Three mappers total regardless
  // of marker count (this + the two thin readers below).
  const atlasData = useDerivedValue(
    () => {
      const ms = markers.get();
      const proj = projRef.current!;
      proj.tick = !proj.tick;
      const buf = proj.tick ? proj.a : proj.b;
      projectMarkers(ms, buf, {
        canvasWidth: engine.canvasWidth.get(),
        canvasHeight: engine.canvasHeight.get(),
        padTop: padding.top,
        padBottom: padding.bottom,
        padLeft: padding.left,
        padRight: padding.right,
        timestamp: engine.timestamp.get(),
        displayWindow: engine.displayWindow.get(),
        displayMin: engine.displayMin.get(),
        displayMax: engine.displayMax.get(),
        series: series?.get(),
        lineData: lineData?.get(),
      });
      const transforms = [];
      const sprites = [];
      for (let i = 0; i < ms.length; i++) {
        const pt = buf[i];
        if (!pt.visible) continue;
        const m = ms[i];
        if (isConnectorMarker(m)) continue;
        const cell = cells[markerAppearanceSig(m)];
        if (!cell) continue;
        // Center the cell on the projected point. The cell's source rect is in
        // device pixels, so scale by 1/dpr to land it at its logical size.
        transforms.push(
          Skia.RSXform(invScale, 0, pt.x - cell.w / 2, pt.y - cell.h / 2),
        );
        sprites.push(cell.rect);
      }
      return { transforms, sprites };
    },
    [cells, invScale, markers, engine, padding, series, lineData],
  );
  const transforms = useDerivedValue(() => atlasData.get().transforms, [atlasData]);
  const sprites = useDerivedValue(() => atlasData.get().sprites, [atlasData]);

  const axisY = useDerivedValue(
    () => engine.canvasHeight.get() - padding.bottom,
  );

  const connectors = snapshot.filter(isConnectorMarker);

  return (
    <Group>
      {atlasImage && (
        <Atlas image={atlasImage} sprites={sprites} transforms={transforms} />
      )}
      {connectors.map((m) => (
        <ConnectorGlyph
          key={m.id}
          marker={m}
          color={m.color ?? defaultMarkerColor(m.kind, palette)}
          engine={engine}
          padding={padding}
          seriesSV={series}
          lineDataSV={lineData}
          axisY={axisY}
        />
      ))}
    </Group>
  );
}
