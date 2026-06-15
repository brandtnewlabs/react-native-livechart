import { render } from "@testing-library/react-native";
import React from "react";
import { Text, TextInput } from "react-native";

import { AxisLabelOverlay } from "../../src/components/AxisLabelOverlay";
import type { ResolvedAxisLabelConfig } from "../../src/core/resolveConfig";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";

/** A minimal engine stub: only displayMax/displayMin are read by the overlay. */
function makeEngine(max = 120, min = 80): ChartEngineLayout {
  const sv = <T,>(value: T) => ({ value, get: () => value }) as never;
  return {
    displayMax: sv(max),
    displayMin: sv(min),
    displayWindow: sv(30),
    timeWindow: sv(30),
    canvasWidth: sv(300),
    canvasHeight: sv(200),
    timestamp: sv(0),
  };
}

const builtIn = (
  over: Partial<ResolvedAxisLabelConfig> = {},
): ResolvedAxisLabelConfig => ({ position: "right", ...over });

const fmt = (v: number) => v.toFixed(2);

describe("AxisLabelOverlay", () => {
  it("renders the built-in top and bottom value labels without throwing", () => {
    const screen = render(
      <AxisLabelOverlay
        topLabel={builtIn()}
        bottomLabel={builtIn()}
        engine={makeEngine()}
        formatValue={fmt}
        defaultColor="#888"
        padding={DEFAULT_PADDING}
      />,
    );
    // The built-in label mounts an (animated) TextInput node for each side.
    expect(screen.UNSAFE_getAllByType(TextInput)).toHaveLength(2);
  });

  it("renders custom content when `render` is set", () => {
    const screen = render(
      <AxisLabelOverlay
        topLabel={builtIn({ render: () => <Text>HIGH</Text> })}
        bottomLabel={builtIn({ render: () => <Text>LOW</Text> })}
        engine={makeEngine()}
        formatValue={fmt}
        defaultColor="#888"
        padding={DEFAULT_PADDING}
      />,
    );
    expect(screen.getByText("HIGH")).toBeTruthy();
    expect(screen.getByText("LOW")).toBeTruthy();
  });

  it("returns null when both labels are null", () => {
    const screen = render(
      <AxisLabelOverlay
        topLabel={null}
        bottomLabel={null}
        engine={makeEngine()}
        formatValue={fmt}
        defaultColor="#888"
        padding={DEFAULT_PADDING}
      />,
    );
    expect(screen.toJSON()).toBeNull();
  });

  it("renders only the top label when bottom is null", () => {
    const screen = render(
      <AxisLabelOverlay
        topLabel={builtIn({ render: () => <Text>HIGH</Text> })}
        bottomLabel={null}
        engine={makeEngine()}
        formatValue={fmt}
        defaultColor="#888"
        padding={DEFAULT_PADDING}
      />,
    );
    expect(screen.getByText("HIGH")).toBeTruthy();
    expect(screen.queryByText("LOW")).toBeNull();
  });

  it("renders only the bottom label when top is null", () => {
    const screen = render(
      <AxisLabelOverlay
        topLabel={null}
        bottomLabel={builtIn({ render: () => <Text>LOW</Text> })}
        engine={makeEngine()}
        formatValue={fmt}
        defaultColor="#888"
        padding={DEFAULT_PADDING}
      />,
    );
    expect(screen.getByText("LOW")).toBeTruthy();
    expect(screen.queryByText("HIGH")).toBeNull();
  });
});
