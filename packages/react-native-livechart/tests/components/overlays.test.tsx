import { AnimatedLabel } from "../../src/components/AnimatedLabel";
import { BadgeOverlay } from "../../src/components/BadgeOverlay";
import { CrosshairLine } from "../../src/components/CrosshairLine";
import { CrosshairOverlay } from "../../src/components/CrosshairOverlay";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { DotOverlay } from "../../src/components/DotOverlay";
import type { EngineState } from "../../src/core/useLiveChartEngine";
import { LoadingOverlay } from "../../src/components/LoadingOverlay";
import { MultiSeriesTooltipStack } from "../../src/components/MultiSeriesTooltipStack";
import React from "react";
import type { ReferenceLine, SelectionDotProps } from "../../src/types";
import { ReferenceLineOverlay } from "../../src/components/ReferenceLineOverlay";
import { Circle, Skia } from "@shopify/react-native-skia";
import type { TooltipLayout } from "../../src/hooks/crosshairShared";
import { ValueLineOverlay } from "../../src/components/ValueLineOverlay";
import { XAxisOverlay } from "../../src/components/XAxisOverlay";
import {
  YAxisOverlay,
  yAxisLabelIntersectsBadge,
} from "../../src/components/YAxisOverlay";
import { render } from "@testing-library/react-native";
import {
  resolvePulse,
  resolveSelectionDot,
} from "../../src/core/resolveConfig";
import { resolveTheme } from "../../src/theme";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { withSharedValueAccessors } from "../support/sharedValueMock";
import { getAllByHostType } from "../rntl14";

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

function expectConfiguredCrosshair(tree: unknown) {
  const serialized = JSON.stringify(tree);
  expect(serialized).toContain('"strokeWidth":3');
  expect(serialized).toContain('"strokeCap":"round"');
  expect(serialized).toContain(`\\"y\\":${DEFAULT_PADDING.top - 6}`);
  expect(serialized).toContain(
    `\\"y\\":${300 - DEFAULT_PADDING.bottom + 6}`,
  );
  expect(serialized).toContain('"opacity":"1"');
  expect(serialized).toContain("rgba(0,0,0,0.175)");
}

describe("AnimatedLabel", () => {
  it("renders off-screen when index missing", async () => {
    function Fixture() {
      const entries = useSharedValue([{ x: 1, y: 2, label: "a", alpha: 1 }]);
      return (
        <AnimatedLabel entries={entries} index={5} font={font} color="#fff" />
      );
    }
    await render(<Fixture />);
  });
});

describe("BadgeOverlay", () => {
  it("renders badge path and text", async () => {
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
    await render(<Fixture />);
  });

  it("renders a bordered, offset badge (stroke path + transform branch)", async () => {
    function Fixture() {
      const badge = useSharedValue({
        path: Skia.Path.Make(),
        textX: 10,
        textY: 20,
        text: "9.99",
        bgColor: "#000",
        textColor: "#fff",
      });
      return (
        <BadgeOverlay
          badge={badge}
          font={font}
          borderColor="#ff00ff"
          borderWidth={2}
          offsetX={-4}
          offsetY={6}
        />
      );
    }
    await render(<Fixture />);
  });
});

describe("YAxisOverlay", () => {
  it("detects vertical overlap with the live badge pill", () => {
    expect(yAxisLabelIntersectsBadge(100, 12, 100, 18)).toBe(true);
    expect(yAxisLabelIntersectsBadge(100, 12, 116, 18)).toBe(false);
  });

  it("renders grid lines and labels", async () => {
    const makeBuilder = Skia.PathBuilder.Make as jest.Mock;
    const resultIndex = makeBuilder.mock.results.length;

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
    await render(<Fixture />);

    const builder = makeBuilder.mock.results[resultIndex].value;
    expect(builder.lineTo).toHaveBeenCalledWith(388, 40);
  });

  it("ends grid lines before the right-anchored label column", async () => {
    const makeBuilder = Skia.PathBuilder.Make as jest.Mock;
    const resultIndex = makeBuilder.mock.results.length;

    function Fixture() {
      const entries = useSharedValue([
        { y: 40, label: "10", alpha: 1 },
        { y: 80, label: "100000", alpha: 1 },
      ]);
      return (
        <YAxisOverlay
          entries={entries}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
          labelRightMargin={8}
          gridEndGap={6}
        />
      );
    }

    const screen = await render(<Fixture />);

    // 400 canvas - 8 edge margin - 42 widest label - 6 grid gap = 344.
    const builder = makeBuilder.mock.results[resultIndex].value;
    expect(builder.lineTo).toHaveBeenNthCalledWith(1, 344, 40);
    expect(builder.lineTo).toHaveBeenNthCalledWith(2, 344, 80);

    const labels = getAllByHostType(screen, View)
      .filter(
        (view) =>
          view.props.text?.value === "10" ||
          view.props.text?.value === "100000",
      );
    expect(labels.map((view) => view.props.x.value)).toEqual([350, 350]);
  });

  it("renders with live-badge collision suppression enabled", async () => {
    function Fixture() {
      const entries = useSharedValue([{ y: 40, label: "10", alpha: 1 }]);
      const badgeCenterY = useSharedValue(40);
      const badgeOpacity = useSharedValue(0);
      return (
        <YAxisOverlay
          entries={entries}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          font={font}
          badge
          badgeCenterY={badgeCenterY}
          badgeFontSize={12}
          badgeOffsetY={2}
          badgeOpacity={badgeOpacity}
        />
      );
    }
    await render(<Fixture />);
  });
});

describe("DotOverlay", () => {
  it("renders pulse ring when pulse is on", async () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          palette={palette}
          radius={3.5}
          ring={{ color: undefined, width: 2.5 }}
          color={undefined}
          pulse={PULSE_ON}
        />
      );
    }
    await render(<Fixture />);
  });

  it("suppresses the pulse while time-scrolled (viewEnd frozen)", async () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      const viewEnd = useSharedValue<number | null>(900); // scrolled back
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          palette={palette}
          radius={3.5}
          ring={{ color: undefined, width: 2.5 }}
          color={undefined}
          pulse={PULSE_ON}
          viewEnd={viewEnd}
        />
      );
    }
    await render(<Fixture />);
  });

  it("keeps the pulse while time-scrolled when pulseWhileParked is set", async () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      const viewEnd = useSharedValue<number | null>(900); // scrolled back
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          palette={palette}
          radius={3.5}
          ring={{ color: undefined, width: 2.5 }}
          color={undefined}
          pulse={PULSE_ON}
          viewEnd={viewEnd}
          pulseWhileParked
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders with pulse disabled", async () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          palette={palette}
          radius={3.5}
          ring={null}
          color={undefined}
          pulse={null}
        />
      );
    }
    await render(<Fixture />);
  });

  it("skips pulse ring math when pulse is null", async () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          palette={palette}
          radius={3.5}
          ring={null}
          color={undefined}
          pulse={null}
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders inner and outer dot circles", async () => {
    function Fixture() {
      const dotX = useSharedValue(100);
      const dotY = useSharedValue(120);
      return (
        <DotOverlay
          dotX={dotX}
          dotY={dotY}
          palette={palette}
          radius={3.5}
          ring={{ color: undefined, width: 2.5 }}
          color="#abcdef"
          pulse={null}
        />
      );
    }
    await render(<Fixture />);
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

  it("renders in loading state with badge alignment (badge=true)", async () => {
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
    await render(<Fixture />);
  });

  it("renders in loading state without badge (uses default badge=false)", async () => {
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
    await render(<Fixture />);
  });

  it("renders in loading state without skeleton axis labels (showAxisLabels=false)", async () => {
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
          showAxisLabels={false}
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders with zero canvas size (early return path)", async () => {
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
    await render(<Fixture />);
  });

  it("renders in revealed state (morphT=1, not loading)", async () => {
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
    await render(<Fixture />);
  });

  it("renders empty-state label when isEmpty", async () => {
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
    await render(<Fixture />);
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

  it("renders crosshair line and dim rect", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
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
          scrubActive={scrubActive}
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders a dashed crosshair line when crosshairDash is set", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
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
          scrubActive={scrubActive}
          crosshairDash={[4, 4]}
        />
      );
    }
    await render(<Fixture />);
  });

  it("can hide the crosshair line and selection dot while keeping the overlay", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const selectionY = useSharedValue(120);
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
          scrubActive={scrubActive}
          showLine={false}
          selectionDot={null}
          selectionY={selectionY}
          showTooltip={false}
          dimOpacity={1}
        />
      );
    }
    const tree = JSON.stringify((await render(<Fixture />)).toJSON());
    expect(tree).not.toContain(palette.crosshairLine);
    expect(tree).not.toContain('"cx"');
  });

  it("applies crosshair stroke width, overshoot, and disabled edge fade", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(0.25);
      const scrubActive = useSharedValue(true);
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
          scrubActive={scrubActive}
          crosshairStrokeWidth={3}
          crosshairOvershoot={6}
          crosshairFade={false}
          crosshairLineCap="round"
        />
      );
    }
    const { toJSON } = await render(<Fixture />);
    expectConfiguredCrosshair(toJSON());
  });

  it("uses the configured visible fade without changing the trailing dim ramp", async () => {
    function Fixture() {
      const scrubX = useSharedValue(
        400 - DEFAULT_PADDING.right - 2,
      );
      // This stays on the controller's original 4 px fade: 2 / 4 = 0.5.
      const crosshairOpacity = useSharedValue(0.5);
      const scrubActive = useSharedValue(true);
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
          scrubActive={scrubActive}
          crosshairFadeDistance={8}
        />
      );
    }
    const tree = JSON.stringify((await render(<Fixture />)).toJSON());
    expect(tree).toContain('"opacity":"0.25"');
    expect(tree).toContain("rgba(0,0,0,0.35)");
  });

  it("keeps a custom top-tooltip line stop when overshoot is set", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const lineTop = useSharedValue(48);
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
          scrubActive={scrubActive}
          lineTop={lineTop}
          crosshairOvershoot={6}
        />
      );
    }
    const tree = JSON.stringify((await render(<Fixture />)).toJSON());
    expect(tree).toContain('\\"y\\":48');
    expect(tree).not.toContain('\\"y\\":42');
  });

  it("renders tooltip pill when showTooltip=true", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
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
          scrubActive={scrubActive}
          showTooltip
        />
      );
    }
    await render(<Fixture />);
  });

  it("omits the value row when tooltipShowValue is false (date-only)", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const tooltipLayout = useSharedValue<TooltipLayout>({
        x: 110,
        y: 20,
        w: 80,
        h: 24,
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
          scrubActive={scrubActive}
          showTooltip
          tooltipShowValue={false}
          tooltipBorderRadius={9}
        />
      );
    }
    const { toJSON } = await render(<Fixture />);
    const tree = JSON.stringify(toJSON());
    // Value row dropped, time row kept; custom radius applied to the pill.
    expect(tree).not.toContain("42.00");
    expect(tree).toContain("12:00:00");
    expect(tree).toContain('"r":9');
  });

  it("keeps the time row when both built-in tooltip rows are disabled", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const tooltipLayout = useSharedValue<TooltipLayout>({
        x: 110,
        y: 20,
        w: 80,
        h: 24,
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
          scrubActive={scrubActive}
          showTooltip
          tooltipShowValue={false}
          tooltipShowTime={false}
        />
      );
    }
    const { toJSON } = await render(<Fixture />);
    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain("42.00");
    expect(tree).toContain("12:00:00");
  });

  it("renders stacked multi-series tooltip lines", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
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
          scrubActive={scrubActive}
          showTooltip
        >
          <MultiSeriesTooltipStack
            tooltipLayout={tooltipLayout}
            font={font}
            palette={palette}
          />
        </CrosshairOverlay>
      );
    }
    await render(<Fixture />);
  });

  it("hides tooltip when showTooltip=false", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(0.5);
      const scrubActive = useSharedValue(true);
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
          scrubActive={scrubActive}
          showTooltip={false}
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders the built-in selection dot for the default config", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const selectionY = useSharedValue(140);
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
          selectionDot={resolveSelectionDot(true)}
          selectionY={selectionY}
          scrubActive={scrubActive}
          selectionColor="#abcdef"
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders the configured built-in dot (size/color/ring knobs)", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const selectionY = useSharedValue(140);
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
          selectionDot={resolveSelectionDot({
            size: 6,
            color: "#fbbf24",
            ring: { width: 3 },
          })}
          selectionY={selectionY}
          scrubActive={scrubActive}
          selectionColor="#abcdef"
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders a flat dot (no ring) when ring is off", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const selectionY = useSharedValue(140);
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
          selectionDot={resolveSelectionDot({ ring: false })}
          selectionY={selectionY}
          scrubActive={scrubActive}
        />
      );
    }
    await render(<Fixture />);
  });

  it("hides the built-in dot off-screen when selectionY is negative (sentinel)", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const selectionY = useSharedValue(-1);
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
          selectionDot={resolveSelectionDot(true)}
          selectionY={selectionY}
          scrubActive={scrubActive}
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders no dot when selectionDot resolves to null (selectionDot={false})", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const selectionY = useSharedValue(140);
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
          selectionDot={resolveSelectionDot(false)}
          selectionY={selectionY}
          scrubActive={scrubActive}
          selectionColor="#abcdef"
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders a custom selection-dot component", async () => {
    const Custom = ({ x, y, color, size }: SelectionDotProps) => (
      <Circle cx={x} cy={y} r={size} color={color} />
    );
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const selectionY = useSharedValue(140);
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
          selectionDot={resolveSelectionDot({ size: 6, component: Custom })}
          selectionY={selectionY}
          scrubActive={scrubActive}
          selectionColor="#abcdef"
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders a custom tooltip body via renderTooltip", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
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
          scrubActive={scrubActive}
          showTooltip
          renderTooltip={() => <Circle cx={1} cy={2} r={3} color="#fff" />}
        />
      );
    }
    await render(<Fixture />);
  });
});

describe("CrosshairLine", () => {
  it("stays visible at zero edge opacity when fade is disabled", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(0);
      const scrubActive = useSharedValue(true);
      return (
        <CrosshairLine
          scrubX={scrubX}
          crosshairOpacity={crosshairOpacity}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          scrubActive={scrubActive}
          crosshairFade={false}
        />
      );
    }
    expect(JSON.stringify((await render(<Fixture />)).toJSON())).toContain(
      '"opacity":"1"',
    );
  });

  it("renders the built-in selection dot for the default config", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const selectionY = useSharedValue(140);
      return (
        <CrosshairLine
          scrubX={scrubX}
          crosshairOpacity={crosshairOpacity}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          selectionDot={resolveSelectionDot(true)}
          selectionY={selectionY}
          scrubActive={scrubActive}
          selectionColor="#abcdef"
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders no dot when selectionDot resolves to null (selectionDot={false})", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const selectionY = useSharedValue(140);
      return (
        <CrosshairLine
          scrubX={scrubX}
          crosshairOpacity={crosshairOpacity}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          selectionDot={resolveSelectionDot(false)}
          selectionY={selectionY}
          scrubActive={scrubActive}
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders nothing for the dot when selectionY is absent", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      return (
        <CrosshairLine
          scrubX={scrubX}
          crosshairOpacity={crosshairOpacity}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          selectionDot={resolveSelectionDot(true)}
          scrubActive={scrubActive}
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders a custom selection-dot component", async () => {
    const Custom = ({ x, y, color, size }: SelectionDotProps) => (
      <Circle cx={x} cy={y} r={size} color={color} />
    );
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const selectionY = useSharedValue(140);
      return (
        <CrosshairLine
          scrubX={scrubX}
          crosshairOpacity={crosshairOpacity}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          selectionDot={resolveSelectionDot({ component: Custom })}
          selectionY={selectionY}
          scrubActive={scrubActive}
          selectionColor="#abcdef"
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders a dashed crosshair line when crosshairDash is set", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(1);
      const scrubActive = useSharedValue(true);
      const selectionY = useSharedValue(140);
      return (
        <CrosshairLine
          scrubX={scrubX}
          crosshairOpacity={crosshairOpacity}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          selectionDot={resolveSelectionDot(true)}
          selectionY={selectionY}
          scrubActive={scrubActive}
          crosshairDash={[4, 4]}
        />
      );
    }
    await render(<Fixture />);
  });

  it("applies crosshair stroke width, overshoot, and disabled edge fade", async () => {
    function Fixture() {
      const scrubX = useSharedValue(100);
      const crosshairOpacity = useSharedValue(0.25);
      const scrubActive = useSharedValue(true);
      const selectionY = useSharedValue(140);
      return (
        <CrosshairLine
          scrubX={scrubX}
          crosshairOpacity={crosshairOpacity}
          engine={engine()}
          padding={DEFAULT_PADDING}
          palette={palette}
          selectionDot={resolveSelectionDot(true)}
          selectionY={selectionY}
          scrubActive={scrubActive}
          crosshairStrokeWidth={3}
          crosshairOvershoot={6}
          crosshairFade={false}
          crosshairLineCap="round"
        />
      );
    }
    const { toJSON } = await render(<Fixture />);
    expectConfiguredCrosshair(toJSON());
  });
});

describe("XAxisOverlay", () => {
  it("renders axis and labels", async () => {
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
    await render(<Fixture />);
  });
});

describe("ReferenceLineOverlay", () => {
  const fmt = (v: number) => v.toFixed(2);

  function renderLine(line: ReferenceLine) {
    function Fixture() {
      // Both passes: base (lines/bands) + badge (pills/labels above the fade).
      return (
        <>
          <ReferenceLineOverlay
            engine={engine()}
            padding={DEFAULT_PADDING}
            line={line}
            palette={palette}
            formatValue={fmt}
            font={font}
          />
          <ReferenceLineOverlay
            engine={engine()}
            padding={DEFAULT_PADDING}
            line={line}
            palette={palette}
            formatValue={fmt}
            font={font}
            badgeLayer
          />
        </>
      );
    }
    render(<Fixture />);
  }

  it("renders a horizontal line (Form A) in range", () => {
    renderLine({ value: 5, label: "mid" });
  });

  it("clips a plain line to the right-anchored Y-axis column", async () => {
    const makeBuilder = Skia.PathBuilder.Make as jest.Mock;
    const resultIndex = makeBuilder.mock.results.length;

    function Fixture() {
      const yAxisEntries = useSharedValue([
        { y: 40, label: "10", alpha: 1 },
        { y: 80, label: "100000", alpha: 1 },
      ]);
      return (
        <ReferenceLineOverlay
          engine={engine()}
          padding={DEFAULT_PADDING}
          line={{ value: 5, label: "mid" }}
          palette={palette}
          formatValue={fmt}
          font={font}
          yAxisEntries={yAxisEntries}
          labelRightMargin={8}
          gridEndGap={6}
        />
      );
    }

    await render(<Fixture />);

    const lineBuilder = makeBuilder.mock.results[resultIndex].value;
    expect(lineBuilder.lineTo).toHaveBeenCalledWith(344, 142);
  });

  it("renders a full-width Form-A line (edge to edge through the gutter)", () => {
    renderLine({ value: 5, label: "mid", fullWidth: true });
  });

  it("renders a full-width badged line (line drawn + connector dropped)", () => {
    renderLine({ value: 5, badge: true, fullWidth: true });
  });

  it("renders a horizontal value band (Form B)", () => {
    renderLine({ valueFrom: 2, valueTo: 8, color: "#fbbf24", label: "band" });
  });

  it("renders a full-width value band", () => {
    renderLine({
      valueFrom: 2,
      valueTo: 8,
      color: "#fbbf24",
      strokeWidth: 1,
      fullWidth: true,
    });
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

  it("renders an in-range pill badge with an icon", () => {
    renderLine({
      value: 5,
      label: "Limit buy",
      showValue: true,
      badge: {
        icon: "▲",
        background: "rgba(22,163,74,0.15)",
        borderColor: "#16a34a",
        radius: 6,
      },
    });
  });

  it("keeps a custom badge's connector and starts it after its measured edge", async () => {
    type MockBuilder = { moveTo: jest.Mock; lineTo: jest.Mock };
    const make = Skia.PathBuilder.Make as unknown as jest.Mock;
    make.mockClear();
    const tagWidth = 80;
    const y =
      DEFAULT_PADDING.top +
      ((10 - 5) / 10) * (300 - DEFAULT_PADDING.top - DEFAULT_PADDING.bottom);
    function Fixture() {
      const customTagWidths = useSharedValue([tagWidth]);
      return (
        <ReferenceLineOverlay
          engine={engine()}
          padding={DEFAULT_PADDING}
          line={{ value: 5, badge: true }}
          palette={palette}
          formatValue={fmt}
          font={font}
          badgeLayer
          suppressTag
          customTagWidths={customTagWidths}
        />
      );
    }

    await render(<Fixture />);
    const builders = make.mock.results.map(
      ({ value }) => value as unknown as MockBuilder,
    );
    const connector = builders.find((builder) =>
      builder.moveTo.mock.calls.some(
        ([x, lineY]) =>
          x === DEFAULT_PADDING.left + 2 + tagWidth + 4 && lineY === y,
      ),
    );
    expect(connector).toBeDefined();
    expect(connector?.lineTo).toHaveBeenCalledWith(
      400 - DEFAULT_PADDING.right,
      y,
    );
    make.mockClear();
  });

  it("uses the custom connector edge only while an off-axis tag is active", async () => {
    type MockBuilder = { moveTo: jest.Mock; lineTo: jest.Mock };
    const make = Skia.PathBuilder.Make as unknown as jest.Mock;
    make.mockClear();
    const tagWidth = 80;
    function Fixture() {
      const customTagWidths = useSharedValue([tagWidth]);
      return (
        <ReferenceLineOverlay
          engine={engine()}
          padding={DEFAULT_PADDING}
          line={{ value: 99, badge: true }}
          palette={palette}
          formatValue={fmt}
          font={font}
          badgeLayer
          suppressTagWhenOffAxis
          customTagWidths={customTagWidths}
        />
      );
    }

    await render(<Fixture />);
    const builders = make.mock.results.map(
      ({ value }) => value as unknown as MockBuilder,
    );
    expect(
      builders.some((builder) =>
        builder.moveTo.mock.calls.some(
          ([x]) => x === DEFAULT_PADDING.left + 2 + tagWidth + 4,
        ),
      ),
    ).toBe(true);
    make.mockClear();
  });

  it("renders a right-pinned, icon-only badge", () => {
    renderLine({ value: 5, badge: { position: "right", icon: "▲", text: false } });
  });

  it("renders an off-screen badge (chevron) from the badge config", () => {
    renderLine({ value: 99, badge: { icon: "▲" }, excludeFromRange: true });
  });
});

describe("ValueLineOverlay", () => {
  it("draws line when dotY is in chart area", async () => {
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
    await render(<Fixture />);
  });

  it("returns empty path when dotY is negative (off-screen)", async () => {
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
    await render(<Fixture />);
  });
});
