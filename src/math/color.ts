/** Parse hex color (#rgb or #rrggbb) to [r, g, b]. Worklet-safe (no regex). */
export function hexToRgb(hex: string): [number, number, number] {
  "worklet";
  let r = 128;
  let g = 128;
  let b = 128;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length >= 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return [r, g, b];
}

/** Interpolate between two RGB triples. Returns `rgb(r,g,b)` string. */
export function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): string {
  "worklet";
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
