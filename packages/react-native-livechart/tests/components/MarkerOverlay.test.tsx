import { render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue } from "react-native-reanimated";
import { MarkerOverlay } from "../../src/components/MarkerOverlay";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { resolveTheme } from "../../src/theme";
import type { Marker, SeriesConfig } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

const palette = resolveTheme("#3b82f6", "dark");

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;

function engine(): ChartEngineLayout {
  return withSharedValueAccessors({
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 1000 },
  }) as unknown as ChartEngineLayout;
}

const ALL_KINDS: Marker[] = [
  { id: "t", time: 999, kind: "trade", value: 50 },
  { id: "b", time: 998, kind: "boost", value: 55 },
  { id: "g", time: 997, kind: "graduation", value: 60 },
  { id: "w", time: 996, kind: "winner", value: 65 },
  { id: "c", time: 995, kind: "clawback", value: 40 },
];

describe("MarkerOverlay", () => {
  it("renders a glyph for every marker kind (self-projected)", () => {
    function Fixture() {
      const markers = useSharedValue<Marker[]>(ALL_KINDS);
      return (
        <MarkerOverlay
          markers={markers}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
        />
      );
    }
    render(<Fixture />);
  });

  it("renders a text icon and a custom color", () => {
    function Fixture() {
      const markers = useSharedValue<Marker[]>([
        { id: "i", time: 999, kind: "trade", value: 50, icon: "★", color: "#ff0" },
      ]);
      return (
        <MarkerOverlay
          markers={markers}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
        />
      );
    }
    render(<Fixture />);
  });

  it("renders a pill badge around the icon", () => {
    function Fixture() {
      const markers = useSharedValue<Marker[]>([
        { id: "buy", time: 999, kind: "trade", value: 50, icon: "+", color: "#16a34a", pill: true },
        { id: "sell", time: 998, kind: "trade", value: 55, icon: "−", color: "#dc2626", pill: true },
      ]);
      return (
        <MarkerOverlay
          markers={markers}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
        />
      );
    }
    render(<Fixture />);
  });

  it("renders an image icon", () => {
    function Fixture() {
      const markers = useSharedValue<Marker[]>([
        {
          id: "img",
          time: 999,
          kind: "trade",
          value: 50,
          image: { width: () => 20, height: () => 20 } as never,
          size: 20,
        },
      ]);
      return (
        <MarkerOverlay
          markers={markers}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
        />
      );
    }
    render(<Fixture />);
  });

  it("anchors a marker to a series by seriesId", () => {
    function Fixture() {
      const markers = useSharedValue<Marker[]>([
        { id: "s", time: 990, kind: "winner", seriesId: "a" },
      ]);
      const series = useSharedValue<SeriesConfig[]>([
        {
          id: "a",
          value: 0,
          data: [
            { time: 980, value: 20 },
            { time: 1000, value: 40 },
          ],
        },
      ]);
      return (
        <MarkerOverlay
          markers={markers}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
          series={series}
        />
      );
    }
    render(<Fixture />);
  });
});
