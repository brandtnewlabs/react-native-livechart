import {
  volumeStartIndex,
  volumeEndIndex,
  visibleMaxVolume,
} from "../../src/draw/volumeRange";
import { buildVolumeGeometry } from "../../src/draw/volume";
import { buildVolumeGeometry as before } from "../../../../demo-lib/performance-baseline/volume";
import { CANDLE_METRICS_DEFAULTS } from "../../src/constants";
import type { CandlePoint } from "../../src/types";

const candles: CandlePoint[] = Array.from({ length: 100 }, (_, i) => ({
  time: i * 10,
  open: 100,
  close: i % 2 ? 110 : 90,
  low: 80,
  high: 120,
  volume: i % 7 === 0 ? undefined : i * 10,
}));
it("uses inclusive bucket edges and exclusive end indices", () => {
  expect(volumeStartIndex(candles, 100, 10)).toBe(9);
  expect(volumeStartIndex(candles, 100.01, 10)).toBe(10);
  expect(volumeEndIndex(candles, 100)).toBe(11);
  expect(volumeEndIndex(candles, 99.99)).toBe(10);
  expect(volumeStartIndex([], 0, 10)).toBe(0);
  expect(volumeEndIndex([], 0)).toBe(0);
  expect(visibleMaxVolume([], 0, 0)).toBe(0);
});
it("matches uncached geometry across animated bounds, width, live outliers and empty history", () => {
  for (const data of [candles, []])
    for (const width of [1, 10, 35])
      for (let i = 0; i < 60; i++) {
        const winStart = i * 17.3 - 50,
          window = 200;
        const start = volumeStartIndex(data, winStart, width),
          end = volumeEndIndex(data, winStart + window);
        const history = { start, end, max: visibleMaxVolume(data, start, end) };
        const live =
          i % 3 === 0
            ? null
            : {
                ...candles[50],
                time: winStart + window + (i % 2 ? 20 : -10),
                volume: i % 2 ? 1 : 10000,
              };
        const args = [
          data,
          live,
          { left: 10, right: 20, top: 5, bottom: 80 },
          400,
          300,
          winStart,
          window,
          60,
          width,
          CANDLE_METRICS_DEFAULTS,
        ] as const;
        expect(buildVolumeGeometry(...args, history)).toEqual(before(...args));
      }
});
it("recomputes both rising and falling maxima after same-length data revisions", () => {
  const data = candles.map((c) => ({ ...c }));
  const start = 10,
    end = 30;
  const old = visibleMaxVolume(data, start, end);
  data[20].volume = 100000;
  expect(visibleMaxVolume(data, start, end)).toBe(100000);
  data[20].volume = 0;
  expect(visibleMaxVolume(data, start, end)).toBe(old);
  data.splice(0, data.length);
  expect(visibleMaxVolume(data, 0, 0)).toBe(0);
});
