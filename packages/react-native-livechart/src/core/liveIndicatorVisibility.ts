import type { TimeScrollConfig } from "../types";

/**
 * Resolve whether historical time-scroll views should suppress indicators that
 * still point at the live price.
 */
export function resolveHideLiveOnScrollBack(
  timeScroll: boolean | TimeScrollConfig | undefined,
  followViewEdge: boolean,
): boolean {
  const hide =
    typeof timeScroll === "object"
      ? (timeScroll.hideLiveOnScrollBack ?? true)
      : true;
  return hide && !followViewEdge;
}

/** Worklet-safe opacity gate shared by the live badge, dot, and dashed value line. */
export function liveIndicatorScrollOpacity(
  hideLiveOnScrollBack: boolean,
  viewEnd: number | null,
): 0 | 1 {
  "worklet";
  return hideLiveOnScrollBack && viewEnd != null ? 0 : 1;
}
