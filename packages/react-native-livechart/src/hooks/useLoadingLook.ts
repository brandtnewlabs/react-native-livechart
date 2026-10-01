import { useState } from "react";

import type { ResolvedLoadingConfig } from "../core/resolveConfig";

/** Field by field, with `Object.is` (a `NaN` must equal itself, or the render
 * below would never settle), over every field the config has. */
function sameLook(a: ResolvedLoadingConfig, b: ResolvedLoadingConfig | null) {
  if (b === null) return false;
  const keys = Object.keys(a) as (keyof ResolvedLoadingConfig)[];
  return keys.every((key) => Object.is(a[key], b[key]));
}

/**
 * The loading shell's look: the live `loading` config while loading, and the
 * last one after. The shell fades out and the reveal morph melts its squiggle
 * into the line only once `loading` has turned off, when `resolveLoading`
 * already returns `null` — so they would otherwise snap to the default color,
 * stroke, wave and Y-axis placeholders just as the data arrives. The empty
 * shell ("No data") shown later keeps it too; before any loading, it has none
 * and the defaults apply.
 */
export function useLoadingLook(
  loadingCfg: ResolvedLoadingConfig | null,
): ResolvedLoadingConfig | null {
  const [last, setLast] = useState(loadingCfg);
  // Stored from render (React's "previous props" pattern), compared by value:
  // `resolveLoading` returns a fresh object for an inline config every render.
  if (loadingCfg !== null && !sameLook(loadingCfg, last)) setLast(loadingCfg);
  return loadingCfg ?? last;
}
