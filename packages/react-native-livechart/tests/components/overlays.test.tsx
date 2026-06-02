import { AnimatedLabel } from "../../src/components/AnimatedLabel";
import { BadgeOverlay } from "../../src/components/BadgeOverlay";
import { CrosshairOverlay } from "../../src/components/CrosshairOverlay";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { DotOverlay } from "../../src/components/DotOverlay";
import type { EngineState } from "../../src/core/useLiveChartEngine";
import { LoadingOverlay } from "../../src/components/LoadingOverlay";
import { MultiSeriesTooltipStack } from "../../src/components/MultiSeriesTooltipStack";
import React from "react";
import type { ReferenceLine } from "../../src/types";
import { ReferenceLineOverlay } from "../../src/components/ReferenceLineOverlay";
import { Skia } from "@shopify/react-native-skia";
import type { TooltipLayout } from "../../src/hooks/crosshairShared";
import { ValueLineOverlay } from "../../src/components/ValueLineOverlay";
import { XAxisOverlay } from "../../src/components/XAxisOverlay";
import { YAxisOverlay } from "../../src/components/YAxisOverlay";
import { render } from "@testing-library/react-native";
import { resolvePulse } from "../../src/core/resolveConfig";
import { resolveTheme } from "../../src/theme";
import { useSharedValue } from "react-native-reanimated";
import { withSharedValueAccessors } from "../support/sharedValueMock";

const PULSE_ON = resolvePulse(true)!;

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
  return withSharedValueAccessors({
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 1 },
    displayMin: { value: 0 },
    displayMax: { value: 10 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 1700000000 },
  }) as unknown as EngineState;
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

describe("YAxisOverlay", () => {
  it("renders grid lines and labels", () => {
    function Fixture() {
      const entries = useSharedValue([{ y: 40, label: "10", alpha: 1 }]);
      return (
        <YAxisOverlay
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
      const eng = withSharedValueAccessors({
        ...engine(),
        timestamp: { value: 0 },
      }) as unknown as EngineState;
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          palette={palette}
          engine={eng}
          pulse={PULSE_ON}
        />
      );
    }
    render(<Fixture />);
  });

  it("renders with pulse disabled", () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      const eng = withSharedValueAccessors({
        ...engine(),
        timestamp: { value: 0 },
      }) as unknown as EngineState;
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          palette={palette}
          engine={eng}
          pulse={null}
        />
      );
    }
    render(<Fixture />);
  });

  it("skips pulse ring math when pulse is null", () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      const eng = engine();
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          palette={palette}
          engine={eng}
          pulse={null}
        />
      );
    }
    render(<Fixture />);
  });

  it("renders inner and outer dot circles", () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          palette={palette}
          engine={engine()}
          pulse={null}
        />
      );
    }
    render(<Fixture />);
  });

  it("zeros pulse radius when the cycle is past the active window", () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      const eng = withSharedValueAccessors({
        ...engine(),
        timestamp: { value: 1 },
      }) as unknown as EngineState;
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          palette={palette}
          engine={eng}
          pulse={PULSE_ON}
        />
      );
    }
    render(<Fixture />);
  });
});

describe("LoadingOverlay", () => {
  function makeLoadingEngine(w = 400, h = 300): EngineState {
    return withSharedValueAccessors({
      ...engine(),
      canvasWidth: { value: w },
      canvasHeight: { value: h },
    }) as unknown as EngineState;
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

  it("renders empty-state label when isEmpty", () => {
    function Fixture() {
      const morphT = useSharedValue(1);
      const isLoading = useSharedValue(false);
      const isEmpty = useSharedValue(true);
      return (
        <LoadingOverlay
          engine={makeLoadingEngine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
          morphT={morphT}
          isLoading={isLoading}
          isEmpty={isEmpty}
          emptyText="Nothing here"
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
    stackedLines: undefined,
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
        stackedLines: undefined,
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

  it("renders stacked multi-series tooltip lines", () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const tooltipLayout = useSharedValue<TooltipLayout>({
        x: 110,
        y: 20,
        w: 120,
        h: 56,
        valueStr: "",
        timeStr: "",
        valueTextX: -400,
        timeTextX: -400,
        line1Y: 0,
        line2Y: 0,
        stackedLines: [
          { text: "12:00:00", textX: 118, baselineY: 30, dim: true },
          { text: "A: 5.00", textX: 116, baselineY: 48, dim: false },
        ],
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
          tooltipBody={
            <MultiSeriesTooltipStack
              tooltipLayout={tooltipLayout}
              font={font}
              palette={palette}
            />
          }
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

describe("XAxisOverlay", () => {
  it("renders axis and labels", () => {
    function Fixture() {
      const entries = useSharedValue([{ x: 50, label: "12:00", alpha: 1 }]);
      return (
        <XAxisOverlay
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
  const fmt = (v: number) => v.toFixed(2);

  function renderLine(line: ReferenceLine) {
    function Fixture() {
      return (
        <ReferenceLineOverlay
          engine={engine()}
          padding={DEFAULT_PADDING}
          line={line}
          palette={palette}
          formatValue={fmt}
          font={font}
        />
      );
    }
    render(<Fixture />);
  }

  it("renders a horizontal line (Form A) in range", () => {
    renderLine({ value: 5, label: "mid" });
  });

  it("renders a horizontal value band (Form B)", () => {
    renderLine({ valueFrom: 2, valueTo: 8, color: "#fbbf24", label: "band" });
  });

  it("renders a vertical time band (Form C)", () => {
    renderLine({
      from: 1700000000 - 20,
      to: 1700000000 - 5,
      label: "window",
      labelPosition: "right",
    });
  });

  it("renders an off-axis badge when the value is above range", () => {
    renderLine({ value: 99, offAxisBadge: true, offAxisBadgeLabel: "Target" });
  });

  it("renders a styled off-axis badge (background / border / radius)", () => {
    renderLine({
      value: 99,
      offAxisBadge: true,
      offAxisBadgeLabel: "Target",
      badgeBackground: "#111827",
      badgeBorderColor: "#ffffff",
      badgeRadius: 12,
    });
  });

  it("renders a value band with a dashed border + custom fill opacity", () => {
    renderLine({
      valueFrom: 2,
      valueTo: 8,
      color: "#fbbf24",
      strokeWidth: 1.5,
      intervals: [4, 2],
      fillOpacity: 0.3,
    });
  });

  it("renders a time band with a dashed border", () => {
    renderLine({
      from: 1700000000 - 20,
      to: 1700000000 - 5,
      strokeWidth: 2,
    });
  });

  it("culls an off-screen line without offAxisBadge", () => {
    renderLine({ value: 99 });
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
          strokeWidth={1}
          intervals={[4, 4]}
          color={palette.dashLine}
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
          strokeWidth={1}
          intervals={[4, 4]}
          color={palette.dashLine}
        />
      );
    }
    render(<Fixture />);
  });
});
