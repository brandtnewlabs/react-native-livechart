import { type SkFont } from "@shopify/react-native-skia";
import { Platform } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { type ChartPadding } from "../draw/line";
import { interpolateAtTime } from "../math/interpolate";
import { measureFontTextWidth } from "../measureFontTextWidth";
import type { LivelinePalette, ScrubPoint } from "../types";
import type { EngineState } from "../useLivelineEngine";

const TOOLTIP_PAD_X = 8;
const TOOLTIP_PAD_Y = 6;
const TOOLTIP_LINE_GAP = 4;
const FADE_ZONE = 4;

export interface TooltipLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  valueStr: string;
  timeStr: string;
  valueTextX: number;
  timeTextX: number;
  line1Y: number;
  line2Y: number;
}

const HIDDEN_TOOLTIP: TooltipLayout = {
  x: -400,
  y: 0,
  w: 0,
  h: 0,
  valueStr: "",
  timeStr: "",
  valueTextX: -400,
  timeTextX: -400,
  line1Y: 0,
  line2Y: 0,
};

export interface CrosshairState {
  scrubX: SharedValue<number>;
  scrubActive: SharedValue<boolean>;
  scrubTime: SharedValue<number>;
  scrubValue: SharedValue<number | null>;
  crosshairOpacity: SharedValue<number>;
  tooltipLayout: SharedValue<TooltipLayout>;
  gesture: ReturnType<typeof Gesture.Pan>;
}

export type { ScrubPoint };

/**
 * Maps a scrub X position to a window timestamp.
 * Returns -1 when inactive or when the canvas is not yet laid out.
 */
export function computeScrubTime(
  scrubActive: boolean,
  scrubX: number,
  padding: ChartPadding,
  canvasWidth: number,
  timestamp: number,
  windowSecs: number,
): number {
  "worklet";
  if (!scrubActive) return -1;
  const chartW = canvasWidth - padding.left - padding.right;
  if (chartW <= 0) return -1;
  const winStart = timestamp - windowSecs;
  const fraction = (scrubX - padding.left) / chartW;
  return winStart + fraction * windowSecs;
}

/**
 * Crosshair opacity: fades 1→0 over FADE_ZONE px as the crosshair
 * approaches the live dot at the right chart edge.
 */
export function computeCrosshairOpacity(
  scrubActive: boolean,
  scrubX: number,
  canvasWidth: number,
  paddingRight: number,
): number {
  "worklet";
  if (!scrubActive) return 0;
  const dotX = canvasWidth - paddingRight;
  const dist = dotX - scrubX;
  return Math.min(1, Math.max(0, dist / FADE_ZONE));
}

/**
 * Full tooltip pill layout. Returns HIDDEN_TOOLTIP when the scrub is
 * inactive or no value can be interpolated at the current time.
 */
export function computeTooltipLayout(
  scrubActive: boolean,
  scrubX: number,
  scrubValue: number | null,
  scrubTime: number,
  padding: ChartPadding,
  canvasWidth: number,
  formatValue: (v: number) => string,
  formatTime: (t: number) => string,
  font: SkFont,
): TooltipLayout {
  "worklet";
  if (!scrubActive || scrubValue === null) return HIDDEN_TOOLTIP;

  const v = scrubValue;
  const t = scrubTime;
  const valueStr = formatValue(v);
  const timeStr = formatTime(t);

  const fm = font.getMetrics();
  // ascent is negative in Skia; lineH = visual cap height + descent
  const lineH = -fm.ascent + fm.descent;
  const totalH = TOOLTIP_PAD_Y * 2 + lineH * 2 + TOOLTIP_LINE_GAP;

  const valueW = measureFontTextWidth(font, valueStr);
  const timeW = measureFontTextWidth(font, timeStr);
  const contentW = Math.max(valueW, timeW);
  const pillW = contentW + TOOLTIP_PAD_X * 2;

  const rightEdge = canvasWidth - padding.right;

  // Flip to the left when the pill would overflow the right chart edge
  let pillX = scrubX + 12;
  if (pillX + pillW > rightEdge - 4) {
    pillX = scrubX - pillW - 12;
  }
  const pillY = padding.top + 8;

  // Baseline Y for each line (Skia Text y = baseline)
  const line1Y = pillY + TOOLTIP_PAD_Y - fm.ascent;
  const line2Y = line1Y + lineH + TOOLTIP_LINE_GAP;

  // Center each text string horizontally inside the pill
  const valueTextX = pillX + TOOLTIP_PAD_X + (contentW - valueW) / 2;
  const timeTextX = pillX + TOOLTIP_PAD_X + (contentW - timeW) / 2;

  return {
    x: pillX,
    y: pillY,
    w: pillW,
    h: totalH,
    valueStr,
    timeStr,
    valueTextX,
    timeTextX,
    line1Y,
    line2Y,
  };
}

export function useCrosshair(
  engine: EngineState,
  padding: ChartPadding,
  _palette: LivelinePalette,
  formatValue: (v: number) => string,
  formatTime: (t: number) => string,
  font: SkFont,
  enabled: boolean,
  onScrub?: (point: ScrubPoint | null) => void,
): CrosshairState {
  const scrubX = useSharedValue(-1);
  const scrubActive = useSharedValue(false);

  // Map scrub X position → window time
  const scrubTime = useDerivedValue(() =>
    computeScrubTime(
      scrubActive.value,
      scrubX.value,
      padding,
      engine.canvasWidth.value,
      engine.timestamp.value,
      engine.displayWindow.value,
    ),
  );

  // Binary-search interpolated value at the scrub time
  const scrubValue = useDerivedValue(() => {
    if (!scrubActive.value || scrubTime.value < 0) return null;
    return interpolateAtTime(engine.data.value, scrubTime.value);
  });

  // Fades 1→0 as crosshair approaches the live dot at the right edge
  const crosshairOpacity = useDerivedValue(() =>
    computeCrosshairOpacity(
      scrubActive.value,
      scrubX.value,
      engine.canvasWidth.value,
      padding.right,
    ),
  );

  // Full tooltip pill geometry + text strings computed in one derived value
  const tooltipLayout = useDerivedValue(() =>
    computeTooltipLayout(
      scrubActive.value,
      scrubX.value,
      scrubValue.value,
      scrubTime.value,
      padding,
      engine.canvasWidth.value,
      formatValue,
      formatTime,
      font,
    ),
  );

  // JS-thread callbacks — called via runOnJS from the gesture worklet
  function handleScrub(x: number, y: number, time: number, value: number) {
    onScrub?.({ time, value, x, y });
  }

  function handleScrubEnd() {
    onScrub?.(null);
  }

  const hasOnScrub = onScrub != null;

  let gesture = Gesture.Pan()
    .minDistance(Platform.OS === "android" ? 10 : 0)
    .activateAfterLongPress(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => {
      "worklet";
      if (!enabled) return;
      scrubX.value = e.x;
      scrubActive.value = true;
    })
    .onUpdate((e) => {
      "worklet";
      if (!enabled) return;
      scrubX.value = e.x;

      if (hasOnScrub) {
        const now = engine.timestamp.value;
        const windowSecs = engine.displayWindow.value;
        const chartW = engine.canvasWidth.value - padding.left - padding.right;
        if (chartW > 0) {
          const winStart = now - windowSecs;
          const fraction = (e.x - padding.left) / chartW;
          const time = winStart + fraction * windowSecs;
          const value = interpolateAtTime(engine.data.value, time);
          if (value !== null) {
            const h = engine.canvasHeight.value;
            const chartH = h - padding.top - padding.bottom;
            const valRange = engine.displayMax.value - engine.displayMin.value;
            const dotY =
              valRange === 0
                ? padding.top + chartH / 2
                : padding.top +
                  ((engine.displayMax.value - value) / valRange) * chartH;
            runOnJS(handleScrub)(e.x, dotY, time, value);
          }
        }
      }
    })
    .onFinalize(() => {
      "worklet";
      scrubActive.value = false;
      if (hasOnScrub) runOnJS(handleScrubEnd)();
    });

  // Android needs explicit axis offsets to avoid conflicting with scroll views
  if (Platform.OS === "android") {
    gesture = gesture.activeOffsetX([-25, 25]).failOffsetY([-25, 25]);
  }

  return {
    scrubX,
    scrubActive,
    scrubTime,
    scrubValue,
    crosshairOpacity,
    tooltipLayout,
    gesture,
  };
}
