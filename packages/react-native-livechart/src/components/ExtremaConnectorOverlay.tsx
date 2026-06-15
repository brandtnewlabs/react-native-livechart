import { DashPathEffect, Path } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type {
  ResolvedAxisLabelConfig,
  ResolvedLineStyleConfig,
} from "../core/resolveConfig";
import type {
  ChartEngineExtrema,
  ChartEngineLayout,
} from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { usePathBuilder } from "../hooks/usePathBuilder";
import { EXTREMA_EDGE_INSET, EXTREMA_LABEL_FONT_SIZE } from "./AxisLabelOverlay";

/** How far off-plot (px) the extremum may sit before the connector is dropped. */
const CONNECTOR_CULL = 24;
/** Gap (px) between the connector's end and the value label. */
const LABEL_GAP = 3;
/** Single-line text height as a fraction of font size — a safe over-estimate, so
 *  the connector stops just shy of the label rather than running under it. */
const LABEL_HEIGHT_FACTOR = 1.5;

/** Connector style + the label font size (to estimate where the label edge is). */
export interface ResolvedConnector {
  line: ResolvedLineStyleConfig;
  fontSize: number;
}

/**
 * The connector config for one axis-label side — non-null only when it's an
 * `"extrema-edge"` label with its connector enabled. The line `color` defaults
 * to the label color (then `defaultColor`), so the connector matches its readout.
 */
export function labelConnector(
  cfg: ResolvedAxisLabelConfig | null,
  defaultColor: string,
): ResolvedConnector | null {
  if (!cfg || cfg.position !== "extrema-edge" || !cfg.connector) return null;
  return {
    line: {
      ...cfg.connector,
      color: cfg.connector.color ?? cfg.color ?? defaultColor,
    },
    fontSize: cfg.fontSize ?? EXTREMA_LABEL_FONT_SIZE,
  };
}

/** A single vertical connector from the edge value label down/up to its dot. */
function ConnectorLine({
  side,
  timeSV,
  valueSV,
  timeOffset,
  engine,
  padding,
  config,
}: {
  side: "top" | "bottom";
  timeSV: SharedValue<number>;
  valueSV: SharedValue<number>;
  timeOffset: number;
  engine: ChartEngineLayout;
  padding: ChartPadding;
  config: ResolvedConnector;
}) {
  const builder = usePathBuilder();
  const { line, fontSize } = config;

  const path = useDerivedValue(() => {
    const b = builder.value;
    const value = valueSV.get();
    const time = timeSV.get();
    const cw = engine.canvasWidth.get();
    const ch = engine.canvasHeight.get();
    const displayMin = engine.displayMin.get();
    const displayMax = engine.displayMax.get();
    const win = engine.displayWindow.get();
    const ts = engine.timestamp.get();

    const chartLeft = padding.left;
    const chartRight = cw - padding.right;
    const chartW = chartRight - chartLeft;
    const chartTop = padding.top;
    const chartBottom = ch - padding.bottom;
    const chartH = chartBottom - chartTop;
    const valRange = displayMax - displayMin;

    if (
      !Number.isFinite(value) ||
      cw === 0 ||
      ch === 0 ||
      chartW <= 0 ||
      chartH <= 0 ||
      win <= 0 ||
      valRange <= 0
    ) {
      return b.detach();
    }

    const winStart = ts - win;
    const px = chartLeft + ((time + timeOffset - winStart) / win) * chartW;
    // Off-plot (scrolled out) — emit nothing this frame.
    if (px < chartLeft - CONNECTOR_CULL || px > chartRight + CONNECTOR_CULL) {
      return b.detach();
    }
    const py = chartTop + ((displayMax - value) / valRange) * chartH;

    // Stop the line just shy of the value label (which sits on the rail), not at
    // the plot edge — so it never runs through the text. The label's inner edge
    // is estimated from its font height (the label measures itself in RN; an
    // over-estimate keeps a clean gap). Skip when the dot is inside the band.
    const band = fontSize * LABEL_HEIGHT_FACTOR;
    if (side === "top") {
      const edgeY = EXTREMA_EDGE_INSET + band + LABEL_GAP;
      if (py <= edgeY) return b.detach();
      b.moveTo(px, edgeY);
      b.lineTo(px, py);
    } else {
      const edgeY = chartBottom - band - LABEL_GAP;
      if (py >= edgeY) return b.detach();
      b.moveTo(px, py);
      b.lineTo(px, edgeY);
    }
    return b.detach();
  });

  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={line.strokeWidth}
      color={line.color}
    >
      {line.intervals ? <DashPathEffect intervals={line.intervals} /> : null}
    </Path>
  );
}

/**
 * Skia connector lines for `"extrema-edge"` axis labels — a vertical line at the
 * extremum's x joining its edge value label to the marker dot on the data point.
 * Drawn in the canvas (so it dashes "like all lines"); the dot + label are RN
 * overlays positioned with the same projection, so the three pieces line up. The
 * line stops at the label edge, not the plot edge, so it never crosses the text.
 *
 * `top` / `bottom` are non-null only for a side in `"extrema-edge"` mode with its
 * connector enabled.
 */
export function ExtremaConnectorOverlay({
  engine,
  padding,
  extremaTimeOffset = 0,
  top,
  bottom,
}: {
  engine: ChartEngineLayout & Partial<ChartEngineExtrema>;
  padding: ChartPadding;
  extremaTimeOffset?: number;
  top: ResolvedConnector | null;
  bottom: ResolvedConnector | null;
}) {
  const hasTop = top != null && engine.extremaMaxTime != null;
  const hasBottom = bottom != null && engine.extremaMinTime != null;
  if (!hasTop && !hasBottom) return null;

  return (
    <>
      {hasTop && (
        <ConnectorLine
          side="top"
          timeSV={engine.extremaMaxTime!}
          valueSV={engine.extremaMaxValue!}
          timeOffset={extremaTimeOffset}
          engine={engine}
          padding={padding}
          config={top!}
        />
      )}
      {hasBottom && (
        <ConnectorLine
          side="bottom"
          timeSV={engine.extremaMinTime!}
          valueSV={engine.extremaMinValue!}
          timeOffset={extremaTimeOffset}
          engine={engine}
          padding={padding}
          config={bottom!}
        />
      )}
    </>
  );
}
