import { act, render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

const mockReactions: {
  prepare: () => unknown;
  react: (current: unknown, previous: unknown) => void;
  dependencies?: unknown[];
}[] = [];
// Jest has no native mapper scheduler, so record each reaction and drive the
// layout-sample one by hand. Its `sampled` SharedValue write is a UI-thread
// round-trip that doesn't land under Jest, so the order-of-magnitude gate is
// covered by the `shouldResampleLayoutValue` tests instead.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return {
    ...actual,
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (current: unknown, previous: unknown) => void,
      dependencies?: unknown[],
    ) => {
      mockReactions.push({ prepare, react, dependencies });
      return actual.useAnimatedReaction(prepare, react, dependencies);
    },
  };
});

import { LiveChart } from "../src/components/LiveChart";
import { LiveChartSeries } from "../src/components/LiveChartSeries";
import * as chartLayout from "../src/hooks/resolveChartLayout";
import type { SeriesConfig } from "../src/types";

const formatValue = (v: number) => `$${v.toFixed(0)}`;

// The layout-sample reactions list `[sampled, source]` first; the worklets
// plugin appends closure hashes after them.
function sampleReaction(source: unknown) {
  const reaction = mockReactions.findLast(
    ({ dependencies }) => dependencies?.[1] === source,
  );
  if (!reaction) throw new Error("layout sample reaction not registered");
  return reaction;
}

async function tick(
  reaction: ReturnType<typeof sampleReaction>,
  current: number,
) {
  await act(async () => {
    reaction.react(current, null);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let layoutSpy: jest.SpyInstance;
const lastMeasuredValue = () =>
  layoutSpy.mock.calls.at(-1)?.[0].currentValue as number | undefined;

beforeEach(() => {
  mockReactions.length = 0;
  layoutSpy = jest.spyOn(chartLayout, "resolveChartLayout");
});

afterEach(() => {
  layoutSpy.mockRestore();
});

describe("LiveChart layout value sample", () => {
  it("re-measures the gutter once a real value replaces a 0 placeholder", async () => {
    let value: SharedValue<number> | undefined;
    function H() {
      const data = useSharedValue([{ time: 1_700_000_000, value: 0 }]);
      value = useSharedValue(0);
      return (
        <LiveChart data={data} value={value} yAxis formatValue={formatValue} />
      );
    }
    await render(<H />);
    const reaction = sampleReaction(value);
    expect(reaction.prepare()).toBe(0);

    await tick(reaction, 0);
    expect(lastMeasuredValue()).toBeUndefined();

    await tick(reaction, 87_000);
    expect(lastMeasuredValue()).toBe(87_000);
  });
});

describe("LiveChartSeries layout value sample", () => {
  it.each([
    { values: [0, -87_000], expected: -87_000 },
    { values: [5, -87_000], expected: -87_000 },
    { values: [Infinity, 87_000], expected: 87_000 },
    { values: [NaN, 0, -87_000], expected: -87_000 },
  ])(
    "sizes the gutter for finite values in $values",
    async ({ values, expected }) => {
      let series: SharedValue<SeriesConfig[]> | undefined;
      function H() {
        series = useSharedValue<SeriesConfig[]>(
          values.map((value, i) => ({ id: String(i), data: [], value })),
        );
        return <LiveChartSeries series={series} yAxis formatValue={formatValue} />;
      }
      await render(<H />);
      const reaction = sampleReaction(series);
      const current = reaction.prepare();
      await tick(reaction, current as number);
      expect(lastMeasuredValue()).toBe(expected);
    },
  );

  it("re-measures the gutter once the series values leave 0", async () => {
    let series: SharedValue<SeriesConfig[]> | undefined;
    function H() {
      series = useSharedValue<SeriesConfig[]>([
        { id: "a", data: [], value: 0 },
        { id: "b", data: [], value: 0 },
      ]);
      return (
        <LiveChartSeries series={series} yAxis formatValue={formatValue} />
      );
    }
    await render(<H />);
    const reaction = sampleReaction(series);
    expect(reaction.prepare()).toBe(0);

    await tick(reaction, 0);
    expect(lastMeasuredValue()).toBeUndefined();

    await tick(reaction, 87_000);
    expect(lastMeasuredValue()).toBe(87_000);
  });
});
