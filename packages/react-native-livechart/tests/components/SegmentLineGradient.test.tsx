import { render } from "@testing-library/react-native";
import React from "react";
import type { SharedValue } from "react-native-reanimated";

const mockMounts: number[] = [];
const mockUnmounts: number[] = [];
let mockNextInstance = 0;

jest.mock("../../src/hooks/useSegmentLineGradient", () => {
  const ReactActual = jest.requireActual<typeof import("react")>("react");
  return {
    useSegmentLineGradient: () => {
      const instance = ReactActual.useRef(0);
      if (instance.current === 0) instance.current = ++mockNextInstance;
      ReactActual.useEffect(() => {
        mockMounts.push(instance.current);
        return () => {
          mockUnmounts.push(instance.current);
        };
      }, [instance]);
      return {
        colors: { value: ["#00f", "#00f"] },
        positions: { value: [0, 1] },
        gradientEnd: { value: { x: 400, y: 0 } },
      };
    },
  };
});

import { SegmentLineGradient } from "../../src/components/SegmentLineGradient";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { resolveSegment } from "../../src/core/resolveSegment";
import { DEFAULT_PADDING } from "../../src/draw/line";

const DEFAULTS = { muted: "#999", divider: "#555", label: "#ccc" };
const engine = {} as ChartEngineLayout;
const scrubX = { value: -1 } as SharedValue<number>;
const scrubActive = { value: false } as SharedValue<boolean>;

const segment = (from: number, to: number) =>
  resolveSegment({ from, to }, DEFAULTS);

describe("SegmentLineGradient", () => {
  it("remounts both gradient SharedValues together when the stop count changes", async () => {
    mockMounts.length = 0;
    mockUnmounts.length = 0;
    mockNextInstance = 0;

    const firstSegments = [segment(100, 110)];
    const screen = await render(
      <SegmentLineGradient
        engine={engine}
        segments={firstSegments}
        padding={DEFAULT_PADDING}
        baseColor="#00f"
        scrubX={scrubX}
        scrubActive={scrubActive}
      />,
    );
    expect(mockMounts).toEqual([1]);
    expect(mockUnmounts).toEqual([]);

    // The segment changed, but its stop count did not: keep the same mapper pair.
    await screen.rerender(
      <SegmentLineGradient
        engine={engine}
        segments={[segment(110, 120)]}
        padding={DEFAULT_PADDING}
        baseColor="#00f"
        scrubX={scrubX}
        scrubActive={scrubActive}
      />,
    );
    expect(mockMounts).toEqual([1]);
    expect(mockUnmounts).toEqual([]);

    // A second recoloring segment increases the bound from 6 to 10 stops.
    await screen.rerender(
      <SegmentLineGradient
        engine={engine}
        segments={[segment(110, 120), segment(120, 130)]}
        padding={DEFAULT_PADDING}
        baseColor="#00f"
        scrubX={scrubX}
        scrubActive={scrubActive}
      />,
    );
    expect(mockMounts).toEqual([1, 2]);
    expect(mockUnmounts).toEqual([1]);
  });
});
