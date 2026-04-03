import { AnimatedLabel } from "./AnimatedLabel";
import { BadgeOverlay } from "./BadgeOverlay";
import { DEFAULT_PADDING } from "../draw/line";
import { DotOverlay } from "./DotOverlay";
import type { EngineState } from "../useLivelineEngine";
import { GridOverlay } from "./GridOverlay";
import React from "react";
import { Skia } from "@shopify/react-native-skia";
import { TimeAxisOverlay } from "./TimeAxisOverlay";
import { render } from "@testing-library/react-native";
import { resolveTheme } from "../theme";
import { useSharedValue } from "react-native-reanimated";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({
    x: 0,
    y: 0,
    width: s.length * 7,
    height: 12,
  }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
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

describe("DotOverlay", () => {
  it("renders pulse ring when pulse is on and timestamp is in active segment", () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      const momentum = useSharedValue<"up" | "down" | "flat">("flat");
      const eng = {
        ...engine(),
        timestamp: { value: 0 },
      } as unknown as EngineState;
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          momentum={momentum}
          palette={palette}
          engine={eng}
          pulse
        />
      );
    }
    render(<Fixture />);
  });

  it("defaults pulse to on when the prop is omitted", () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      const momentum = useSharedValue<"up" | "down" | "flat">("flat");
      const eng = {
        ...engine(),
        timestamp: { value: 0 },
      } as unknown as EngineState;
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          momentum={momentum}
          palette={palette}
          engine={eng}
        />
      );
    }
    render(<Fixture />);
  });

  it("skips pulse ring math when pulse is off", () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      const momentum = useSharedValue<"up" | "down" | "flat">("up");
      const eng = engine();
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          momentum={momentum}
          palette={palette}
          engine={eng}
          pulse={false}
        />
      );
    }
    render(<Fixture />);
  });

  it("uses glow colors for up and down momentum", () => {
    function Fixture({ m }: { m: "up" | "down" }) {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      const momentum = useSharedValue<"up" | "down" | "flat">(m);
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          momentum={momentum}
          palette={palette}
          engine={engine()}
          pulse={false}
        />
      );
    }
    render(<Fixture m="up" />);
    render(<Fixture m="down" />);
  });

  it("zeros pulse radius when the cycle is past the active window", () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      const momentum = useSharedValue<"up" | "down" | "flat">("flat");
      const eng = {
        ...engine(),
        timestamp: { value: 1 },
      } as unknown as EngineState;
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          momentum={momentum}
          palette={palette}
          engine={eng}
          pulse
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
