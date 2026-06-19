import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import {
  CustomReferenceLineOverlay,
  customReferenceLineFlags,
} from "../../src/components/CustomReferenceLineOverlay";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import type { ReferenceLine } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

function engine(
  partial: Partial<{ canvasHeight: number; displayMin: number; displayMax: number }> = {},
): ChartEngineLayout {
  return withSharedValueAccessors({
    displayMin: { value: partial.displayMin ?? 0 },
    displayMax: { value: partial.displayMax ?? 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: partial.canvasHeight ?? 300 },
    timestamp: { value: 1000 },
  }) as unknown as ChartEngineLayout;
}

const fmt = (v: number) => v.toFixed(2);

describe("customReferenceLineFlags", () => {
  it("returns all-false when no render is provided", () => {
    expect(
      customReferenceLineFlags([{ value: 5 }, { valueFrom: 1, valueTo: 2 }]),
    ).toEqual([false, false]);
  });

  it("flags only the Form-A lines the render returns an element for", () => {
    const flags = customReferenceLineFlags(
      [
        { value: 5 }, // → element
        { value: 9 }, // → null (falls back)
        { valueFrom: 1, valueTo: 2 }, // band → never custom
        { from: 1, to: 2 }, // time band → never custom
      ],
      ({ line }) => (line.value === 5 ? <Text>{line.value}</Text> : null),
    );
    expect(flags).toEqual([true, false, false, false]);
  });

  it("exposes readable ctx SharedValue stubs to the probe", () => {
    const flags = customReferenceLineFlags([{ value: 42 }], (ctx) =>
      ctx.value.get() === 42 && ctx.edge.get() === "in" ? <Text>ok</Text> : null,
    );
    expect(flags).toEqual([true]);
  });
});

describe("CustomReferenceLineOverlay", () => {
  function Fixture({
    lines,
    render,
    eng = engine(),
  }: {
    lines: ReferenceLine[];
    render: Parameters<typeof CustomReferenceLineOverlay>[0]["renderReferenceLine"];
    eng?: ChartEngineLayout;
  }) {
    const dragValues = useSharedValue<number[]>(lines.map((l) => l.value ?? 0));
    const dragActive = useSharedValue<boolean[]>(lines.map(() => false));
    return (
      <CustomReferenceLineOverlay
        lines={lines}
        renderReferenceLine={render}
        custom={customReferenceLineFlags(lines, render)}
        engine={eng}
        padding={DEFAULT_PADDING}
        formatValue={fmt}
        dragValues={dragValues}
        dragActive={dragActive}
      />
    );
  }

  it("floats a custom element for each Form-A line the render handles", () => {
    const { getByTestId } = render(
      <Fixture
        lines={[{ value: 30 }, { value: 60 }]}
        render={({ index }) => <Text testID={`rl-${index}`}>{index}</Text>}
      />,
    );
    expect(getByTestId("rl-0")).toBeTruthy();
    expect(getByTestId("rl-1")).toBeTruthy();
  });

  it("skips bands and time bands (Form-A only)", () => {
    const { queryByTestId } = render(
      <Fixture
        lines={[{ valueFrom: 10, valueTo: 20 }, { from: 1, to: 2 }]}
        render={({ index }) => <Text testID={`rl-${index}`}>{index}</Text>}
      />,
    );
    expect(queryByTestId("rl-0")).toBeNull();
    expect(queryByTestId("rl-1")).toBeNull();
  });

  it("renders nothing when the render opts out of every line", () => {
    const { toJSON } = render(
      <Fixture lines={[{ value: 30 }]} render={() => null} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders only the lines the render returns an element for", () => {
    const { getByTestId, queryByTestId } = render(
      <Fixture
        lines={[{ value: 30 }, { value: 60 }]}
        render={({ line, index }) =>
          line.value === 30 ? <Text testID={`rl-${index}`}>{index}</Text> : null
        }
      />,
    );
    expect(getByTestId("rl-0")).toBeTruthy();
    expect(queryByTestId("rl-1")).toBeNull();
  });

  it("pins across left / center / right anchors and an off-screen value", () => {
    const { getByTestId } = render(
      <Fixture
        lines={[
          { value: 30, badge: { position: "left" } },
          { value: 50, badge: { position: "center" } },
          { value: 70, badge: { position: "right" } },
          { value: 150 }, // off-screen above → pinned to the top edge
        ]}
        render={({ index }) => (
          <View testID={`rl-${index}`} style={{ width: 40, height: 16 }} />
        )}
      />,
    );
    // Drive onLayout so the measure + transform branches execute for each anchor.
    for (let i = 0; i < 4; i++) {
      fireEvent(getByTestId(`rl-${i}`).parent!, "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 40, height: 16 } },
      });
      expect(getByTestId(`rl-${i}`)).toBeTruthy();
    }
  });

  it("hides the element when the canvas is not laid out", () => {
    const { getByTestId } = render(
      <Fixture
        lines={[{ value: 30 }]}
        render={({ index }) => <Text testID={`rl-${index}`}>{index}</Text>}
        eng={engine({ canvasHeight: 0 })}
      />,
    );
    // Still mounted (opacity 0), exercising the raw < 0 branch.
    expect(getByTestId("rl-0")).toBeTruthy();
  });
});
