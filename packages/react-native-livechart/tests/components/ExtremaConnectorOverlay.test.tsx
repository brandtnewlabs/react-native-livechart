import { render } from "@testing-library/react-native";
import React from "react";

import {
  ExtremaConnectorOverlay,
  labelConnector,
  type ResolvedConnector,
} from "../../src/components/ExtremaConnectorOverlay";
import type { ResolvedAxisLabelConfig } from "../../src/core/resolveConfig";
import type {
  ChartEngineExtrema,
  ChartEngineLayout,
} from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";

const sv = <T,>(value: T) => ({ value, get: () => value }) as never;

function makeEngine(
  over: Partial<{
    maxValue: number;
    maxTime: number;
    minValue: number;
    minTime: number;
  }> = {},
): ChartEngineLayout & ChartEngineExtrema {
  const { maxValue = 115, maxTime = 985, minValue = 85, minTime = 990 } = over;
  return {
    displayMax: sv(120),
    displayMin: sv(80),
    displayWindow: sv(30),
    timeWindow: sv(30),
    canvasWidth: sv(300),
    canvasHeight: sv(200),
    timestamp: sv(1000),
    extremaMaxValue: sv(maxValue),
    extremaMaxTime: sv(maxTime),
    extremaMinValue: sv(minValue),
    extremaMinTime: sv(minTime),
  };
}

const dashed: ResolvedConnector = {
  line: { color: "#34d399", strokeWidth: 1, intervals: [2, 3] },
  fontSize: 11,
};
const solid: ResolvedConnector = {
  line: { color: "#f87171", strokeWidth: 2, intervals: undefined },
  fontSize: 14,
};

describe("ExtremaConnectorOverlay", () => {
  it("renders dashed + solid connectors for top and bottom", () => {
    const screen = render(
      <ExtremaConnectorOverlay
        engine={makeEngine()}
        padding={DEFAULT_PADDING}
        top={dashed}
        bottom={solid}
      />,
    );
    expect(screen.toJSON()).toBeTruthy();
  });

  it("returns null when neither side has a connector", () => {
    const screen = render(
      <ExtremaConnectorOverlay
        engine={makeEngine()}
        padding={DEFAULT_PADDING}
        top={null}
        bottom={null}
      />,
    );
    expect(screen.toJSON()).toBeNull();
  });

  it("builds an empty path when the extremum is NaN or off-plot", () => {
    // NaN value (no data) and an off-plot time both early-out in the worklet.
    const nan = render(
      <ExtremaConnectorOverlay
        engine={makeEngine({ maxValue: NaN })}
        padding={DEFAULT_PADDING}
        top={dashed}
        bottom={null}
      />,
    );
    expect(nan.toJSON()).toBeTruthy();

    const offPlot = render(
      <ExtremaConnectorOverlay
        engine={makeEngine({ maxTime: -10_000 })}
        padding={DEFAULT_PADDING}
        top={dashed}
        bottom={null}
      />,
    );
    expect(offPlot.toJSON()).toBeTruthy();
  });

  it("applies the candle-center time offset without throwing", () => {
    const screen = render(
      <ExtremaConnectorOverlay
        engine={makeEngine()}
        padding={DEFAULT_PADDING}
        extremaTimeOffset={7.5}
        top={dashed}
        bottom={solid}
      />,
    );
    expect(screen.toJSON()).toBeTruthy();
  });

  it("skips the line when the dot is inside the label band", () => {
    // High hugs the top rail (within the label band) → no top line drawn; low
    // sits mid-plot → the bottom line draws. Exercises both worklet branches.
    const screen = render(
      <ExtremaConnectorOverlay
        engine={makeEngine({ maxValue: 119.5, minValue: 100 })}
        padding={DEFAULT_PADDING}
        top={dashed}
        bottom={solid}
      />,
    );
    expect(screen.toJSON()).toBeTruthy();
  });
});

describe("labelConnector", () => {
  const base: ResolvedAxisLabelConfig = {
    position: "extrema-edge",
    dot: true,
    connector: { color: undefined, strokeWidth: 1, intervals: [2, 3] },
  };

  it("returns null for a null config", () => {
    expect(labelConnector(null, "#888")).toBeNull();
  });

  it("returns null when not in extrema-edge mode", () => {
    expect(labelConnector({ ...base, position: "extrema" }, "#888")).toBeNull();
  });

  it("returns null when the connector is disabled", () => {
    expect(labelConnector({ ...base, connector: null }, "#888")).toBeNull();
  });

  it("defaults the connector color to the label color, then defaultColor", () => {
    // No connector color, no label color → defaultColor.
    expect(labelConnector(base, "#888")?.line.color).toBe("#888");
    // Label color wins over defaultColor.
    expect(labelConnector({ ...base, color: "#0f0" }, "#888")?.line.color).toBe(
      "#0f0",
    );
    // Explicit connector color wins over everything.
    expect(
      labelConnector(
        { ...base, color: "#0f0", connector: { ...base.connector!, color: "#abc" } },
        "#888",
      )?.line.color,
    ).toBe("#abc");
  });

  it("carries the label font size (for the label-edge estimate)", () => {
    expect(labelConnector(base, "#888")?.fontSize).toBe(11); // default
    expect(labelConnector({ ...base, fontSize: 18 }, "#888")?.fontSize).toBe(18);
  });
});
