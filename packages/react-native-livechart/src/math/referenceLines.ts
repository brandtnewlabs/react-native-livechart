import type { ReferenceLine } from "../types";

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

/** Fully-resolved badge presentation for a Form-A reference line. */
export interface ResolvedReferenceBadge {
  position: "left" | "right";
  /** Leading glyph, or "" for none. */
  icon: string;
  /** Whether the text label is shown. */
  showText: boolean;
  /** undefined → theme tooltipBg at render time. */
  background: string | undefined;
  /** undefined → the line color at render time. */
  borderColor: string | undefined;
  radius: number;
  /** Show the pill at the value when in range (`badge`) vs only off-screen (legacy `offAxisBadge`). */
  inRange: boolean;
  /** Legacy `"word: value"` text format (off-axis badge) vs the `label`/value format. */
  legacyText: boolean;
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
      position: cfg?.position ?? "left",
      icon: cfg?.icon ?? "",
      showText: cfg?.text ?? true,
      background: cfg?.background ?? rl.badgeBackground,
      borderColor: cfg?.borderColor ?? rl.badgeBorderColor,
      radius: cfg?.radius ?? rl.badgeRadius ?? 5,
      inRange: true,
      legacyText: false,
    };
  }
  if (rl.offAxisBadge) {
    return {
      position: "left",
      icon: "",
      showText: true,
      background: rl.badgeBackground,
      borderColor: rl.badgeBorderColor,
      radius: rl.badgeRadius ?? 5,
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
