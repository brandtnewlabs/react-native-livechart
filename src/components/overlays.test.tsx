import { render } from "@testing-library/react-native";
import { Skia } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";
import React from "react";
import { DEFAULT_PADDING } from "../draw/line";
import type { EngineState } from "../useLivelineEngine";
import { resolveTheme } from "../theme";
import { AnimatedLabel } from "./AnimatedLabel";
import { BadgeOverlay } from "./BadgeOverlay";
import { GridOverlay } from "./GridOverlay";
import { TimeAxisOverlay } from "./TimeAxisOverlay";

const font = {
  getSize: () => 12,
  getTextWidth: (s: string) => s.length * 7,
} as never;

const palette = resolveTheme("#3b82f6", "dark");

function engine(): EngineState {
  return {
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 1 },
    displayMin: { value: 0 },
    displayMax: { value: 10 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 1700000000 },
  } as unknown as EngineState;
}

describe("AnimatedLabel", () => {
  it("renders off-screen when index missing", () => {
    function Fixture() {
      const entries = useSharedValue([{ x: 1, y: 2, label: "a", alpha: 1 }]);
      return (
        <AnimatedLabel entries={entries} index={5} font={font} color="#fff" />
      );
    }
    render(<Fixture />);
  });
});

describe("BadgeOverlay", () => {
  it("renders badge path and text", () => {
    function Fixture() {
      const badge = useSharedValue({
        path: Skia.Path.Make(),
        textX: 10,
        textY: 20,
        text: "9.99",
        bgColor: "#000",
        textColor: "#fff",
      });
      return <BadgeOverlay badge={badge} font={font} />;
    }
    render(<Fixture />);
  });
});

describe("GridOverlay", () => {
  it("renders grid lines and labels", () => {
    function Fixture() {
      const entries = useSharedValue([{ y: 40, label: "10", alpha: 1 }]);
      return (
        <GridOverlay
          entries={entries}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
        />
      );
    }
    render(<Fixture />);
  });
});

describe("TimeAxisOverlay", () => {
  it("renders axis and labels", () => {
    function Fixture() {
      const entries = useSharedValue([{ x: 50, label: "12:00", alpha: 1 }]);
      return (
        <TimeAxisOverlay
          entries={entries}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
        />
      );
    }
    render(<Fixture />);
  });
});
