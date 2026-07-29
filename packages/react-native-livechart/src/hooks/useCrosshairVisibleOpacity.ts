import {
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Opacity for the visible crosshair UI. The trailing-content dim keeps using
 * the edge-faded opacity directly, independent of this setting.
 */
export function useCrosshairVisibleOpacity(
  edgeOpacity: SharedValue<number>,
  active: SharedValue<number> | SharedValue<boolean>,
  fade: boolean,
) {
  return useDerivedValue(
    () =>
      resolveCrosshairVisibleOpacity(
        edgeOpacity.get(),
        Boolean(active.get()),
        fade,
      ),
    [fade, edgeOpacity, active],
  );
}

export function resolveCrosshairVisibleOpacity(
  edgeOpacity: number,
  active: boolean,
  fade: boolean,
): number {
  "worklet";
  if (fade) return edgeOpacity;
  return active ? 1 : 0;
}
