import type { SkPathBuilder } from "@shopify/react-native-skia";
import { buildCandleBodyPath } from "../../src/draw/candleBodyPath";
import type { CandleRect } from "../../src/draw/candle";

function recorder() {
  let commands: unknown[] = [];
  const rectInputs: object[] = [];
  const builder = {
    addRect: (r: { x: number; y: number; width: number; height: number }) => {
      rectInputs.push(r);
      commands.push(["rect", { ...r }]); // native Skia copies coordinates immediately
    },
    addRRect: (r: { rect: object; rx: number; ry: number }) =>
      commands.push(["round", { ...r, rect: { ...r.rect } }]),
    detach: () => {
      const result = commands;
      commands = [];
      return result;
    },
  } as unknown as SkPathBuilder;
  return { builder, rectInputs };
}
const bodies: CandleRect[] = [
  { x: 1, y: 2, w: 4, h: 8, up: true },
  { x: 20, y: 30, w: 6, h: 9, up: false },
  { x: 40, y: 50, w: 3, h: 1, up: true },
];

it("copies distinct sharp rectangles using one invocation-local input", () => {
  const { builder, rectInputs } = recorder();
  const path = buildCandleBodyPath(builder, bodies, true, 0);
  expect(path).toEqual([
    ["rect", { x: 1, y: 2, width: 4, height: 8 }],
    ["rect", { x: 40, y: 50, width: 3, height: 1 }],
  ]);
  expect(rectInputs[0]).toBe(rectInputs[1]);
  const down = buildCandleBodyPath(builder, bodies, false, 0);
  expect(down).toEqual([["rect", { x: 20, y: 30, width: 6, height: 9 }]]);
  expect(rectInputs[2]).not.toBe(rectInputs[0]); // no scratch shared across rebuilds/colors
  expect(path).toEqual([
    ["rect", { x: 1, y: 2, width: 4, height: 8 }],
    ["rect", { x: 40, y: 50, width: 3, height: 1 }],
  ]);
  expect(buildCandleBodyPath(builder, [], true, 0)).toEqual([]);
  expect(buildCandleBodyPath(builder, [], true, 0)).not.toBe(path);
});

it("preserves rounded radii, minimum bodies and the zero-radius fallback", () => {
  const { builder } = recorder();
  const path = buildCandleBodyPath(
    builder,
    [...bodies, { x: 60, y: 5, w: 4, h: 0, up: true }],
    true,
    10,
  );
  expect(path).toEqual([
    ["round", { rect: { x: 1, y: 2, width: 4, height: 8 }, rx: 2, ry: 2 }],
    [
      "round",
      { rect: { x: 40, y: 50, width: 3, height: 1 }, rx: 0.5, ry: 0.5 },
    ],
    ["rect", { x: 60, y: 5, width: 4, height: 0 }],
  ]);
});
