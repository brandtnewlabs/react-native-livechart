import { render } from "@testing-library/react-native";
import React from "react";

import { SegmentDividerOverlay } from "../../src/components/SegmentDividerOverlay";
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
  canvasWidth = 400,
}: {
  segment: ResolvedSegment;
  canvasWidth?: number;
}) {
  return (
    <SegmentDividerOverlay
      engine={engine(canvasWidth)}
      padding={DEFAULT_PADDING}
      segment={segment}
      font={font}
    />
  );
}

const seg = (s: ChartSegment) =>
  resolveSegment(s, { muted: "#9aa0a6", divider: "#5b5b5b", label: "#cccccc" });

describe("SegmentDividerOverlay", () => {
  it("renders a divider", () => {
    render(<Fixture segment={seg({ from: 110, to: 120, divider: true })} />);
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

  it("renders nothing for a segment without a divider", () => {
    // No divider, no label — the segment contributes only the line recolor
    // (drawn elsewhere), so this overlay is empty but must not throw.
    render(<Fixture segment={seg({ from: 110, to: 120 })} />);
  });

  it("renders nothing visible when the segment is off-screen", () => {
    render(<Fixture segment={seg({ from: 110, to: 120, divider: true })} canvasWidth={0} />);
  });
});
