import {
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import { computeCrosshairOpacity } from "./crosshairShared";

/**
 * Opacity for the visible crosshair UI. The trailing-content dim keeps using
 * the edge-faded opacity directly, independent of this setting.
 */
export function useCrosshairVisibleOpacity(
  scrubX: SharedValue<number>,
  canvasWidth: SharedValue<number>,
  paddingRight: number,
  active: SharedValue<number> | SharedValue<boolean>,
  fade: boolean,
  fadeDistance = 4,
) {
  return useDerivedValue(
    () =>
      resolveCrosshairVisibleOpacity(
        Boolean(active.get()),
        scrubX.get(),
        canvasWidth.get(),
        paddingRight,
        fade,
        fadeDistance,
      ),
    [
      scrubX,
      canvasWidth,
      paddingRight,
      active,
      fade,
      fadeDistance,
    ],
  );
}

export function resolveCrosshairVisibleOpacity(
  active: boolean,
  scrubX: number,
  canvasWidth: number,
  paddingRight: number,
  fade: boolean,
  fadeDistance = 4,
): number {
  "worklet";
  if (!fade) return active ? 1 : 0;
  return computeCrosshairOpacity(
    active,
    scrubX,
    canvasWidth,
    paddingRight,
    fadeDistance,
  );
}
