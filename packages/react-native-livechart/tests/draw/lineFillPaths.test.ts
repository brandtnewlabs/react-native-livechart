import type { SkPathBuilder } from "@shopify/react-native-skia";
import { buildLineFillPaths } from "../../src/draw/lineFillPaths";
import { drawSpline, makeSplineScratch } from "../../src/math/spline";
import { drawSpline as beforeSpline } from "../../../../demo-lib/performance-baseline/spline";
import { sampleThresholdYAt } from "../../src/math/threshold";

function recorder() {
  const commands: unknown[] = [];
  return {
    commands,
    builder: {
      moveTo: (...a: number[]) => commands.push(["move", ...a]),
      lineTo: (...a: number[]) => commands.push(["line", ...a]),
      cubicTo: (...a: number[]) => commands.push(["cubic", ...a]),
      close: () => commands.push(["close"]),
    } as unknown as SkPathBuilder,
  };
}
it("preserves exact line, fill and band verbs across gaps, spikes and linear modes", () => {
  for (const count of [2, 3, 40, 200])
    for (const linear of [true, false])
      for (const gaps of [false, true])
        for (const sampled of [false, true]) {
          const pts: number[] = [];
          for (let i = 0; i < count; i++)
            pts.push(
              i % 4 === 0 ? Math.max(0, i - 1) : i,
              i % 5 === 0 ? 200 : Math.sin(i) * 40,
            );
          const ranges = gaps && count > 3 ? [0, 2, 3, count] : [0, count];
          const samples = sampled ? [60, 80, 20, 90] : undefined;
          const actual = [recorder(), recorder(), recorder()],
            expected = [recorder(), recorder(), recorder()];
          buildLineFillPaths(
            actual[0].builder,
            actual[1].builder,
            actual[2].builder,
            pts,
            ranges,
            makeSplineScratch(),
            linear,
            250,
            50,
            samples,
            0,
            count,
          );
          for (let group = 0; group < 3; group++)
            for (let r = 0; r < ranges.length; r += 2) {
              const b = expected[group].builder,
                start = ranges[r],
                end = ranges[r + 1],
                left = pts[start * 2],
                right = pts[(end - 1) * 2];
              b.moveTo(left, pts[start * 2 + 1]);
              beforeSpline(b, pts, makeSplineScratch(), linear, start, end);
              if (group === 1) {
                b.lineTo(right, 250);
                b.lineTo(left, 250);
                b.close();
              }
              if (group === 2) {
                if (samples) {
                  b.lineTo(right, sampleThresholdYAt(samples, 0, count, right));
                  for (let i = samples.length - 1; i >= 0; i--) {
                    const x = (count * i) / (samples.length - 1);
                    if (x > left && x < right) b.lineTo(x, samples[i]);
                  }
                  b.lineTo(left, sampleThresholdYAt(samples, 0, count, left));
                } else {
                  b.lineTo(right, 50);
                  b.lineTo(left, 50);
                }
                b.close();
              }
            }
          expect(actual.map((p) => p.commands)).toEqual(
            expected.map((p) => p.commands),
          );
        }
});
it("handles no band, empty ranges and two-point secondary sinks", () => {
  const a = recorder(),
    b = recorder(),
    c = recorder();
  buildLineFillPaths(
    a.builder,
    b.builder,
    undefined,
    [],
    [],
    makeSplineScratch(),
    false,
    200,
    NaN,
    undefined,
    0,
    0,
  );
  expect(a.commands).toEqual([]);
  expect(b.commands).toEqual([]);
  drawSpline(
    a.builder,
    [0, 0, 2, 10],
    undefined,
    false,
    0,
    2,
    b.builder,
    c.builder,
  );
  expect(a.commands).toEqual([["line", 2, 10]]);
  expect(b.commands).toEqual(a.commands);
  expect(c.commands).toEqual(a.commands);
});

it("leaves existing line and fill builders untouched on a threshold-only update", () => {
  const line = recorder(),
    fill = recorder(),
    band = recorder();
  const points = [0, 1, 1, 4, 2, 2];
  buildLineFillPaths(
    line.builder,
    fill.builder,
    band.builder,
    points,
    [0, 3],
    makeSplineScratch(),
    false,
    200,
    40,
    undefined,
    0,
    2,
    true,
  );
  expect(line.commands).toEqual([]);
  expect(fill.commands).toEqual([]);
  expect(band.commands[0]).toEqual(["move", 0, 1]);
  expect(band.commands.slice(-3)).toEqual([
    ["line", 2, 40],
    ["line", 0, 40],
    ["close"],
  ]);
});
