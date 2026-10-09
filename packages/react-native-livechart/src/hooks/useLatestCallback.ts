import { useCallback, useLayoutEffect, useRef } from "react";

/** Stable JS-thread dispatcher for callbacks scheduled by gesture worklets.
 * Commit the new callback in an effect; an abandoned render must not replace it.
 * Never call this dispatcher directly from the UI thread — use scheduleOnRN.
 */
export function useLatestCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
): (...args: Args) => Result {
  const latest = useRef(callback);
  useLayoutEffect(() => {
    latest.current = callback;
  }, [callback]);
  return useCallback((...args: Args) => latest.current(...args), []);
}
