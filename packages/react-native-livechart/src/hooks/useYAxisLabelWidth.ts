import type { SkFont } from "@shopify/react-native-skia";
import { useAnimatedReaction, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { widestYAxisLabelWidth, type YAxisEntry } from "../draw/grid";

/** Report the painted column width only when it changes, avoiding per-frame React work. */
export function useYAxisLabelWidth(
  entries: SharedValue<YAxisEntry[]>,
  font: SkFont,
  enabled: boolean,
  onWidthChange: (width: number | undefined) => void,
) {
  useAnimatedReaction(
    () => {
      if (!enabled) return undefined;
      const labels = entries.get();
      return labels.length > 0 ? Math.ceil(widestYAxisLabelWidth(labels, font)) : undefined;
    },
    (width, previous) => {
      if (width !== previous && (width !== undefined || previous != null)) {
        scheduleOnRN(onWidthChange, width);
      }
    },
    [entries, font, enabled, onWidthChange],
  );
}
