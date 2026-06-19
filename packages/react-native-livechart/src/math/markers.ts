import type { LiveChartPoint, Marker, SeriesConfig } from "../types";
import { interpolateAtTime } from "./interpolate";
import { splineValueAtTime } from "./spline";

/** Screen-space position for one marker, index-aligned with the marker array. */
export interface ProjectedMarker {
  x: number;
  y: number;
  visible: boolean;
  /** Collapsed cluster member that the representative stands in for — not drawn,
   *  not hit-tested. Set by the cluster pass; `false` outside `markerCluster`. */
  hidden: boolean;
  /** This marker is the representative (count badge) of a collapsed cluster. */
  isGrouped: boolean;
  /** Size of the collapsed cluster this marker represents (`0` when not grouped). */
  groupCount: number;
  /** Index of the cluster's representative marker for collapsed members (and the
   *  representative itself), else `-1`. Used to gather members on tap. */
  groupRep: number;
}

export interface ProjectMarkersOpts {
  canvasWidth: number;
  canvasHeight: number;
  padTop: number;
  padBottom: number;
  padLeft: number;
  padRight: number;
  timestamp: number;
  displayWindow: number;
  displayMin: number;
  displayMax: number;
  /** Multi-series data, used to anchor markers by `seriesId`. */
  series?: SeriesConfig[];
  /** Single-series line data; anchors markers that omit `value` (and `seriesId`). */
  lineData?: LiveChartPoint[];
  /** When the single-series line is drawn with `line.curve === "linear"`, anchor
   *  `lineData` markers on the straight chord (linear interpolation) instead of the
   *  monotone spline so the glyph sits exactly on the rendered line. Multi-series
   *  markers read their curve per-series from {@link SeriesConfig.curve}. */
  lineLinear?: boolean;
}

/** How far off-chart (px) a marker may sit before it is culled. */
const CULL_MARGIN = 24;

/**
 * Project one marker (given its primitive anchor fields) into `target`,
 * without allocation. Primitives only, so per-glyph worklet closures don't
 * capture the full `Marker` (which may carry non-serializable `data`/`image`).
 */
function projectInto(
  time: number,
  value: number | undefined,
  seriesId: string | undefined,
  opts: ProjectMarkersOpts,
  target: ProjectedMarker,
): void {
  "worklet";
  // Reset cluster fields so a reused buffer slot defaults to un-clustered; the
  // cluster pass (when it runs) overwrites them. Lets anchored mode skip the pass.
  target.hidden = false;
  target.isGrouped = false;
  target.groupCount = 0;
  target.groupRep = -1;
  const w = opts.canvasWidth;
  const h = opts.canvasHeight;
  const chartLeft = opts.padLeft;
  const chartRight = w - opts.padRight;
  const chartW = chartRight - chartLeft;
  const chartTop = opts.padTop;
  const chartBottom = h - opts.padBottom;
  const chartH = chartBottom - chartTop;
  const valRange = opts.displayMax - opts.displayMin;
  if (
    w === 0 ||
    h === 0 ||
    chartW <= 0 ||
    opts.displayWindow <= 0 ||
    valRange <= 0
  ) {
    target.visible = false;
    return;
  }
  let v: number | null = null;
  if (value !== undefined) {
    v = value;
  } else if (seriesId !== undefined && opts.series) {
    for (let j = 0; j < opts.series.length; j++) {
      if (opts.series[j].id === seriesId) {
        // Anchor on the same interpolation the series is rendered with, so the
        // glyph sits exactly on the line: the linear chord for `curve: "linear"`,
        // the monotone spline otherwise.
        v =
          opts.series[j].curve === "linear"
            ? interpolateAtTime(opts.series[j].data, time)
            : splineValueAtTime(opts.series[j].data, time);
        break;
      }
    }
  } else if (opts.lineData) {
    // Single-series anchor: omit `value` to pin the marker to the line at `time`.
    // Match the rendered curve — straight chord when `line.curve === "linear"`,
    // the monotone spline otherwise.
    v = opts.lineLinear
      ? interpolateAtTime(opts.lineData, time)
      : splineValueAtTime(opts.lineData, time);
  }
  if (v === null) {
    target.visible = false;
    return;
  }
  const winStart = opts.timestamp - opts.displayWindow;
  const x = chartLeft + ((time - winStart) / opts.displayWindow) * chartW;
  const y = chartTop + ((opts.displayMax - v) / valRange) * chartH;
  target.x = x;
  target.y = y;
  target.visible =
    x >= chartLeft - CULL_MARGIN &&
    x <= chartRight + CULL_MARGIN &&
    y >= chartTop - CULL_MARGIN &&
    y <= chartBottom + CULL_MARGIN;
}

/**
 * Project markers to screen positions, mutating `out` in place (reused buffer).
 * y comes from `value` (absolute) or, failing that, from interpolating the
 * `seriesId` series' data at the marker's time. Returns `out`.
 */
export function projectMarkers(
  markers: Marker[],
  out: ProjectedMarker[],
  opts: ProjectMarkersOpts,
): ProjectedMarker[] {
  "worklet";
  out.length = markers.length;
  for (let i = 0; i < markers.length; i++) {
    let cur = out[i];
    if (!cur) {
      cur = {
        x: 0,
        y: 0,
        visible: false,
        hidden: false,
        isGrouped: false,
        groupCount: 0,
        groupRep: -1,
      };
      out[i] = cur;
    }
    const m = markers[i];
    projectInto(m.time, m.value, m.seriesId, opts, cur);
  }
  return out;
}

/**
 * Project a single marker by its anchor fields, returning a fresh
 * `ProjectedMarker`. Used per-glyph at render so each glyph owns its position
 * (no shared index buffer → no flicker when the marker array reorders).
 */
export function projectPoint(
  time: number,
  value: number | undefined,
  seriesId: string | undefined,
  opts: ProjectMarkersOpts,
): ProjectedMarker {
  "worklet";
  const target: ProjectedMarker = {
    x: 0,
    y: 0,
    visible: false,
    hidden: false,
    isGrouped: false,
    groupCount: 0,
    groupRep: -1,
  };
  projectInto(time, value, seriesId, opts, target);
  return target;
}

/** Stable signature over marker id / kind / color / icon / size / image-presence
 *  (snapshot sync, not per-tick). */
export function markersSignature(markers: Marker[]): string {
  "worklet";
  let out = "";
  for (let i = 0; i < markers.length; i++) {
    if (i > 0) out += "\x1e";
    const m = markers[i];
    out += `${m.id}\x1f${m.kind}\x1f${m.color ?? ""}\x1f${m.icon ?? ""}\x1f${m.size ?? ""}\x1f${m.image ? 1 : 0}`;
  }
  return out;
}

/**
 * Index of the nearest visible marker within `radius` px of `(x, y)`, or `-1`.
 * Ties resolve to the later index (drawn on top).
 */
export function nearestMarkerIndex(
  positions: ProjectedMarker[],
  x: number,
  y: number,
  radius: number,
): number {
  "worklet";
  let best = -1;
  let bestD = radius * radius;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    if (!p.visible || p.hidden) continue;
    const dx = p.x - x;
    const dy = p.y - y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
