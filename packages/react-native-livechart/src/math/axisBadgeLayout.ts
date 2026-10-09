import { BADGE_METRICS_DEFAULTS } from "../constants";
import { badgeTailAndCap } from "../draw/line";
import type { BadgeMetrics } from "../types";

/** Horizontal price-column geometry, independent of the value's vertical position. */
export interface AxisBadgeConfig {
  float?: boolean;
  alignTextWithYAxis?: boolean;
  showTail?: boolean;
  fontSize?: number;
  metrics?: BadgeMetrics;
  offsetX?: number;
}

export function axisBadgeBounds(
  width: number,
  paddingRight: number,
  textWidth: number,
  fontSize: number,
  config?: AxisBadgeConfig,
) {
  "worklet";
  const metrics = config?.metrics ?? BADGE_METRICS_DEFAULTS;
  const right = width - metrics.marginEdge + (config?.offsetX ?? 0);
  const left = config?.float
    ? right - textWidth - 2 * metrics.padX
    : width -
      paddingRight +
      metrics.dotGap +
      badgeTailAndCap(
        config?.fontSize ?? fontSize,
        config?.showTail ?? true,
        metrics,
      ) +
      (config?.offsetX ?? 0);
  return { left, right, textX: (left + right - textWidth) / 2 };
}
