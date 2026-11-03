import { act, render } from "@testing-library/react-native";
import React from "react";
import type { SharedValue } from "react-native-reanimated";
import type { MultiEngineState } from "../../src/core/useLiveChartEngine";
import { withSharedValueAccessors } from "../support/sharedValueMock";

let mockFrame: ((frame: { timestamp: number }) => void) | undefined;
const mockCircle = jest.fn((_props: unknown) => null);

jest.mock("@shopify/react-native-skia", () => {
  const { View } = jest.requireActual("react-native");
  return { Group: View, BlurMask: View, Circle: (props: unknown) => mockCircle(props) };
});
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated"),
  useDerivedValue: (read: () => unknown) => ({ get value() { return read(); } }),
  useFrameCallback: (callback: typeof mockFrame) => {
    mockFrame = callback;
    return { setActive: jest.fn() };
  },
}));

import { MultiSeriesDots } from "../../src/components/MultiSeriesDots";

function shared<T>(value: T): SharedValue<T> {
  return withSharedValueAccessors({ shared: { value } }).shared as SharedValue<T>;
}

async function fixture() {
  const timestamp = shared(0);
  const viewEnd = shared<number | null>(null);
  const engine = {
    timestamp,
    displayWindow: shared(60),
    canvasWidth: shared(400),
    canvasHeight: shared(300),
    displayMin: shared(0),
    displayMax: shared(100),
    series: shared([{ id: "a", data: [{ time: 0, value: 50 }], value: 50 }]),
    displaySeriesValues: shared([50]),
    seriesOpacities: shared([1]),
  } as unknown as MultiEngineState;
  await render(
    <MultiSeriesDots
      engine={engine}
      padding={{ top: 0, left: 0, right: 0, bottom: 0 }}
      colors={["#00ff00"]}
      radius={3}
      ring={null}
      ringColor="#000000"
      color={undefined}
      pulse={{ interval: 3000, duration: 1800, maxRadius: 21, opacity: 0.35, strokeWidth: 1.5 }}
      viewEnd={viewEnd}
      seriesCount={1}
    />,
  );
  const pulse = mockCircle.mock.calls.map(([props]) => props).find(
    (props) => (props as { style?: string }).style === "stroke",
  ) as { r: SharedValue<number>; opacity: SharedValue<number> };
  return { timestamp, viewEnd, pulse };
}

beforeEach(() => {
  mockFrame = undefined;
  mockCircle.mockClear();
});

it("advances the pulse on every display frame while chart time stays fixed", async () => {
  const { timestamp, pulse } = await fixture();
  let previousRadius = pulse.r.value;
  for (let frame = 1; frame <= 60; frame++) {
    await act(() => mockFrame?.({ timestamp: frame * 1000 / 60 }));
    expect(pulse.r.value).toBeGreaterThan(previousRadius);
    expect(pulse.r.value).toBeCloseTo(6 + (frame * 1000 / 60 / 1800) * 15);
    expect(pulse.opacity.value).toBeCloseTo(0.35 * (1 - frame * 1000 / 60 / 1800));
    previousRadius = pulse.r.value;
  }
  expect(timestamp.value).toBe(0);
});

it("hides a parked pulse and resumes it when following live", async () => {
  const { viewEnd, pulse } = await fixture();
  viewEnd.value = 1;
  await act(() => mockFrame?.({ timestamp: 500 }));
  expect(pulse.r.value).toBe(0);
  expect(pulse.opacity.value).toBe(0);
  viewEnd.value = null;
  await act(() => mockFrame?.({ timestamp: 1000 }));
  expect(pulse.r.value).toBeCloseTo(6 + 1000 / 1800 * 15);
  expect(pulse.opacity.value).toBeCloseTo(0.35 * (1 - 1000 / 1800));
});
