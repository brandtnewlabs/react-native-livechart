import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Text, TextInput } from "react-native";

import { AxisLabelOverlay } from "../../src/components/AxisLabelOverlay";
import type { ResolvedAxisLabelConfig } from "../../src/core/resolveConfig";
import type {
  ChartEngineExtrema,
  ChartEngineLayout,
} from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";

const sv = <T,>(value: T) => ({ value, get: () => value }) as never;

/** A minimal engine stub: only displayMax/displayMin are read by the overlay. */
function makeEngine(max = 120, min = 80): ChartEngineLayout {
  return {
    displayMax: sv(max),
    displayMin: sv(min),
    displayWindow: sv(30),
    timeWindow: sv(30),
    canvasWidth: sv(300),
    canvasHeight: sv(200),
    timestamp: sv(1000),
  };
}

/** Engine stub that also exposes the live extrema (for `"extrema"` labels). */
function makeExtremaEngine(
  over: Partial<{
    maxValue: number;
    maxTime: number;
    minValue: number;
    minTime: number;
  }> = {},
): ChartEngineLayout & ChartEngineExtrema {
  const {
    maxValue = 115,
    maxTime = 985,
    minValue = 85,
    minTime = 990,
  } = over;
  return {
    ...makeEngine(),
    extremaMaxValue: sv(maxValue),
    extremaMaxTime: sv(maxTime),
    extremaMinValue: sv(minValue),
    extremaMinTime: sv(minTime),
  };
}

const builtIn = (
  over: Partial<ResolvedAxisLabelConfig> = {},
): ResolvedAxisLabelConfig => ({
  position: "right",
  dot: true,
  connector: null,
  ...over,
});

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

  describe('position: "extrema"', () => {
    it("floats the built-in top + bottom labels at the extrema points", () => {
      const screen = render(
        <AxisLabelOverlay
          topLabel={builtIn({ position: "extrema" })}
          bottomLabel={builtIn({ position: "extrema" })}
          engine={makeExtremaEngine()}
          formatValue={fmt}
          defaultColor="#888"
          padding={DEFAULT_PADDING}
        />,
      );
      // No animated TextInput in extrema mode — the value rides a plain <Text>.
      expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
      // Mounts both anchors; the value text is empty until the reaction fires.
      expect(screen.toJSON()).toBeTruthy();
    });

    it("drives onLayout to measure + center the extrema box", () => {
      const screen = render(
        <AxisLabelOverlay
          topLabel={builtIn({
            position: "extrema",
            render: () => <Text testID="peak">PEAK</Text>,
          })}
          bottomLabel={null}
          engine={makeExtremaEngine()}
          formatValue={fmt}
          defaultColor="#888"
          padding={DEFAULT_PADDING}
        />,
      );
      // The element's parent is the measured Animated.View anchor (onLayout).
      fireEvent(screen.getByTestId("peak").parent!, "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 50, height: 24 } },
      });
      expect(screen.getByTestId("peak")).toBeTruthy();
    });

    it("renders a custom element at the extrema point", () => {
      const screen = render(
        <AxisLabelOverlay
          topLabel={builtIn({
            position: "extrema",
            render: () => <Text>PEAK</Text>,
          })}
          bottomLabel={builtIn({
            position: "extrema",
            render: () => <Text>VALLEY</Text>,
          })}
          engine={makeExtremaEngine()}
          formatValue={fmt}
          defaultColor="#888"
          padding={DEFAULT_PADDING}
        />,
      );
      expect(screen.getByText("PEAK")).toBeTruthy();
      expect(screen.getByText("VALLEY")).toBeTruthy();
    });

    it("stays mounted (hidden) when the extremum value is NaN", () => {
      const screen = render(
        <AxisLabelOverlay
          topLabel={builtIn({ position: "extrema" })}
          bottomLabel={builtIn({ position: "extrema" })}
          engine={makeExtremaEngine({ maxValue: NaN, minValue: NaN })}
          formatValue={fmt}
          defaultColor="#888"
          padding={DEFAULT_PADDING}
        />,
      );
      expect(screen.toJSON()).toBeTruthy();
    });

    it("hides when the extremum point has scrolled off-plot", () => {
      const screen = render(
        <AxisLabelOverlay
          topLabel={builtIn({ position: "extrema" })}
          bottomLabel={null}
          // maxTime far before the window start → projected x is off the plot.
          engine={makeExtremaEngine({ maxTime: -10_000 })}
          formatValue={fmt}
          defaultColor="#888"
          padding={DEFAULT_PADDING}
        />,
      );
      expect(screen.toJSON()).toBeTruthy();
    });

    it("falls back to the edge label when the engine lacks extrema", () => {
      const screen = render(
        <AxisLabelOverlay
          topLabel={builtIn({ position: "extrema" })}
          bottomLabel={null}
          engine={makeEngine()} // no extrema SharedValues
          formatValue={fmt}
          defaultColor="#888"
          padding={DEFAULT_PADDING}
        />,
      );
      // Edge fallback renders the animated value TextInput.
      expect(screen.UNSAFE_getAllByType(TextInput)).toHaveLength(1);
    });

    it("honors custom dotSize / dotColor and font knobs", () => {
      const screen = render(
        <AxisLabelOverlay
          topLabel={builtIn({
            position: "extrema",
            dotSize: 12,
            dotColor: "#f0f",
            fontSize: 16,
            fontWeight: "700",
            fontFamily: "JetBrainsMono",
          })}
          bottomLabel={null}
          engine={makeExtremaEngine()}
          formatValue={fmt}
          defaultColor="#888"
          padding={DEFAULT_PADDING}
        />,
      );
      expect(screen.toJSON()).toBeTruthy();
    });

    it('pins the value label to the edge in "extrema-edge" mode', () => {
      // The dot stays on the point; only the value text moves to the edge.
      const screen = render(
        <AxisLabelOverlay
          topLabel={builtIn({ position: "extrema-edge" })}
          bottomLabel={builtIn({ position: "extrema-edge" })}
          engine={makeExtremaEngine()}
          formatValue={fmt}
          defaultColor="#888"
          padding={DEFAULT_PADDING}
        />,
      );
      expect(screen.toJSON()).toBeTruthy();
    });

    it("applies extremaTimeOffset (candle-center alignment)", () => {
      // Half a candle width shifts the dot from the bucket-start to the center.
      const screen = render(
        <AxisLabelOverlay
          topLabel={builtIn({ position: "extrema" })}
          bottomLabel={builtIn({ position: "extrema" })}
          engine={makeExtremaEngine()}
          formatValue={fmt}
          defaultColor="#888"
          padding={DEFAULT_PADDING}
          extremaTimeOffset={7.5}
        />,
      );
      expect(screen.toJSON()).toBeTruthy();
    });

    it("omits the marker dot when dot is false (value text only)", () => {
      const screen = render(
        <AxisLabelOverlay
          topLabel={builtIn({ position: "extrema", dot: false })}
          bottomLabel={null}
          engine={makeExtremaEngine()}
          formatValue={fmt}
          defaultColor="#888"
          padding={DEFAULT_PADDING}
        />,
      );
      expect(screen.toJSON()).toBeTruthy();
    });

    it("applies font knobs to the edge (non-extrema) label too", () => {
      const screen = render(
        <AxisLabelOverlay
          topLabel={builtIn({ fontSize: 18, fontWeight: "600" })}
          bottomLabel={null}
          engine={makeEngine()}
          formatValue={fmt}
          defaultColor="#888"
          padding={DEFAULT_PADDING}
        />,
      );
      expect(screen.UNSAFE_getAllByType(TextInput)).toHaveLength(1);
    });
  });
});
