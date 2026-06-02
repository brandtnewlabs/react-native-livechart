import { render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue } from "react-native-reanimated";
import type { ChartEngineWithLiveValue } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { ValueTextOverlay } from "../../src/components/ValueTextOverlay";
import { resolveTheme } from "../../src/theme";
import type { Momentum } from "../../src/types";

const palette = resolveTheme("#3b82f6", "dark");
const font = {
  getSize: () => 22,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 12, height: 22 }),
  getMetrics: () => ({ ascent: -18, descent: 4, leading: 0 }),
} as never;

function engine(): ChartEngineWithLiveValue {
  return {
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 1000 },
    displayValue: { value: 42.5 },
  } as unknown as ChartEngineWithLiveValue;
}

const fmt = (v: number) => v.toFixed(2);

describe("ValueTextOverlay", () => {
  it("renders the value without momentum coloring", () => {
    function Fixture() {
      return (
        <ValueTextOverlay
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
          formatValue={fmt}
          momentumColor={false}
        />
      );
    }
    render(<Fixture />);
  });

  it("tints by momentum when momentumColor is set", () => {
    function Fixture({ m }: { m: Momentum }) {
      const momentum = useSharedValue<Momentum>(m);
      return (
        <ValueTextOverlay
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
          formatValue={fmt}
          momentum={momentum}
          momentumColor
        />
      );
    }
    render(<Fixture m="up" />);
    render(<Fixture m="down" />);
    render(<Fixture m="flat" />);
  });
});
