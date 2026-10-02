// Benchmark baseline: the geometry + four builder walks from main (0f5ba4c).
// Kept outside the library; production paths do not import this file.
import { Skia } from "@shopify/react-native-skia";
import { buildCandleBodyPath } from "../packages/react-native-livechart/src/draw/candleBodyPath";
import { buildCandleGeometry } from "../packages/react-native-livechart/src/draw/candle";

export type CandleArgs = Parameters<typeof buildCandleGeometry>;
export type Builders = ReturnType<typeof Skia.PathBuilder.Make>[];

export function baselineCandlePaths(
  builders: Builders,
  args: CandleArgs,
  rectScratch?: { x: number; y: number; width: number; height: number },
) {
  "worklet";
  const { bodies, wicks } = buildCandleGeometry(...args);
  const radius = args[10]?.bodyRadius ?? 0;
  // Same body/wick scans, native calls and detach count as useCandlePaths on main.
  for (let group = 0; group < 2; group++) {
    const b = builders[group];
    for (let i = 0; i < bodies.length; i++) {
      const bd = bodies[i];
      if (bd.up !== (group === 0)) continue;
      const rr = radius > 0 ? Math.min(radius, bd.w / 2, bd.h / 2) : 0;
      if (rr > 0)
        b.addRRect({
          rect: { x: bd.x, y: bd.y, width: bd.w, height: bd.h },
          rx: rr,
          ry: rr,
        });
      else if (rectScratch) {
        rectScratch.x = bd.x;
        rectScratch.y = bd.y;
        rectScratch.width = bd.w;
        rectScratch.height = bd.h;
        b.addRect(rectScratch);
      } else b.addRect(Skia.XYWHRect(bd.x, bd.y, bd.w, bd.h));
    }
  }
  for (let group = 0; group < 2; group++) {
    const b = builders[group + 2];
    for (let i = 0; i < wicks.length; i++) {
      const w = wicks[i];
      if (w.up !== (group === 0)) continue;
      b.moveTo(w.x, w.y1);
      b.lineTo(w.x, w.y2);
    }
  }
  return [
    builders[0].detach(),
    builders[1].detach(),
    builders[2].detach(),
    builders[3].detach(),
  ];
}

export function candleFixture(count: number, radius: number): CandleArgs {
  "worklet";
  const candles = [];
  for (let i = 0; i < 6000; i++) {
    const open = 100 + Math.sin(i * 0.71) * 30;
    const close = 100 + Math.sin(i * 0.93) * 30;
    candles.push({
      time: i,
      open,
      close,
      low: Math.min(open, close) - 8,
      high: Math.max(open, close) + 9,
    });
  }
  return [
    candles,
    { time: 6000, open: 100, close: 120, low: 90, high: 125 },
    { top: 10, right: 10, bottom: 20, left: 10 },
    1000,
    300,
    6000 - count - 0.5,
    count + 1,
    50,
    150,
    1,
    {
      minBodyPx: 1,
      maxBodyPx: 40,
      bodyWidthRatio: 0.8,
      minGapPx: 2,
      bodyRadius: radius,
      wickWidth: 1,
    },
  ];
}

/** Measure the exact body-path helper used by the production hook. */
export function productionCandlePaths(builders: Builders, args: CandleArgs) {
  "worklet";
  const { bodies, wicks } = buildCandleGeometry(...args);
  const radius = args[10]?.bodyRadius ?? 0;
  const up = buildCandleBodyPath(builders[0], bodies, true, radius);
  const down = buildCandleBodyPath(builders[1], bodies, false, radius);
  for (let group = 0; group < 2; group++) {
    const b = builders[group + 2];
    for (let i = 0; i < wicks.length; i++) {
      const w = wicks[i];
      if (w.up !== (group === 0)) continue;
      b.moveTo(w.x, w.y1);
      b.lineTo(w.x, w.y2);
    }
  }
  return [up, down, builders[2].detach(), builders[3].detach()];
}
