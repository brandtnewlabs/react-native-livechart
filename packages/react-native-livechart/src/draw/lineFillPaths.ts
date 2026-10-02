import type { SkPathBuilder } from "@shopify/react-native-skia";
import { drawSpline, type SplineScratch } from "../math/spline";
import { sampleThresholdYAt } from "../math/threshold";

/** Emit each segment's curve math once into the line, fill and optional band.
 * Builders remain separate so gaps and independent fill closures are preserved.
 * Finalization is left to the caller; no extra intermediate native paths.
 */
export function buildLineFillPaths(
  line: SkPathBuilder,
  fill: SkPathBuilder,
  band: SkPathBuilder | undefined,
  pts: number[],
  ranges: number[],
  scratch: SplineScratch,
  linear: boolean,
  bottom: number,
  thresholdY: number,
  samples: number[] | undefined,
  x0: number,
  x1: number,
  /** A threshold-only update can retain the existing line and fill paths. */
  bandOnly = false,
) {
  "worklet";
  for (let range = 0; range < ranges.length; range += 2) {
    const start = ranges[range],
      end = ranges[range + 1];
    const first = start * 2,
      last = (end - 1) * 2;
    const left = pts[first],
      right = pts[last];
    if (!bandOnly) {
      line.moveTo(left, pts[first + 1]);
      fill.moveTo(left, pts[first + 1]);
    }
    band?.moveTo(left, pts[first + 1]);
    if (bandOnly) {
      if (band) drawSpline(band, pts, scratch, linear, start, end);
    } else {
      drawSpline(line, pts, scratch, linear, start, end, fill, band);
      fill.lineTo(right, bottom);
      fill.lineTo(left, bottom);
      fill.close();
    }
    if (band) {
      if (samples && samples.length >= 2) {
        const count = samples.length,
          step = (x1 - x0) / (count - 1);
        band.lineTo(right, sampleThresholdYAt(samples, x0, x1, right));
        for (let i = count - 1; i >= 0; i--) {
          const x = x0 + step * i;
          if (x > left && x < right) band.lineTo(x, samples[i]);
        }
        band.lineTo(left, sampleThresholdYAt(samples, x0, x1, left));
      } else {
        band.lineTo(right, thresholdY);
        band.lineTo(left, thresholdY);
      }
      band.close();
    }
  }
}
