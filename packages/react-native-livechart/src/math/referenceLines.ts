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
