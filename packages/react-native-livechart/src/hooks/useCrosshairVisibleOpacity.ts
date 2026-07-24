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
  active: SharedValue<number> | SharedValue<boolean> | undefined,
  fade: boolean,
) {
  return useDerivedValue(
    () => {
      if (fade) return edgeOpacity.get();
      if (active === undefined) return edgeOpacity.get() > 0 ? 1 : 0;
      return active.get() ? 1 : 0;
    },
    [fade, edgeOpacity, active],
  );
}
