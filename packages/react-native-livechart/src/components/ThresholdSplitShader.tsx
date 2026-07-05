import { Shader, Skia, type Uniforms } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";

import { THRESHOLD_SAMPLE_COUNT } from "../math/threshold";

/**
 * Per-fragment split shader for a *time-varying* threshold. For each fragment it
 * reads the threshold's Y at the fragment's X — linearly interpolated from
 * `samples[]`, evenly spaced across `[plotLeft, plotRight]` — and paints
 * `aboveColor` above the boundary (smaller Y), `belowColor` below. This is the
 * polyline equivalent of the constant case's vertical hard-stop `LinearGradient`,
 * which can only express a *horizontal* split.
 *
 * Used for both the line stroke and the profit/loss fill band (the band passes
 * alpha-reduced colors). Output is premultiplied — Skia's shader convention, as in
 * `AreaDotsOverlay`. One GPU draw, no per-frame clip / `saveLayer`.
 */
const SPLIT_SKSL = `
uniform float plotLeft;
uniform float plotRight;
uniform vec4 aboveColor; // straight-alpha rgba, 0..1
uniform vec4 belowColor; // straight-alpha rgba, 0..1
uniform float samples[${THRESHOLD_SAMPLE_COUNT}];

half4 main(vec2 xy) {
  float span = plotRight - plotLeft;
  float u = span > 0.0 ? (xy.x - plotLeft) / span : 0.0;
  u = clamp(u, 0.0, 1.0) * float(${THRESHOLD_SAMPLE_COUNT - 1});
  // SkSL forbids indexing a uniform array with a non-constant index, so walk the
  // segments in an unrolled, constant-bound loop — the index is the loop variable
  // (a compile-time constant per unrolled iteration) — and keep the last segment
  // whose left edge is at or before the fragment's u.
  float thrY = samples[0];
  for (int j = 0; j < ${THRESHOLD_SAMPLE_COUNT - 1}; j++) {
    if (u >= float(j)) {
      thrY = mix(samples[j], samples[j + 1], clamp(u - float(j), 0.0, 1.0));
    }
  }
  // 1 above the boundary, 0 below, with ~1px antialiasing across it.
  float above = clamp(thrY - xy.y + 0.5, 0.0, 1.0);
  vec4 c = mix(belowColor, aboveColor, above);
  return half4(half3(c.rgb) * c.a, c.a);
}`;

// Compiled once. `RuntimeEffect.Make` THROWS on a compile error, so guard it —
// a shader failure must degrade to "no split" (the line keeps its plain color),
// never crash every chart screen at import. Null → the component no-ops.
let SPLIT_EFFECT: ReturnType<typeof Skia.RuntimeEffect.Make> = null;
try {
  SPLIT_EFFECT = Skia.RuntimeEffect.Make(SPLIT_SKSL);
} catch {
  SPLIT_EFFECT = null;
}

/**
 * Whether the split effect compiled. Callers must gate any `<Path>` whose ONLY
 * paint is this shader on it — without the shader child the path fills with the
 * default paint (opaque black). A fallback `color` prop can't stand in instead:
 * Skia multiplies the shader output by the paint alpha, so a transparent color
 * erases the shader's own output too.
 */
export const THRESHOLD_SPLIT_AVAILABLE = SPLIT_EFFECT !== null;

interface ThresholdSplitShaderProps {
  /**
   * Per-frame uniforms (built in `useThresholdSplitUniforms`): `plotLeft` /
   * `plotRight` (the sample span, px), `aboveColor` / `belowColor` (straight-alpha
   * `[r, g, b, a]` vec4s, channels 0..1) and `samples` (`THRESHOLD_SAMPLE_COUNT`
   * threshold pixel-Y values across the plot).
   */
  uniforms: SharedValue<Uniforms>;
}

/**
 * The split `RuntimeShader` as a paint child — drop it inside a stroked line
 * `<Path>` or a filled band `<Path>`, like a `<LinearGradient>`.
 */
export function ThresholdSplitShader({ uniforms }: ThresholdSplitShaderProps) {
  /* istanbul ignore next -- defensive: SPLIT_SKSL is static and compiles */
  if (!SPLIT_EFFECT) return null;
  return <Shader source={SPLIT_EFFECT} uniforms={uniforms} />;
}
