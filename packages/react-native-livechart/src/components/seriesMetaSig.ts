import type { SeriesConfig } from "../types";

/** Exported for tests — mirrors chip labels without subscribing to every data tick. */
export function seriesMetaSig(s: SeriesConfig[]): string {
  "worklet";
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0) out += "\x1e";
    const x = s[i];
    out += `${x.id}\x1f${x.label ?? ""}\x1f${x.color ?? ""}\x1f${x.visible === false ? 0 : 1}`;
  }
  return out;
}
