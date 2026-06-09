import { render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue } from "react-native-reanimated";

import { SegmentBandOverlay } from "../../src/components/SegmentBandOverlay";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { resolveSegment, type ResolvedSegment } from "../../src/core/resolveSegment";
import { DEFAULT_PADDING } from "../../src/draw/line";
import type { ChartSegment } from "../../src/types";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;

function engine(canvasWidth = 400): ChartEngineLayout {
  return {
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: canvasWidth },
    canvasHeight: { value: 300 },
    timestamp: { value: 130 }, // window [100, 130]
  } as unknown as ChartEngineLayout;
}

function Fixture({
  segment,
  scrubAt = -1,
  scrubbing = false,
  canvasWidth = 400,
}: {
  segment: ResolvedSegment;
  scrubAt?: number;
  scrubbing?: boolean;
  canvasWidth?: number;
}) {
  const scrubX = useSharedValue(scrubAt);
  const scrubActive = useSharedValue(scrubbing);
  return (
    <SegmentBandOverlay
      engine={engine(canvasWidth)}
      padding={DEFAULT_PADDING}
      segment={segment}
      scrubX={scrubX}
      scrubActive={scrubActive}
      font={font}
    />
  );
}

const seg = (s: ChartSegment) => resolveSegment(s, "#3323E6");

describe("SegmentBandOverlay", () => {
  it("renders a resting band", () => {
    render(<Fixture segment={seg({ from: 110, to: 120 })} />);
  });

  it("renders a highlighted band while scrubbing inside it", () => {
    render(
      <Fixture
        segment={seg({ from: 110, to: 125 })}
        scrubAt={250}
        scrubbing
      />,
    );
  });

  it("renders a divider and a label", () => {
    render(
      <Fixture
        segment={seg({
          from: 110,
          to: 120,
          divider: true,
          label: "After hours",
        })}
      />,
    );
  });

  it("hides the label when there is no divider", () => {
    // The label captions the divider, so without a divider it must not render.
    const screen = render(
      <Fixture
        segment={seg({ from: 110, to: 120, divider: false, label: "After hours" })}
      />,
    );
    expect(screen.queryByText("After hours")).toBeNull();
  });

  it("renders a gradient-recolored active segment", () => {
    render(
      <Fixture
        segment={seg({
          from: 110,
          to: 120,
          active: true,
          lineColors: ["#aa0000", "#0000cc"],
        })}
      />,
    );
  });

  it("renders nothing visible when the band is off-screen", () => {
    render(<Fixture segment={seg({ from: 110, to: 120 })} canvasWidth={0} />);
  });
});
