import matrix from "./live-renderer-matrix.json";

export type RendererProfileMode = "static" | "live";
export type RendererProfileCurve = "monotone" | "linear";
export type RendererProfileJoin = "round" | "miter" | "bevel";
export type RendererProfileCap = "round" | "butt" | "square";

export interface RendererProfile {
  id: string;
  description: string;
  mode: RendererProfileMode;
  curve: RendererProfileCurve;
  join: RendererProfileJoin;
  cap: RendererProfileCap;
  lineWidth: number;
  tradesPerSecond: number;
  historySpanSeconds: number;
  timeWindowSeconds: number;
  maxPoints: number;
  chartHeight: number;
}

type RendererProfileOverrides = Partial<
  Omit<RendererProfile, "id" | "description">
> & {
  id: string;
  description: string;
};

const defaults = matrix.defaults as Omit<
  RendererProfile,
  "id" | "description"
>;
const runs = matrix.runs as RendererProfileOverrides[];

export const DEFAULT_RENDERER_PROFILE_ID = "live-monotone-round";

export const LIVE_RENDERER_PROFILES: readonly RendererProfile[] = runs.map(
  (run) => ({ ...defaults, ...run }),
);

/**
 * Resolve the bundle-time profiling selection. `EXPO_PUBLIC_MEMORY_PROFILE_MODE`
 * remains as a compatibility override for the original static/live harness.
 */
export function resolveLiveRendererProfile(
  profileId: string | undefined,
  legacyMode?: string,
): RendererProfile {
  const selected =
    LIVE_RENDERER_PROFILES.find((profile) => profile.id === profileId) ??
    LIVE_RENDERER_PROFILES.find(
      (profile) => profile.id === DEFAULT_RENDERER_PROFILE_ID,
    )!;

  if (legacyMode !== "static" && legacyMode !== "live") return selected;
  return { ...selected, mode: legacyMode };
}
