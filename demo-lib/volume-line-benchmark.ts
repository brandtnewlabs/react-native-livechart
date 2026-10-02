import { buildVolumeGeometry as currentVolume } from "../packages/react-native-livechart/src/draw/volume";
import { buildCandleBodyPath } from "../packages/react-native-livechart/src/draw/candleBodyPath";
import {
  volumeStartIndex,
  volumeEndIndex,
  visibleMaxVolume,
} from "../packages/react-native-livechart/src/draw/volumeRange";
import { buildLineFillPaths } from "../packages/react-native-livechart/src/draw/lineFillPaths";
import { CANDLE_METRICS_DEFAULTS } from "../packages/react-native-livechart/src/constants";
import { Skia, type SkPathBuilder } from "@shopify/react-native-skia";
import { buildVolumeGeometry } from "./performance-baseline/volume";
import { drawSpline, makeSplineScratch } from "./performance-baseline/spline";
import type { CandlePoint } from "../packages/react-native-livechart/src/types";

export function fixture(count: number) {
  "worklet";
  const candles: CandlePoint[] = [];
  for (let i = 0; i < 6000; i++)
    candles.push({
      time: i,
      open: 100,
      close: 100 + Math.sin(i) * 20,
      low: 65,
      high: 135,
      volume: 20 + (i % 53) * 10,
    });
  const points: number[] = [];
  for (let i = 0; i < count; i++)
    points.push(
      (i * 360) / count,
      100 + 40 * Math.sin(i * 0.17) + 25 * Math.sin(i * 1.7),
    );
  return {
    candles,
    points,
    live: {
      time: 6000,
      open: 100,
      close: 130,
      low: 80,
      high: 140,
      volume: 800,
    },
    start: 6000 - count,
  };
}
export function beforeVolume(
  builders: SkPathBuilder[],
  f: ReturnType<typeof fixture>,
  count: number,
  radius: number,
) {
  "worklet";
  const { bars } = buildVolumeGeometry(
    f.candles,
    f.live,
    { left: 0, right: 0, top: 0, bottom: 70 },
    380,
    300,
    f.start,
    count + 2,
    60,
    1,
    CANDLE_METRICS_DEFAULTS,
  );
  for (let group = 0; group < 2; group++) {
    const b = builders[group];
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      if (bar.up !== (group === 0)) continue;
      const r = Math.min(radius, bar.w / 2, bar.h / 2);
      if (r > 0)
        b.addRRect({
          rect: { x: bar.x, y: bar.y, width: bar.w, height: bar.h },
          rx: r,
          ry: r,
        });
      else b.addRect(Skia.XYWHRect(bar.x, bar.y, bar.w, bar.h));
    }
  }
  return [builders[0].detach(), builders[1].detach()];
}
export function beforeLine(
  builders: SkPathBuilder[],
  points: number[],
  scratch: ReturnType<typeof makeSplineScratch>,
  ranges: number[],
  linear = false,
) {
  "worklet";
  for (let group = 0; group < 2; group++) {
    const b = builders[group];
    for (let i = 0; i < ranges.length; i += 2) {
      const start = ranges[i],
        end = ranges[i + 1];
      b.moveTo(points[start * 2], points[start * 2 + 1]);
      drawSpline(b, points, scratch, linear, start, end);
      if (group === 1) {
        b.lineTo(points[(end - 1) * 2], 240);
        b.lineTo(points[start * 2], 240);
        b.close();
      }
    }
  }
  return [builders[0].detach(), builders[1].detach()];
}
export function afterVolume(
  builders: SkPathBuilder[],
  f: ReturnType<typeof fixture>,
  count: number,
  radius: number,
  cache: { start: number; end: number; max: number },
  reuse = true,
  cached = true,
) {
  "worklet";
  const start = volumeStartIndex(f.candles, f.start, 1);
  const end = volumeEndIndex(f.candles, f.start + count + 2);
  if (!cached || start !== cache.start || end !== cache.end) {
    cache.start = start;
    cache.end = end;
    cache.max = visibleMaxVolume(f.candles, start, end);
  }
  const { bars } = currentVolume(
    f.candles,
    f.live,
    { left: 0, right: 0, top: 0, bottom: 70 },
    380,
    300,
    f.start,
    count + 2,
    60,
    1,
    CANDLE_METRICS_DEFAULTS,
    cache,
  );
  if (reuse)
    return [
      buildCandleBodyPath(builders[0], bars, true, radius),
      buildCandleBodyPath(builders[1], bars, false, radius),
    ];
  for (let group = 0; group < 2; group++)
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      if (bar.up !== (group === 0)) continue;
      const r = Math.min(radius, bar.w / 2, bar.h / 2);
      if (r > 0)
        builders[group].addRRect({
          rect: { x: bar.x, y: bar.y, width: bar.w, height: bar.h },
          rx: r,
          ry: r,
        });
      else builders[group].addRect(Skia.XYWHRect(bar.x, bar.y, bar.w, bar.h));
    }
  return [builders[0].detach(), builders[1].detach()];
}
export function afterLine(
  builders: SkPathBuilder[],
  points: number[],
  scratch: ReturnType<typeof makeSplineScratch>,
  ranges: number[],
  linear = false,
) {
  "worklet";
  buildLineFillPaths(
    builders[0],
    builders[1],
    undefined,
    points,
    ranges,
    scratch,
    linear,
    240,
    NaN,
    undefined,
    0,
    0,
  );
  return [builders[0].detach(), builders[1].detach()];
}
export function runWorkBenchmark() {
  "worklet";
  const builders = [Skia.PathBuilder.Make(), Skia.PathBuilder.Make()];
  const scratch = {
    delta: [] as number[],
    h: [] as number[],
    m: [] as number[],
  };
  const results = [];
  let checked = 0,
    mismatches = 0;
  for (const count of [40, 200, 1000]) {
    const ranges = [0, count];
    for (const kind of ["volume-sharp", "volume-rounded", "line-fill"]) {
      const f = fixture(count);
      const variants = kind === "line-fill" ? 2 : 4;
      const samples: number[][] = [[], [], [], []];
      const cache = { start: -1, end: -1, max: 0 };
      const rebuild = (variant: number) => {
        "worklet";
        if (kind === "line-fill")
          return variant === 0
            ? beforeLine(builders, f.points, scratch, ranges)
            : afterLine(builders, f.points, scratch, ranges);
        return variant === 0
          ? beforeVolume(builders, f, count, kind === "volume-rounded" ? 3 : 0)
          : afterVolume(
              builders,
              f,
              count,
              kind === "volume-rounded" ? 3 : 0,
              cache,
              variant !== 2,
              variant !== 1,
            );
      };
      for (let warm = 0; warm < 20; warm++)
        for (let v = 0; v < variants; v++) rebuild(v);
      for (let round = 0; round < 9; round++)
        for (let side = 0; side < variants; side++) {
          const variant = (round + side) % variants;
          const start = performance.now();
          for (let i = 0; i < 40; i++) rebuild(variant);
          samples[variant].push((performance.now() - start) / 40);
        }
      // Verification is deliberately outside the timing loops.
      for (let change = 0; change < 30; change++) {
        f.start = 6000 - count + change * 0.11;
        f.live.volume = change % 2 ? 30 : 5000;
        f.candles[5999].volume = change * 300;
        cache.start = -1; // notified data revision
        f.points[count * 2 - 1] = 40 + change * 6;
        const before = rebuild(0),
          after = rebuild(variants - 1);
        for (let p = 0; p < 2; p++) {
          checked++;
          if (before[p].toSVGString() !== after[p].toSVGString()) mismatches++;
        }
      }
      results.push({
        count,
        kind,
        before: samples[0],
        rectangleOnly: kind === "line-fill" ? undefined : samples[1],
        cacheOnly: kind === "line-fill" ? undefined : samples[2],
        after: samples[variants - 1],
      });
    }
  }
  return { phase: "paired", checked, mismatches, results };
}
