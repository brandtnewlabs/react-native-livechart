import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { CandlePoint } from "../types";
import {
  visibleMaxVolume,
  volumeEndIndex,
  volumeStartIndex,
} from "../draw/volumeRange";

/**
 * Primitive index outputs suppress downstream scans while the window glides
 * within the same buckets. The maximum also depends directly on candles, so
 * every notified data revision (including same-length replacement or modify)
 * invalidates it. Array length and object identity are never cache keys.
 */
export function useVolumeRange(
  candles: SharedValue<CandlePoint[]> | undefined,
  timestamp: SharedValue<number>,
  window: SharedValue<number>,
  width: SharedValue<number>,
  active: boolean,
) {
  const start = useDerivedValue(() =>
    !active || !candles
      ? 0
      : volumeStartIndex(
          candles.get(),
          timestamp.get() - window.get(),
          width.get(),
        ),
  );
  const end = useDerivedValue(() =>
    !active || !candles ? 0 : volumeEndIndex(candles.get(), timestamp.get()),
  );
  const max = useDerivedValue(() =>
    !active || !candles
      ? 0
      : visibleMaxVolume(candles.get(), start.get(), end.get()),
  );
  return { start, end, max };
}
