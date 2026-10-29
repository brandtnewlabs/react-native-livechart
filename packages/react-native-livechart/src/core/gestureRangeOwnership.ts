import { useLayoutEffect, useState } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";

import type { ChartScale } from "../types";

type PriceRange = Pick<ChartScale, "min" | "max"> | null;

// Keep separate from Reanimated's positive mapper IDs and history listener IDs.
let nextRangeListenerId = -1_000_000;

/**
 * App writes relinquish ownership synchronously, including modify() calls and
 * writes followed by a reset in the same worklet. Replacing the supplied range
 * also relinquishes ownership before the new viewport is painted.
 */
export function useGestureRangeOwnership(range: SharedValue<PriceRange>) {
  const owned = useSharedValue(false);
  const [listenerId] = useState(() => nextRangeListenerId--);
  useLayoutEffect(() => {
    scheduleOnUI(() => {
      "worklet";
      owned.set(false);
      range.addListener(listenerId, () => {
        "worklet";
        owned.set(false);
      });
    });
    return () => scheduleOnUI(() => {
      "worklet";
      range.removeListener(listenerId);
    });
  }, [range, owned, listenerId]);
  return owned;
}

/** Mark only this write as gesture-owned, after synchronous listeners run. */
export function writeGestureRange(
  range: SharedValue<PriceRange>,
  owned: SharedValue<boolean>,
  next: Exclude<PriceRange, null>,
): void {
  "worklet";
  range.value = next;
  owned.value = true;
}
