import type { Skia } from "@shopify/react-native-skia";
import { CANDLE_METRICS_DEFAULTS } from "../../src/constants";
import { buildCandleGeometry } from "../../src/draw/candle";
import {
  buildCandleBatch,
  makeCandleBatchScratch,
} from "../../../../demo-lib/candle-batch-prototype";

type Command = (string | number)[];
function builder() {
  let commands: Command[] = [];
  return {
    addRect: (r: { x: number; y: number; width: number; height: number }) =>
      commands.push(["rect", r.x, r.y, r.width, r.height]),
    addRRect: (r: {
      rect: { x: number; y: number; width: number; height: number };
      rx: number;
      ry: number;
    }) =>
      commands.push([
        "round",
        r.rect.x,
        r.rect.y,
        r.rect.width,
        r.rect.height,
        r.rx,
        r.ry,
      ]),
    moveTo: (x: number, y: number) => commands.push(["move", x, y]),
    lineTo: (x: number, y: number) => commands.push(["line", x, y]),
    detach: () => {
      const result = commands;
      commands = [];
      return result;
    },
  } as unknown as ReturnType<typeof Skia.PathBuilder.Make>;
}

it("matches every emitted command across clipping, rounding, dojis, live updates and empty transitions", () => {
  const candles = Array.from({ length: 100 }, (_, i) => {
    const open = Math.sin(i) * 30,
      close = i % 7 === 0 ? open : Math.cos(i) * 30;
    return {
      time: i,
      open,
      close,
      low: Math.min(open, close) - 5,
      high: Math.max(open, close) + 8,
    };
  });
  const batch = makeCandleBatchScratch([
    builder(),
    builder(),
    builder(),
    builder(),
  ]);
  const originalRect = batch.rect;
  for (let step = 0; step < 240; step++) {
    const metrics = {
      ...CANDLE_METRICS_DEFAULTS,
      bodyRadius: step % 4 === 0 ? 0 : 3,
      minBodyPx: (step % 3) + 1,
    };
    const args: Parameters<typeof buildCandleGeometry> = [
      step % 19 === 0 ? [] : candles,
      step % 5 === 0
        ? null
        : { time: 99, open: 10, close: step % 2 ? 20 : -5, low: -12, high: 25 },
      { left: 10, right: 12, top: 8, bottom: 15 },
      step % 23 === 0 ? 0 : 400,
      step % 29 === 0 ? 0 : 200,
      step * 0.41,
      (step % 17) + 0.3,
      -50,
      step % 31 === 0 ? -50 : 50,
      (step % 11) * 0.3 + 0.2,
      metrics,
    ];
    const expected: Command[][] = [[], [], [], []];
    const geometry = buildCandleGeometry(...args);
    for (const b of geometry.bodies) {
      const radius =
        metrics.bodyRadius > 0
          ? Math.min(metrics.bodyRadius, b.w / 2, b.h / 2)
          : 0;
      expected[b.up ? 0 : 1].push(
        radius > 0
          ? ["round", b.x, b.y, b.w, b.h, radius, radius]
          : ["rect", b.x, b.y, b.w, b.h],
      );
    }
    for (const w of geometry.wicks)
      expected[w.up ? 2 : 3].push(["move", w.x, w.y1], ["line", w.x, w.y2]);
    expect(buildCandleBatch(batch, ...args)).toEqual(expected);
    expect(batch.rect).toBe(originalRect);
    expect(batch.roundRect.rect).toBe(originalRect);
  }
});
