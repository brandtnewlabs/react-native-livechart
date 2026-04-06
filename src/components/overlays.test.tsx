import { AnimatedLabel } from "./AnimatedLabel";
import { BadgeOverlay } from "./BadgeOverlay";
import { CrosshairOverlay } from "./CrosshairOverlay";
import { DEFAULT_PADDING } from "../draw/line";
import { DotOverlay } from "./DotOverlay";
import type { EngineState } from "../useLivelineEngine";
import { GridOverlay } from "./GridOverlay";
import { LoadingOverlay } from "./LoadingOverlay";
import React from "react";
import type { ReferenceLineLayout } from "../hooks/useReferenceLine";
import { ReferenceLineOverlay } from "./ReferenceLineOverlay";
import { Skia } from "@shopify/react-native-skia";
import { TimeAxisOverlay } from "./TimeAxisOverlay";
import type { TooltipLayout } from "../hooks/useCrosshair";
import { ValueLineOverlay } from "./ValueLineOverlay";
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

describe("LoadingOverlay", () => {
  function makeLoadingEngine(w = 400, h = 300): EngineState {
    return {
      ...engine(),
      canvasWidth: { value: w },
      canvasHeight: { value: h },
    } as unknown as EngineState;
  }

  it("renders in loading state with badge alignment (badge=true)", () => {
    function Fixture() {
      const morphT = useSharedValue(0);
      const isLoading = useSharedValue(true);
      const isEmpty = useSharedValue(false);
      return (
        <LoadingOverlay
          engine={makeLoadingEngine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
          morphT={morphT}
          isLoading={isLoading}
          isEmpty={isEmpty}
          emptyText="No data"
          strokeWidth={2}
          badge
        />
      );
    }
    render(<Fixture />);
  });

  it("renders in loading state without badge (uses default badge=false)", () => {
    function Fixture() {
      const morphT = useSharedValue(0);
      const isLoading = useSharedValue(true);
      const isEmpty = useSharedValue(false);
      return (
        <LoadingOverlay
          engine={makeLoadingEngine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
          morphT={morphT}
          isLoading={isLoading}
          isEmpty={isEmpty}
          emptyText="No data"
          strokeWidth={2}
        />
      );
    }
    render(<Fixture />);
  });

  it("renders with zero canvas size (early return path)", () => {
    function Fixture() {
      const morphT = useSharedValue(0.5);
      const isLoading = useSharedValue(true);
      const isEmpty = useSharedValue(false);
      return (
        <LoadingOverlay
          engine={makeLoadingEngine(0, 0)}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
          morphT={morphT}
          isLoading={isLoading}
          isEmpty={isEmpty}
          emptyText="No data"
          strokeWidth={2}
        />
      );
    }
    render(<Fixture />);
  });

  it("renders in revealed state (morphT=1, not loading)", () => {
    function Fixture() {
      const morphT = useSharedValue(1);
      const isLoading = useSharedValue(false);
      const isEmpty = useSharedValue(false);
      return (
        <LoadingOverlay
          engine={makeLoadingEngine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
          morphT={morphT}
          isLoading={isLoading}
          isEmpty={isEmpty}
          emptyText="No data"
          strokeWidth={2}
        />
      );
    }
    render(<Fixture />);
  });
});

describe("CrosshairOverlay", () => {
  const hiddenTooltip: TooltipLayout = {
    x: -400,
    y: 0,
    w: 0,
    h: 0,
    valueStr: "",
    timeStr: "",
    valueTextX: -400,
    timeTextX: -400,
    line1Y: 0,
    line2Y: 0,
  };

  it("renders crosshair line and dim rect", () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const tooltipLayout = useSharedValue<TooltipLayout>(hiddenTooltip);
      return (
        <CrosshairOverlay
          scrubX={scrubX}
          crosshairOpacity={crosshairOpacity}
          tooltipLayout={tooltipLayout}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
        />
      );
    }
    render(<Fixture />);
  });

  it("renders tooltip pill when showTooltip=true", () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const tooltipLayout = useSharedValue<TooltipLayout>({
        x: 110,
        y: 20,
        w: 80,
        h: 40,
        valueStr: "42.00",
        timeStr: "12:00:00",
        valueTextX: 115,
        timeTextX: 115,
        line1Y: 30,
        line2Y: 45,
      });
      return (
        <CrosshairOverlay
          scrubX={scrubX}
          crosshairOpacity={crosshairOpacity}
          tooltipLayout={tooltipLayout}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
          showTooltip
        />
      );
    }
    render(<Fixture />);
  });

  it("hides tooltip when showTooltip=false", () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(0.5);
      const tooltipLayout = useSharedValue<TooltipLayout>(hiddenTooltip);
      return (
        <CrosshairOverlay
          scrubX={scrubX}
          crosshairOpacity={crosshairOpacity}
          tooltipLayout={tooltipLayout}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
          showTooltip={false}
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

describe("ReferenceLineOverlay", () => {
  const visibleLayout: ReferenceLineLayout = {
    y: 142,
    x1: 12,
    x2: 320,
    label: "50.00",
    labelX: 324,
    labelY: 139,
    visible: true,
  };

  const invisibleLayout: ReferenceLineLayout = {
    y: -1,
    x1: 0,
    x2: 0,
    label: "",
    labelX: 0,
    labelY: -1,
    visible: false,
  };

  it("renders dashed line and label when visible", () => {
    function Fixture() {
      const layout = useSharedValue(visibleLayout);
      return (
        <ReferenceLineOverlay layout={layout} palette={palette} font={font} />
      );
    }
    render(<Fixture />);
  });

  it("renders with zero opacity when not visible", () => {
    function Fixture() {
      const layout = useSharedValue(invisibleLayout);
      return (
        <ReferenceLineOverlay layout={layout} palette={palette} font={font} />
      );
    }
    render(<Fixture />);
  });
});

describe("ValueLineOverlay", () => {
  it("draws line when dotY is in chart area", () => {
    function Fixture() {
      const dotY = useSharedValue(120);
      return (
        <ValueLineOverlay
          dotY={dotY}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
        />
      );
    }
    render(<Fixture />);
  });

  it("returns empty path when dotY is negative (off-screen)", () => {
    function Fixture() {
      const dotY = useSharedValue(-1);
      return (
        <ValueLineOverlay
          dotY={dotY}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
        />
      );
    }
    render(<Fixture />);
  });
});
