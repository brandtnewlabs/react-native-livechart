/**
 * Build a balanced constant-index lookup for the threshold sample array.
 *
 * SkSL does not allow a runtime value to index a uniform array. A linear loop
 * works around that restriction, but makes every covered fragment visit every
 * segment. This tree keeps every array index constant while selecting the same
 * segment in at most `ceil(log2(sampleCount - 1))` comparisons (six for the
 * production 64-sample shader).
 */
export function buildThresholdLookupTree(sampleCount: number): string {
  if (!Number.isInteger(sampleCount) || sampleCount < 2) {
    throw new Error("Threshold shader needs at least two samples");
  }

  const build = (first: number, end: number, indent: string): string => {
    if (end - first === 1) {
      return `${indent}return mix(samples[${first}], samples[${first + 1}], clamp(u - float(${first}), 0.0, 1.0));`;
    }

    const middle = Math.floor((first + end) / 2);
    const childIndent = `${indent}  `;
    return `${indent}if (u < float(${middle})) {
${build(first, middle, childIndent)}
${indent}} else {
${build(middle, end, childIndent)}
${indent}}`;
  };

  return build(0, sampleCount - 1, "  ");
}

/** Build the complete time-varying threshold split shader. */
export function buildThresholdSplitShaderSource(sampleCount: number): string {
  const lookup = buildThresholdLookupTree(sampleCount);
  return `
// Pixel-X span of the sample grid (thresholdSampleSpanX) — overhangs the plot
// and glides with the window so features move fluidly, frame to frame.
uniform float sampleLeft;
uniform float sampleRight;
// X where the threshold ends (extendToNow: false → the last point's pixel-X,
// else a huge sentinel). Fragments right of it paint restColor: the plain line
// color for the stroke, transparent for the band.
uniform float clipRight;
uniform vec4 aboveColor; // straight-alpha rgba, 0..1
uniform vec4 belowColor; // straight-alpha rgba, 0..1
uniform vec4 restColor;  // straight-alpha rgba, 0..1
uniform float samples[${sampleCount}];

float thresholdAt(float u) {
${lookup}
}

half4 main(vec2 xy) {
  if (xy.x > clipRight) {
    return half4(half3(restColor.rgb) * restColor.a, restColor.a);
  }
  float span = sampleRight - sampleLeft;
  float u = span > 0.0 ? (xy.x - sampleLeft) / span : 0.0;
  u = clamp(u, 0.0, 1.0) * float(${sampleCount - 1});
  // Uniform-array indices must stay compile-time constants in SkSL. The
  // generated branch tree selects the same segment as floor(u), including the
  // clamped final endpoint, in logarithmic comparisons instead of walking every
  // segment for every fragment.
  float thrY = thresholdAt(u);
  // 1 above the boundary, 0 below, with ~1px antialiasing across it.
  float above = clamp(thrY - xy.y + 0.5, 0.0, 1.0);
  vec4 c = mix(belowColor, aboveColor, above);
  return half4(half3(c.rgb) * c.a, c.a);
}`;
}
