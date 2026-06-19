import type {
  FontWeight,
  ReferenceLine,
  ReferenceLineBadgeConfig,
} from "../types";

/** Which of the three reference-line forms a `ReferenceLine` resolves to. */
export type ReferenceLineForm = "line" | "value-band" | "time-band" | "none";

/**
 * Classify a `ReferenceLine` into one of its three forms, applying the
 * documented precedence A (line) > B (value band) > C (time band).
 */
export function referenceLineForm(rl: ReferenceLine): ReferenceLineForm {
  "worklet";
  if (rl.value !== undefined) return "line";
  if (rl.valueFrom !== undefined && rl.valueTo !== undefined) {
    return "value-band";
  }
  if (rl.from !== undefined && rl.to !== undefined) return "time-band";
  return "none";
}

/**
 * Gather every Y value a set of reference lines should contribute to the
 * axis-range computation. Lines flagged `excludeFromRange` are skipped, as are
 * time bands (Form C) which constrain time, not value.
 */
export function collectReferenceValues(lines: ReferenceLine[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const rl = lines[i];
    if (rl.excludeFromRange) continue;
    switch (referenceLineForm(rl)) {
      case "line":
        out.push(rl.value as number);
        break;
      case "value-band":
        out.push(rl.valueFrom as number, rl.valueTo as number);
        break;
      // time-band / none contribute no Y values
    }
  }
  return out;
}

/**
 * Fully-resolved badge **style/shape** + anchor — the resolved counterpart of
 * {@link BadgeStyleConfig} (`position` / `icon` / `showText` plus the style knobs).
 * Shared by the reference-line badge ({@link ResolvedReferenceBadge}) and the
 * grouping count pill ({@link ResolvedReferenceGroupBadge}). Unset colors stay
 * `undefined` so the overlay applies the appropriate theme default at render time.
 */
export interface ResolvedReferenceBadgeStyle {
  position: "left" | "center" | "right";
  /** Leading glyph, or "" for none. */
  icon: string;
  /** Whether the text label is shown (false → icon-only). */
  showText: boolean;
  background: string | undefined;
  borderColor: string | undefined;
  /** Border stroke width in px. Default `1`. */
  borderWidth: number;
  radius: number;
  textColor: string | undefined;
  /** Per-badge font knobs; undefined → the chart font. */
  fontSize: number | undefined;
  fontFamily: string | undefined;
  fontWeight: FontWeight | undefined;
  /** Nudge the whole badge from its anchor, in px. Default `0`. */
  offsetX: number;
  offsetY: number;
}

/** Fully-resolved presentation for a Form-A reference-line badge — the shared
 *  style/shape plus the in-range / legacy-text flags. */
export interface ResolvedReferenceBadge extends ResolvedReferenceBadgeStyle {
  /** Show the pill at the value when in range (`badge`) vs only off-screen (legacy `offAxisBadge`). */
  inRange: boolean;
  /** Legacy `"word: value"` text format (off-axis badge) vs the `label`/value format. */
  legacyText: boolean;
}

/** Fully-resolved styling for the grouping **count pill** — exactly the shared
 *  badge style/shape (no in-range / legacy concepts). */
export type ResolvedReferenceGroupBadge = ResolvedReferenceBadgeStyle;

/**
 * Resolves the shared style/shape + anchor of a {@link BadgeStyleConfig}-shaped
 * badge config. `flat` supplies a reference line's flat `badge*` fallbacks
 * (`badgeBackground` / `badgeBorderColor` / `badgeRadius`); omit it for the group
 * pill. Theme defaults for the unset colors are applied at render time. Worklet —
 * also called from the {@link resolveReferenceBadge} worklet.
 */
function resolveReferenceBadgeStyle(
  cfg: ReferenceLineBadgeConfig | undefined,
  flat?: ReferenceLine,
): ResolvedReferenceBadgeStyle {
  "worklet";
  return {
    position: cfg?.position ?? "left",
    icon: cfg?.icon ?? "",
    showText: cfg?.text ?? true,
    background: cfg?.background ?? flat?.badgeBackground,
    borderColor: cfg?.borderColor ?? flat?.badgeBorderColor,
    borderWidth: cfg?.borderWidth ?? 1,
    radius: cfg?.radius ?? flat?.badgeRadius ?? 5,
    textColor: cfg?.textColor,
    fontSize: cfg?.fontSize,
    fontFamily: cfg?.fontFamily,
    fontWeight: cfg?.fontWeight,
    offsetX: cfg?.offsetX ?? 0,
    offsetY: cfg?.offsetY ?? 0,
  };
}

/**
 * Resolves the grouping count-pill styling from a {@link ReferenceLineBadgeConfig}
 * (the same shape a per-line badge uses). Pure — driven only by the config.
 */
export function resolveReferenceGroupBadge(
  badge?: ReferenceLineBadgeConfig,
): ResolvedReferenceGroupBadge {
  return resolveReferenceBadgeStyle(badge);
}

/**
 * Resolves a Form-A reference line's badge presentation from the new `badge`
 * config or the legacy `offAxisBadge` flag (the `badge` config wins). Returns
 * null when neither is set. Pure — driven only by the line props.
 */
export function resolveReferenceBadge(
  rl: ReferenceLine,
): ResolvedReferenceBadge | null {
  "worklet";
  if (rl.badge) {
    const cfg = rl.badge === true ? undefined : rl.badge;
    return {
      ...resolveReferenceBadgeStyle(cfg, rl),
      inRange: true,
      legacyText: false,
    };
  }
  if (rl.offAxisBadge) {
    // Legacy off-axis badge: no config object, but the flat `badge*` fallbacks apply.
    return {
      ...resolveReferenceBadgeStyle(undefined, rl),
      inRange: false,
      legacyText: true,
    };
  }
  return null;
}

/**
 * Where a Y value sits relative to the visible plot range:
 * `"in"` (within [min, max]), `"above"` (greater than max), or `"below"`.
 */
export function classifyReferenceEdge(
  value: number,
  min: number,
  max: number,
): "in" | "above" | "below" {
  "worklet";
  if (value > max) return "above";
  if (value < min) return "below";
  return "in";
}
