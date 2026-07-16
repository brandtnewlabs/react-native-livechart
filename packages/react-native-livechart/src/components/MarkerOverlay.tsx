import {
  Atlas,
  Group,
  Path,
  Skia,
  type SkFont,
  type SkRect,
  type SkRSXform,
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
  BADGE_TEXT_SCALE,
  buildMarkerAtlas,
  defaultMarkerColor,
  GROUP_BADGE_SIG,
  groupBgSig,
  groupCountText,
  groupCountTextWidth,
  groupGlyphSig,
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
import {
  clusterMarkers,
  type ResolvedMarkerCluster,
} from "../math/markerCluster";
import type {
  LiveChartPalette,
  LiveChartPoint,
  Marker,
  MarkerRenderContext,
  SeriesConfig,
} from "../types";

const OFF = -9999;

/** Size of the `showGroupCount` corner badge relative to a full count badge. */
const GROUP_CORNER_SCALE = 0.62;
/** How far the corner count badge sits toward the glyph's top-right corner
 *  (1 = centered exactly on the corner; < 1 pulls it inward). */
const GROUP_CORNER_INSET = 0.82;

/**
 * Append a collapsed-cluster count badge (round bg + centered, proportionally
 * laid-out digits) to the atlas blit lists at `(cx, cy)`, scaled by `mul` — full
 * size as the default group badge, shrunk in a glyph's corner for `showGroupCount`.
 *
 * A **module-level** worklet (not a closure inside the per-frame derived value):
 * the `transforms` / `sprites` arrays are passed in by reference so the pushes land
 * on the real per-frame lists. A nested `"worklet"` closure would capture them by
 * serialized copy, so its pushes would be silently dropped and the badge never drawn.
 */
function pushGroupCountBadge(
  transforms: SkRSXform[],
  sprites: SkRect[],
  cells: Record<string, AtlasCell>,
  digitWidths: Record<string, number>,
  invScale: number,
  cx: number,
  cy: number,
  repColor: string,
  count: number,
  mul: number,
  letterSpacing: number,
): void {
  "worklet";
  const text = groupCountText(count);
  const bg = cells[groupBgSig(repColor)];
  if (bg) {
    transforms.push(
      Skia.RSXform(invScale * mul, 0, cx - (bg.w * mul) / 2, cy - (bg.h * mul) / 2),
    );
    sprites.push(bg.rect);
  }
  // Lay digits out proportionally (each by its own ink width), centered. The
  // configurable spacing is applied between glyph ink bounds, not inferred from
  // the widest digit — proportional fonts otherwise overlap narrow digits.
  const S = BADGE_TEXT_SCALE;
  const totalW = groupCountTextWidth(text, digitWidths, letterSpacing);
  let dx = cx - (totalW * mul) / 2;
  for (let c = 0; c < text.length; c++) {
    const w = (digitWidths[text[c]] ?? 0) * S * mul;
    const gc = cells[groupGlyphSig(text[c])];
    if (gc) {
      const gcx = dx + w / 2;
      transforms.push(
        Skia.RSXform(
          invScale * S * mul,
          0,
          gcx - (gc.w * S * mul) / 2,
          cy - (gc.h * S * mul) / 2,
        ),
      );
      sprites.push(gc.rect);
    }
    dx += w + letterSpacing * mul;
  }
}

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
  lineLinear,
  axisY,
}: {
  marker: Marker;
  color: string;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  seriesSV?: SharedValue<SeriesConfig[]>;
  lineDataSV?: SharedValue<LiveChartPoint[]>;
  lineLinear?: boolean;
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
      lineLinear,
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
  lineLinear,
  renderMarker,
  cluster,
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
  /** Single-series line is drawn linear — anchor `lineData` markers on the chord. */
  lineLinear?: boolean;
  /**
   * When provided, markers it returns an element for are rendered as RN views by
   * `CustomMarkerOverlay` instead — so they're excluded from the atlas here to
   * avoid a (blurry) glyph drawn behind the custom element.
   */
  renderMarker?: (marker: Marker, ctx: MarkerRenderContext) => unknown;
  /** Collision config; `"stacked"` fans/collapses co-located markers. */
  cluster: ResolvedMarkerCluster;
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

  // Ids of markers the consumer renders as custom RN views (CustomMarkerOverlay).
  // Stabilized via a string key so an inline `renderMarker` that returns the same
  // set doesn't churn `customIds`' identity (which the per-frame worklet captures).
  const customKey = useMemo(() => {
    if (!renderMarker) return "";
    let k = "";
    for (let i = 0; i < snapshot.length; i++) {
      const m = snapshot[i];
      // Detection ctx (an element-vs-null result must not depend on cluster
      // state — see CustomMarkerOverlay); the live ctx is applied there.
      const ctx: MarkerRenderContext = {
        index: i,
        isGrouped: false,
        groupCount: 0,
        side: m.side ?? "center",
      };
      if (renderMarker(m, ctx) != null) k += `${m.id}\x1f`;
    }
    return k;
  }, [snapshot, renderMarker]);
  const customIds = useMemo<Record<string, true>>(() => {
    const o: Record<string, true> = {};
    for (const id of customKey.split("\x1f")) if (id) o[id] = true;
    return o;
  }, [customKey]);

  // Rebuild the atlas image only when the set of distinct appearances or the
  // theme/font changes — never per frame. `markersSignature` already drives the
  // snapshot, so this useMemo re-runs at most at the snapshot cadence.
  const appearanceKey = useMemo(() => {
    const sigs = new Set<string>();
    for (let i = 0; i < snapshot.length; i++) {
      const m = snapshot[i];
      if (!isConnectorMarker(m) && !customIds[m.id])
        sigs.add(markerAppearanceSig(m));
    }
    return Array.from(sigs).sort().join("\x1e");
  }, [snapshot, customIds]);
  // Cells bake in resolved colors; include the palette fields they depend on.
  const paletteKey = `${palette.bgRgb.join(",")}|${palette.line}|${palette.refLine}|${palette.dotUp}|${palette.refLabel}`;
  // Rasterize at the screen's device-pixel ratio so sprites stay crisp on
  // retina canvases instead of being upscaled from a logical-sized texture.
  const dpr = PixelRatio.get();
  const clusterStacked = cluster.mode === "stacked";
  // A dedicated group badge (object form) bakes one extra atlas cell; its image
  // identity + styling drive the rebuild key alongside the marker appearances.
  const groupBadgeCfg =
    typeof cluster.groupBadge === "object" ? cluster.groupBadge : undefined;
  const groupBadgeImage = groupBadgeCfg?.image;
  const groupBadgeKey = groupBadgeCfg
    ? `${groupBadgeCfg.icon ?? ""}|${groupBadgeCfg.color ?? ""}|${groupBadgeCfg.pill ? 1 : 0}|${groupBadgeCfg.size ?? ""}|${groupBadgeCfg.letterSpacing ?? ""}`
    : "";
  const atlas = useMemo(
    () =>
      buildMarkerAtlas(
        snapshot.filter((m) => !customIds[m.id]),
        palette,
        font,
        dpr,
        clusterStacked,
        groupBadgeCfg,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appearanceKey/paletteKey/groupBadgeKey capture the inputs that change cell pixels
    [appearanceKey, paletteKey, font, dpr, clusterStacked, groupBadgeKey, groupBadgeImage],
  );
  const cells: Record<string, AtlasCell> = atlas.cells;
  const atlasImage = atlas.image;
  const digitWidths = atlas.digitWidths;
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
        lineLinear,
      });
      clusterMarkers(ms, buf, { config: cluster });
      const transforms: SkRSXform[] = [];
      const sprites: SkRect[] = [];
      for (let i = 0; i < ms.length; i++) {
        const pt = buf[i];
        // Collapsed-cluster members fold into their representative's badge.
        if (!pt.visible || pt.hidden) continue;
        const m = ms[i];
        if (isConnectorMarker(m)) continue;
        // Custom-rendered markers are floated as RN views, not drawn here.
        if (customIds[m.id]) continue;
        // Collapsed cluster. By default a round count badge; with
        // `groupBadge: "marker"` the representative marker's own glyph, or with a
        // `MarkerGroupBadge` object a dedicated baked badge — either optionally
        // carrying a corner count, all within this one `drawAtlas`.
        if (pt.isGrouped) {
          const repColor = m.color ?? defaultMarkerColor(m.kind, palette);
          const gb = cluster.groupBadge;
          // Pick the non-count glyph cell: a dedicated group badge (object form)
          // or the representative marker's own appearance.
          const glyphCell =
            typeof gb === "object" && gb !== null
              ? cells[GROUP_BADGE_SIG]
              : gb === "marker"
                ? cells[markerAppearanceSig(m)]
                : undefined;
          if (glyphCell) {
            transforms.push(
              Skia.RSXform(
                invScale,
                0,
                pt.x - glyphCell.w / 2,
                pt.y - glyphCell.h / 2,
              ),
            );
            sprites.push(glyphCell.rect);
            if (cluster.showGroupCount) {
              pushGroupCountBadge(
                transforms,
                sprites,
                cells,
                digitWidths,
                invScale,
                pt.x + (glyphCell.w / 2) * GROUP_CORNER_INSET,
                pt.y - (glyphCell.h / 2) * GROUP_CORNER_INSET,
                repColor,
                pt.groupCount,
                GROUP_CORNER_SCALE,
                groupBadgeCfg?.letterSpacing ?? 0,
              );
            }
            continue;
          }
          // Default — or fall back here when a non-count badge has no baked cell
          // (e.g. an empty group-badge config): the round count badge.
          pushGroupCountBadge(
            transforms,
            sprites,
            cells,
            digitWidths,
            invScale,
            pt.x,
            pt.y,
            repColor,
            pt.groupCount,
            1,
            groupBadgeCfg?.letterSpacing ?? 0,
          );
          continue;
        }
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
    [
      cells,
      customIds,
      invScale,
      digitWidths,
      markers,
      engine,
      padding,
      palette,
      series,
      lineData,
      lineLinear,
      cluster,
    ],
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
          lineLinear={lineLinear}
          axisY={axisY}
        />
      ))}
    </Group>
  );
}
