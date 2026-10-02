import { useEffect, useState } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import type { HistoryRevision } from "./historyRangeCache";

// Reanimated's mapper IDs are positive. Separate IDs also let multiple charts
// subscribe to the same feed without replacing each other's listeners.
let nextHistoryListenerId = -1;

/** Invalidate synchronously: a frame can run before derived mappers flush. */
export function useHistoryRevision<T>(
  data: SharedValue<T[]> | undefined,
  source: SharedValue<T[]> | undefined = data,
): SharedValue<HistoryRevision<T> | undefined> {
  const revision = useSharedValue<HistoryRevision<T> | undefined>(undefined);
  const [listenerId] = useState(() => nextHistoryListenerId--);
  useEffect(() => {
    scheduleOnUI(() => {
      "worklet";
      const refresh = () => {
        "worklet";
        revision.set({ data: data?.get() ?? [] });
      };
      data?.addListener(listenerId, refresh);
      if (source !== data) source?.addListener(listenerId, refresh);
      refresh();
    });
    return () =>
      scheduleOnUI(() => {
        "worklet";
        data?.removeListener(listenerId);
        if (source !== data) source?.removeListener(listenerId);
      });
  }, [data, source, revision, listenerId]);
  return revision;
}
