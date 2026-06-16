import { Path, Shader, Skia, type SkPath } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";

/**
 * Screen-fixed dot lattice as a procedural fragment shader. `xy` is the canvas
 * coordinate, so the lattice is fixed in screen space (the line scrolls over it).
 * Each `spacing`×`spacing` cell holds one dot of radius `radius`, centered, with
 * ~1px antialiasing. Returns premultiplied alpha (Skia's shader convention).
 */
const DOT_SKSL = `
uniform float spacing;
uniform float radius;
uniform vec4 color; // straight-alpha rgba, 0..1

half4 main(vec2 xy) {
  vec2 c = mod(xy, spacing) - 0.5 * spacing;
  float d = length(c);
  float cov = clamp(radius + 0.5 - d, 0.0, 1.0);
  float a = color.a * cov;
  return half4(half3(color.rgb) * a, a);
}`;

// Compiled once. Null only if the SkSL fails to compile (then the overlay no-ops).
const DOT_EFFECT = Skia.RuntimeEffect.Make(DOT_SKSL);

interface AreaDotsOverlayProps {
  /** Live area-under-line path (`fillPath`). Filling it with the dot shader keeps
   *  the dots inside the under-line region — no per-frame clip layer. */
  fillPath: SharedValue<SkPath>;
  /** Dot color as `[r, g, b, a]`, channels 0..1 (alpha already folded with the
   *  config `opacity`). */
  color: number[];
  /** Lattice pitch (px) between dots. */
  spacing: number;
  /** Dot diameter (px). */
  size: number;
}

/**
 * Dot-lattice area fill: the live `fillPath` painted with a procedural dot
 * shader. One GPU fill draw — the dots are generated in the fragment shader from
 * the screen-space coordinate, so there is no Points geometry and no per-frame
 * clip/`saveLayer` (which is what made the earlier clipped-`Points` approach
 * drop frames). See `AreaDotsConfig`.
 */
export function AreaDotsOverlay({
  fillPath,
  color,
  spacing,
  size,
}: AreaDotsOverlayProps) {
  /* istanbul ignore next -- defensive: DOT_SKSL is static and compiles */
  if (!DOT_EFFECT) return null;
  return (
    <Path path={fillPath} style="fill">
      <Shader
        source={DOT_EFFECT}
        uniforms={{ spacing, radius: size / 2, color }}
      />
    </Path>
  );
}
