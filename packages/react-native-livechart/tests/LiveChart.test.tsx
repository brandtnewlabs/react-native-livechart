import { fireEvent, render } from "@testing-library/react-native";

import React from "react";
import { View } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { LiveChart } from "../src/components/LiveChart";
import { getAllByHostType } from "./rntl14";
import * as badgeHooks from "../src/hooks/useBadge";
import * as candlePathHooks from "../src/hooks/useCandlePaths";
import * as chartOverlayHooks from "../src/hooks/useChartOverlayContext";
import * as degenHooks from "../src/hooks/useDegen";
import * as tradeStreamHooks from "../src/hooks/useTradeStream";
import * as xAxisHooks from "../src/hooks/useXAxis";
import * as yAxisHooks from "../src/hooks/useYAxis";
import type {
  CandlePoint,
  LiveChartHandle,
  LiveChartPoint,
  LiveChartProps,
  Marker,
  ReferenceLineRenderProps,
  ThresholdConfig,
  TradeEvent,
} from "../src/types";

function Harness(props: Partial<LiveChartProps>) {
  const data = useSharedValue([{ time: 1700000000, value: 50 }]);
  const value = useSharedValue(50);
  return <LiveChart data={data} value={value} {...props} />;
}

function TradeStreamHarness() {
  const tradeStream = useSharedValue<TradeEvent[]>([
    { time: 1_700_000_050, price: 50, size: 1, side: "buy" },
  ]);
  return <Harness tradeStream={tradeStream} degen={{ scale: 1.2 }} />;
}

function VolumeTradeStreamHarness({ volume }: Pick<LiveChartProps, "volume">) {
  const tradeStream = useSharedValue<TradeEvent[]>([
    { time: 1_700_000_050, price: 50, size: 1, side: "buy" },
  ]);
  return <VolumeCandleHarness volume={volume} tradeStream={tradeStream} />;
}

function CandleHarness(props: Partial<LiveChartProps>) {
  const data = useSharedValue([{ time: 1700000000, value: 50 }]);
  const value = useSharedValue(50);
  const candles: SharedValue<CandlePoint[]> = useSharedValue([
    { time: 1700000000, open: 48, high: 52, low: 47, close: 50 },
    { time: 1700000060, open: 50, high: 55, low: 49, close: 53 },
  ]);
  const liveCandle = useSharedValue<CandlePoint | null>({
    time: 1700000120,
    open: 53,
    high: 56,
    low: 51,
    close: 54,
  });
  return (
    <LiveChart
      data={data}
      value={value}
      mode="candle"
      candles={candles}
      liveCandle={liveCandle}
      candleWidth={60}
      {...props}
    />
  );
}

function VolumeCandleHarness(props: Partial<LiveChartProps>) {
  const data = useSharedValue([{ time: 1700000000, value: 50 }]);
  const value = useSharedValue(50);
  const candles = useSharedValue<CandlePoint[]>([
    { time: 1700000000, open: 48, high: 52, low: 47, close: 50, volume: 12 },
    { time: 1700000060, open: 50, high: 55, low: 49, close: 53, volume: 30 },
    { time: 1700000120, open: 53, high: 54, low: 48, close: 49, volume: 8 },
  ]);
  const liveCandle = useSharedValue<CandlePoint | null>({
    time: 1700000180,
    open: 49,
    high: 51,
    low: 48,
    close: 50,
    volume: 18,
  });
  return (
    <LiveChart
      data={data}
      value={value}
      mode="candle"
      candles={candles}
      liveCandle={liveCandle}
      candleWidth={60}
      timeWindow={300}
      {...props}
    />
  );
}

function ThresholdHarness({
  thresholdValue = 0.5,
  thresholdExtra,
  ...props
}: Partial<LiveChartProps> & {
  thresholdValue?: number;
  thresholdExtra?: Omit<ThresholdConfig, "value">;
}) {
  const data = useSharedValue([{ time: 1700000000, value: 50 }]);
  const value = useSharedValue(50);
  const thr = useSharedValue(thresholdValue);
  return (
    <LiveChart
      data={data}
      value={value}
      threshold={{ value: thr, ...thresholdExtra }}
      {...props}
    />
  );
}

function ThresholdSeriesHarness({
  thresholdExtra,
  ...props
}: Partial<LiveChartProps> & {
  thresholdExtra?: Omit<ThresholdConfig, "value">;
}) {
  const data = useSharedValue([
    { time: 1700000000, value: 40 },
    { time: 1700000030, value: 60 },
  ]);
  const value = useSharedValue(60);
  // A time-varying threshold (plain `LiveChartPoint[]`) — the new #174 form.
  return (
    <LiveChart
      data={data}
      value={value}
      threshold={{
        value: [
          { time: 1700000000, value: 45 },
          { time: 1700000015, value: 50 },
          { time: 1700000030, value: 55 },
        ],
        ...thresholdExtra,
      }}
      {...props}
    />
  );
}

function ToggleableThresholdHarness({
  threshold,
}: {
  threshold?: ThresholdConfig;
}) {
  const data = useSharedValue([
    { time: 1700000000, value: 40 },
    { time: 1700000030, value: 60 },
  ]);
  const value = useSharedValue(60);
  return <LiveChart data={data} value={value} threshold={threshold} />;
}

async function layoutFirst(screen: Awaited<ReturnType<typeof render>>) {
  const views = getAllByHostType(screen, View);
  await fireEvent(views[0], "layout", {
    nativeEvent: { layout: { width: 400, height: 300 } },
  });
}

describe("LiveChart", () => {
  it("exposes an imperative pinch-zoom reset", async () => {
    const ref = React.createRef<LiveChartHandle>();
    function RefHarness() {
      const data = useSharedValue([{ time: 1700000000, value: 50 }]);
      const value = useSharedValue(50);
      return <LiveChart ref={ref} data={data} value={value} zoom />;
    }

    await render(<RefHarness />);
    expect(ref.current?.resetZoom).toBeInstanceOf(Function);
  });

  it("renders with defaults", async () => {
    const screen = await render(<Harness />);
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("applies series opacity to line and candle data layers", async () => {
    const seriesOpacity = { value: 0.5 } as SharedValue<number>;
    const matchingOpacityGroups = (
      screen: Awaited<ReturnType<typeof render>>,
    ) =>
      getAllByHostType(screen, View).filter(
        (view) => view.props.opacity === seriesOpacity,
      );

    expect(
      matchingOpacityGroups(await render(<Harness seriesOpacity={seriesOpacity} />)),
    ).toHaveLength(2);
    expect(
      matchingOpacityGroups(
        await render(<CandleHarness seriesOpacity={seriesOpacity} />),
      ),
    ).toHaveLength(3);
  });

  it("opts into an opaque canvas and replaces destination-alpha masks", async () => {
    const screen = await render(
      <Harness canvasMode="opaque" theme="light" loading />,
    );
    let views = getAllByHostType(screen, View);

    expect(views.some((view) => view.props.opaque === true)).toBe(true);
    expect(views.some((view) => view.props.blendMode === "dstOut")).toBe(false);
    expect(
      views.some(
        (view) =>
          typeof view.props.color === "string" &&
          view.props.color.includes("250, 250, 250"),
      ),
    ).toBe(true);

    await screen.rerender(
      <Harness
        canvasMode="opaque"
        theme="dark"
        palette={{ bgRgb: [12, 34, 56] }}
      />,
    );
    views = getAllByHostType(screen, View);
    expect(
      views.some(
        (view) =>
          typeof view.props.color === "string" &&
          view.props.color.includes("12, 34, 56"),
      ),
    ).toBe(true);
    expect(views.some((view) => view.props.blendMode === "dstOut")).toBe(false);
  });

  it("keeps the transparent canvas and destination-alpha masks as the fallback", async () => {
    const screen = await render(<Harness canvasMode="transparent" />);
    const views = getAllByHostType(screen, View);

    expect(views.some((view) => view.props.opaque === false)).toBe(true);
    expect(views.some((view) => view.props.blendMode === "dstOut")).toBe(true);
  });

  it("supports gradient off and overlays off", async () => {
    await render(<Harness gradient={false} yAxis={false} badge={false} />);
  });

  it("renders with dot.trackWhileParked (on, off, and followViewEdge precedence)", async () => {
    const screen = await render(
      <Harness timeScroll dot={{ trackWhileParked: true }} />,
    );
    await screen.rerender(
      <Harness timeScroll dot={{ trackWhileParked: false }} />,
    );
    // `badge.followViewEdge` wins: the edge-pinned dot stays with its badge, so
    // the tracking flag (and its pulse/hide exemptions) is ignored.
    await screen.rerender(
      <Harness
        timeScroll
        badge={{ followViewEdge: true }}
        dot={{ trackWhileParked: true }}
      />,
    );
  });

  it("renders with axisAutoHide enabled (defaults and config object)", async () => {
    const screen = await render(<Harness axisAutoHide />);
    await screen.rerender(
      <Harness
        axisAutoHide={{
          fadeInMs: 50,
          fadeOutMs: 100,
          idleOpacity: 0.2,
          hideAfterMs: 1000,
        }}
      />,
    );
    // `useSharedValue` keeps its initial value, so runtime configuration changes
    // need to reset the axis group opacity instead of leaving the axes stuck.
    await screen.rerender(<Harness axisAutoHide={false} />);
  });

  it("does not register disabled optional subsystem worklets", async () => {
    const badgeSpy = jest.spyOn(badgeHooks, "useBadge");
    const candlePathSpy = jest.spyOn(candlePathHooks, "useCandlePaths");
    const degenSpy = jest.spyOn(degenHooks, "useDegen");
    const overlaySpy = jest.spyOn(chartOverlayHooks, "useChartOverlayContext");
    const tradeSpy = jest.spyOn(tradeStreamHooks, "useTradeStream");
    const xAxisSpy = jest.spyOn(xAxisHooks, "useXAxis");
    const yAxisSpy = jest.spyOn(yAxisHooks, "useYAxis");

    await render(
      <Harness
        badge={false}
        degen={false}
        xAxis={false}
        yAxis={false}
        renderOverlay={undefined}
        tradeStream={undefined}
      />,
    );

    expect(badgeSpy).not.toHaveBeenCalled();
    expect(candlePathSpy).not.toHaveBeenCalled();
    expect(degenSpy).not.toHaveBeenCalled();
    expect(overlaySpy).not.toHaveBeenCalled();
    expect(tradeSpy).not.toHaveBeenCalled();
    expect(xAxisSpy).not.toHaveBeenCalled();
    expect(yAxisSpy).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it("renders areaDots (dot-lattice area fill) with default palette tint", async () => {
    // Layout must fire so the lattice is non-empty and AreaDotsOverlay mounts.
    const screen = await render(<Harness areaDots />);
    await layoutFirst(screen);
  });

  it("renders an areaDots config alongside gradient off (dots-only fill)", async () => {
    const screen = await render(
      <Harness
        gradient={false}
        areaDots={{
          spacing: 16,
          size: 2,
          color: "rgba(247,147,26,0.3)",
          opacity: 0.9,
        }}
        line={{ color: "#F7931A", width: 2 }}
      />,
    );
    await layoutFirst(screen);
  });

  it("uses custom insets and referenceLines", async () => {
    await render(
      <Harness
        style={{ backgroundColor: "#111111" }}
        insets={{ top: 4, bottom: 4 }}
        referenceLines={[{ value: 40 }]}
      />,
    );
  });

  it("supports scrubAction (order ticket) with onScrubAction", async () => {
    const onScrubAction = jest.fn();
    const screen = await render(
      <Harness scrubAction onScrubAction={onScrubAction} />,
    );
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
    // Fires only from the UI-thread tap worklet (istanbul-ignored under Jest).
    expect(onScrubAction).not.toHaveBeenCalled();
  });

  it("supports scrubAction config alongside markers and plain scrub off", async () => {
    function MarkersScrubActionHarness() {
      const data = useSharedValue([{ time: 1700000000, value: 50 }]);
      const value = useSharedValue(50);
      const markers = useSharedValue<Marker[]>([]);
      return (
        <LiveChart
          data={data}
          value={value}
          scrub={false}
          scrubAction={{ icon: "★", snap: 0.5, dismissOnTapOutside: true }}
          markers={markers}
          onScrubAction={jest.fn()}
        />
      );
    }
    await render(<MarkersScrubActionHarness />);
  });

  it("supports scrubAction in candle mode", async () => {
    await render(<CandleHarness scrubAction onScrubAction={jest.fn()} />);
  });

  it("renders volume bars below the candles", async () => {
    const screen = await render(<VolumeCandleHarness volume />);
    await layoutFirst(screen);
  });

  it("renders volume bars with a custom config", async () => {
    const screen = await render(
      <VolumeCandleHarness
        volume={{
          maxHeight: 64,
          radius: 0,
          upColor: "#0f0",
          downColor: "#f00",
          opacity: 0.5,
        }}
      />,
    );
    await layoutFirst(screen);
  });

  it("keeps the trade stream anchored to the lower chart edge with volume", async () => {
    const tradeSpy = jest.spyOn(tradeStreamHooks, "useTradeStream");

    await render(<VolumeTradeStreamHarness volume={false} />);
    const paddingWithoutVolume = tradeSpy.mock.calls.at(-1)?.[2];
    tradeSpy.mockClear();

    await render(
      <VolumeTradeStreamHarness volume={{ maxHeight: 64 }} />,
    );
    const paddingWithVolume = tradeSpy.mock.calls.at(-1)?.[2];

    expect(paddingWithoutVolume).toBeDefined();
    expect(paddingWithVolume?.bottom).toBe(paddingWithoutVolume?.bottom);
    tradeSpy.mockRestore();
  });

  it("ignores the volume prop in line mode", async () => {
    const screen = await render(<Harness volume />);
    await layoutFirst(screen);
  });

  it("does not collide React keys for duplicate-value reference lines", async () => {
    // Two working orders at the same price + label (reachable from the
    // order-ticket flow) must each render — a content-derived key would
    // collapse them and warn. Index keys keep them distinct.
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await render(
      <Harness
        referenceLines={[
          { value: 50, label: "Limit buy", showValue: true, badge: { icon: "▲" } },
          { value: 50, label: "Limit buy", showValue: true, badge: { icon: "▲" } },
        ]}
      />,
    );
    const keyWarning = errorSpy.mock.calls.some((args) =>
      args.some((a) => typeof a === "string" && a.includes("same key")),
    );
    expect(keyWarning).toBe(false);
    errorSpy.mockRestore();
  });

  it("supports onReferenceLinePress on a badged reference line", async () => {
    const onReferenceLinePress = jest.fn();
    await render(
      <Harness
        referenceLines={[
          { value: 50, label: "Limit buy", showValue: true, badge: { icon: "+" } },
        ]}
        onReferenceLinePress={onReferenceLinePress}
      />,
    );
    // Fires only from the UI-thread tap worklet (istanbul-ignored under Jest).
    expect(onReferenceLinePress).not.toHaveBeenCalled();
  });

  it("composes reference-line press with markers and scrubAction", async () => {
    function ComboHarness() {
      const data = useSharedValue([{ time: 1700000000, value: 50 }]);
      const value = useSharedValue(50);
      const markers = useSharedValue<Marker[]>([]);
      return (
        <LiveChart
          data={data}
          value={value}
          scrubAction
          markers={markers}
          referenceLines={[{ value: 50, badge: { icon: "+" } }]}
          onReferenceLinePress={jest.fn()}
          onScrubAction={jest.fn()}
        />
      );
    }
    await render(<ComboHarness />);
  });

  it("renders draggable, custom-rendered, and grouped reference lines", async () => {
    const screen = await render(
      <Harness
        referenceLines={[
          {
            value: 50,
            draggable: true,
            snap: 0.5,
            bounds: [0, 100],
            onChange: jest.fn(),
            onCommit: jest.fn(),
            onDragIn: jest.fn(),
            onDragOut: jest.fn(),
          },
          { value: 51 }, // near 50 → collapses into a group
          { value: 52, badge: true }, // custom-rendered tag
        ]}
        renderReferenceLine={({ line }) =>
          line.value === 52 ? <View testID="custom-ref" /> : null
        }
        referenceLineGrouping={{ radius: 40 }}
      />,
    );
    // The custom-rendered tag is floated as an RN view (built-in tag suppressed).
    expect(screen.queryByTestId("custom-ref")).toBeTruthy();
  });

  it("replaces only an off-axis reference-line tag", async () => {
    const screen = await render(
      <Harness
        referenceLines={[
          {
            value: 99,
            label: "Target",
            excludeFromRange: true,
            badge: { position: "right" },
          },
          { value: 50, label: "Built in", badge: { position: "center" } },
        ]}
        renderOffAxisReferenceLine={({ line }) =>
          line.label === "Target" ? <View testID="off-axis-target" /> : null
        }
      />,
    );
    expect(screen.getByTestId("off-axis-target")).toBeTruthy();

  });

  it("accepts a boolean referenceLineGrouping and a non-draggable custom line", async () => {
    await render(
      <Harness
        referenceLines={[{ value: 50 }, { value: 50.2 }]}
        referenceLineGrouping
        renderReferenceLine={() => <View testID="rl" />}
      />,
    );
  });

  it("renders styled reference-line badges and a styled group count pill", async () => {
    await render(
      <Harness
        referenceLines={[
          {
            value: 50,
            label: "Target",
            badge: {
              position: "center",
              background: "#111",
              borderColor: "#fff",
              borderWidth: 2,
              radius: 8,
              textColor: "#0f0",
              fontSize: 16,
              fontFamily: "Menlo",
              fontWeight: "700",
              offsetX: 4,
              offsetY: -2,
            },
          },
          { value: 60, badge: true }, // near-value alerts → group
          { value: 60.4, badge: true },
        ]}
        referenceLineGrouping={{
          radius: 60,
          badge: {
            position: "center",
            icon: "⚠",
            borderWidth: 2,
            radius: 9,
            textColor: "#fbbf24",
            fontSize: 14,
            offsetX: 2,
          },
          format: (n) => `×${n}`,
        }}
      />,
    );
  });

  it("accepts custom formatters", async () => {
    await render(
      <Harness formatValue={(v) => v.toFixed(4)} formatTime={() => "x"} />,
    );
  });

  it("renders time-range segments (recolor + divider + active)", async () => {
    const screen = await render(
      <Harness
        segments={[
          // Non-recolor segment (excluded from the scrub-focus gradient).
          { from: 1699999900, to: 1699999950, recolorLine: false },
          // Active recolored segment with a divider and a label.
          {
            from: 1699999970,
            to: 1700000000,
            active: true,
            divider: true,
            label: "After hours",
          },
          // Gradient-recolored segment extending to the live edge.
          { from: 1700000010, mutedColors: ["#aa0000", "#0000cc"] },
        ]}
      />,
    );
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders segments in candle mode", async () => {
    await render(
      <CandleHarness
        segments={[{ from: 1700000000, to: 1700000120, divider: true }]}
      />,
    );
  });

  it("renders with scrub enabled (default tooltip)", async () => {
    const screen = await render(<Harness scrub />);
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("forwards configurable crosshair fade distance and line cap", async () => {
    await render(
      <Harness
        scrub={{ crosshairFadeDistance: 12, crosshairLineCap: "square" }}
      />,
    );
  });

  it("accepts config objects for badge, grid, scrub, valueLine", async () => {
    await render(
      <Harness
        badge={{ variant: "minimal", tail: false }}
        yAxis={{
          minGap: 48,
          intervalScale: 1_000_000,
          labelRightMargin: 8,
          gridEndGap: 6,
        }}
        scrub={{ tooltip: false }}
        valueLine={{ strokeWidth: 2, intervals: [6, 3] }}
      />,
    );
  });

  it("accepts left-position badge", async () => {
    await render(<Harness badge={{ position: "left" }} yAxis={false} />);
  });

  it("accepts GradientConfig with custom opacities", async () => {
    await render(<Harness gradient={{ topOpacity: 0.3, bottomOpacity: 0.02 }} />);
  });

  it("accepts LineConfig with width and color override", async () => {
    await render(<Harness line={{ width: 3, color: "#ff0000" }} />);
  });

  it("accepts screen-space line simplification", async () => {
    await render(<Harness line={{ simplify: 1 }} />);
  });

  it("accepts LineConfig with gradient colors", async () => {
    await render(<Harness line={{ colors: ["#ff0000", "#0000ff"] }} />);
  });

  it("accepts LineConfig with empty colors array (no gradient)", async () => {
    await render(<Harness line={{ colors: [] }} />);
  });

  it("accepts LineConfig with both color and colors", async () => {
    await render(
      <Harness line={{ color: "#ff0000", colors: ["#00ff00", "#0000ff"] }} />,
    );
  });

  it("accepts PulseConfig", async () => {
    await render(<Harness pulse={{ interval: 2000, maxRadius: 30 }} />);
  });

  it("disables timeAxis", async () => {
    await render(<Harness xAxis={false} />);
  });

  it("accepts visual config on referenceLines", async () => {
    await render(
      <Harness
        referenceLines={[{ value: 40, strokeWidth: 2, color: "#ff0000" }]}
      />,
    );
  });

  it("colors the line above/below a threshold (palette defaults)", async () => {
    await layoutFirst(await render(<ThresholdHarness thresholdValue={0.5} />));
  });

  it("renders the threshold fill band + dashed labelled marker line", async () => {
    await layoutFirst(
      await render(
        <ThresholdHarness
          thresholdValue={0.5}
          gradient={false}
          thresholdExtra={{
            aboveColor: "#00ff00",
            belowColor: "#ff0000",
            fill: true,
            line: { label: "Break-even", showValue: true, strokeWidth: 2 },
          }}
        />,
      ),
    );
  });

  it("accepts a bare dashed marker line (no label)", async () => {
    await layoutFirst(
      await render(
        <ThresholdHarness thresholdValue={0.5} thresholdExtra={{ line: true }} />,
      ),
    );
  });

  it("hides the marker line when the threshold is off-screen", async () => {
    await layoutFirst(
      await render(
        <ThresholdHarness
          thresholdValue={50}
          thresholdExtra={{ fill: true, line: { showValue: true } }}
        />,
      ),
    );
  });

  it("colors the line above/below a time-varying threshold series (#174)", async () => {
    await layoutFirst(await render(<ThresholdSeriesHarness />));
  });

  it("mounts the split shader when a series threshold is added after mount", async () => {
    // Regression scenario for the stale split-color memo (a threshold added
    // after mount with default colors must not stay on the black fallback).
    // The jest Reanimated stub never re-runs a derived value's mapper, so the
    // recomputed uniforms can't be asserted here — the fresh-mount test below
    // pins the resolved colors; this covers the mount-then-add wiring.
    const series: LiveChartPoint[] = [
      { time: 1700000000, value: 45 },
      { time: 1700000030, value: 55 },
    ];
    const screen = await render(<ToggleableThresholdHarness />);
    await layoutFirst(screen);
    await screen.rerender(
      <ToggleableThresholdHarness threshold={{ value: series, fill: true }} />,
    );
    const shaders = getAllByHostType(screen, View)
      .filter((v) => v.props.uniforms != null);
    expect(shaders).toHaveLength(2); // stroke + fill band
  });

  it("resolves default palette split colors on mount (not the black fallback)", async () => {
    const screen = await render(<ThresholdSeriesHarness />);
    await layoutFirst(screen);
    const shaders = getAllByHostType(screen, View)
      .filter((v) => v.props.uniforms != null);
    expect(shaders.length).toBeGreaterThan(0);
    for (const s of shaders) {
      expect(s.props.uniforms.value.aboveColor).not.toEqual([0, 0, 0, 1]);
      expect(s.props.uniforms.value.belowColor).not.toEqual([0, 0, 0, 1]);
    }
  });

  it("carries an rgba() alpha into the series split stroke", async () => {
    const screen = await render(
      <ThresholdSeriesHarness
        thresholdExtra={{ aboveColor: "rgba(0, 255, 0, 0.5)" }}
      />,
    );
    await layoutFirst(screen);
    const shaders = getAllByHostType(screen, View)
      .filter((v) => v.props.uniforms != null);
    expect(shaders).toHaveLength(1); // stroke only (no fill band)
    expect(shaders[0].props.uniforms.value.aboveColor).toEqual([0, 1, 0, 0.5]);
  });

  it("scales the band alpha with fill: { opacity } (series form)", async () => {
    const screen = await render(
      <ThresholdSeriesHarness
        gradient={false}
        thresholdExtra={{
          aboveColor: "rgba(0, 255, 0, 1)",
          fill: { opacity: 0.5 },
        }}
      />,
    );
    await layoutFirst(screen);
    const shaders = getAllByHostType(screen, View)
      .filter((v) => v.props.uniforms != null);
    expect(shaders).toHaveLength(2); // stroke + band
    const alphas = shaders.map((v) => v.props.uniforms.value.aboveColor[3]);
    expect(alphas).toContain(1); // stroke keeps full strength
    expect(alphas).toContain(0.5); // band uses the custom opacity
  });

  it("renders the live SharedValue series form (threshold.series)", async () => {
    function LiveSeriesHarness() {
      const data = useSharedValue([
        { time: 1700000000, value: 40 },
        { time: 1700000030, value: 60 },
      ]);
      const value = useSharedValue(60);
      const series = useSharedValue<LiveChartPoint[]>([
        { time: 1700000000, value: 45 },
        { time: 1700000030, value: 55 },
      ]);
      return (
        <LiveChart
          data={data}
          value={value}
          threshold={{ series, fill: true, line: true, includeInRange: true }}
        />
      );
    }
    await layoutFirst(await render(<LiveSeriesHarness />));
  });

  it("clips the split at the series end with extendToNow: false", async () => {
    const screen = await render(
      <ThresholdSeriesHarness
        thresholdExtra={{ extendToNow: false } as never}
      />,
    );
    await layoutFirst(screen);
    const shaders = getAllByHostType(screen, View)
      .filter((v) => v.props.uniforms != null);
    expect(shaders).toHaveLength(1);
    // The clip uniforms are wired (their live values are computed on the UI
    // thread post-layout — pinned in the useThresholdSeries hook tests; the
    // jest stub freezes derived values at their pre-layout mount computation).
    expect(typeof shaders[0].props.uniforms.value.clipRight).toBe("number");
    expect(shaders[0].props.uniforms.value.restColor).toHaveLength(4);
  });

  it("renders a labelled marker with a custom labelColor", async () => {
    await layoutFirst(
      await render(
        <ThresholdSeriesHarness
          thresholdExtra={{
            line: { label: "VWAP", showValue: true, labelColor: "#123456" },
          }}
        />,
      ),
    );
  });

  it("renders no split paint or band for an empty threshold series", async () => {
    // An empty series (threshold history not loaded yet) must look like "no
    // threshold": no shader-forced stroke color, no full-area fill band.
    const screen = await render(
      <ToggleableThresholdHarness
        threshold={{ value: [], fill: true, line: true }}
      />,
    );
    await layoutFirst(screen);
    const shaders = getAllByHostType(screen, View)
      .filter((v) => v.props.uniforms != null);
    expect(shaders).toHaveLength(0);
  });

  it("renders the series threshold band + polyline marker + label badge", async () => {
    await layoutFirst(
      await render(
        <ThresholdSeriesHarness
          gradient={false}
          thresholdExtra={{
            aboveColor: "#00ff00",
            belowColor: "#ff0000",
            fill: true,
            line: { label: "Break-even", showValue: true },
          }}
        />,
      ),
    );
  });

  it("renders in loading state", async () => {
    const screen = await render(<Harness loading />);
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders loading state without layout (zero canvas size)", async () => {
    await render(<Harness loading />);
  });

  it("renders with paused=true", async () => {
    await render(<Harness paused />);
  });

  it("renders with valueLine enabled", async () => {
    await render(<Harness valueLine />);
  });

  it("accepts a custom font config", async () => {
    await render(
      <Harness
        font={{ fontFamily: "Courier", fontSize: 13, fontWeight: "700" }}
      />,
    );
  });

  it("renders in candle mode", async () => {
    const screen = await render(<CandleHarness />);
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders explicit candle gaps with semantic defaults and overrides", async () => {
    const renderReferenceLine = jest.fn(
      (_ctx: ReferenceLineRenderProps) => null,
    );
    const screen = await render(
      <CandleHarness
        referenceLines={[{ value: 103, label: "Consumer line" }]}
        renderReferenceLine={renderReferenceLine}
        candleGaps={{
          gaps: [
            { from: 1700000060, to: 1700000120, kind: "no-trades" },
            {
              from: 1700000120,
              to: 1700000180,
              kind: "unavailable",
              label: "Maintenance",
            },
            {
              from: 1700000180,
              to: 1700000240,
              kind: "unknown",
            },
          ],
          styles: {
            unavailable: {
              bridge: {
                color: "#22c55e",
                opacity: 0.4,
                strokeWidth: 3,
                strokeCap: "square",
              },
              band: {
                fillColor: "#a855f7",
                fillOpacity: 0.2,
                borderColor: "#f59e0b",
                borderOpacity: 0.6,
                borderWidth: 2,
                intervals: [6, 3],
              },
              label: { color: "#f8fafc", position: "right" },
            },
          },
        }}
      />,
    );
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
    expect(JSON.stringify(screen.toJSON())).toContain("#a855f7");
    expect(JSON.stringify(screen.toJSON())).toContain("#f59e0b");
    expect(JSON.stringify(screen.toJSON())).toContain("#f8fafc");
    expect(JSON.stringify(screen.toJSON())).toContain("#22c55e");
    expect(
      renderReferenceLine.mock.calls.some(
        ([ctx]) => ctx.line.from !== undefined || ctx.line.to !== undefined,
      ),
    ).toBe(false);
  });

  it("renders candle mode with scrub enabled", async () => {
    await render(<CandleHarness scrub />);
  });

  it("renders candle mode with a candle-snapping scrub crosshair", async () => {
    const screen = await render(
      <CandleHarness scrub={{ snapToCandles: true }} />,
    );
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders candle mode with other-candle scrub dimming", async () => {
    const screen = await render(
      <CandleHarness
        scrub={{
          dimTarget: "otherCandles",
          dimOpacity: 0.5,
          snapToCandles: true,
        }}
      />,
    );
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("treats scrub.snapToCandles as a no-op in line mode", async () => {
    await render(<Harness scrub={{ snapToCandles: true }} />);
  });

  it("restores the standard scrub when switching other-candle dimming to line mode", async () => {
    const scrub = {
      dimTarget: "otherCandles" as const,
      crosshairLineColor: "#123abc",
    };
    const screen = await render(<CandleHarness scrub={scrub} />);

    expect(JSON.stringify(screen.toJSON())).not.toContain("#123abc");

    await screen.rerender(<CandleHarness mode="line" scrub={scrub} />);

    expect(JSON.stringify(screen.toJSON())).toContain("#123abc");
  });

  it("renders candle mode with an instant candleLerpSpeed (transitions)", async () => {
    const screen = await render(
      <CandleHarness transitions={{ candleLerpSpeed: 1 }} />,
    );
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("keeps the candle-width loop started when switching from line mode", async () => {
    const widthLerpSpy = jest.spyOn(candlePathHooks, "useCandleWidthLerp");
    const screen = await render(
      <CandleHarness mode="line" candleWidth={3_600} />,
    );

    expect(widthLerpSpy).toHaveBeenLastCalledWith(
      3_600,
      undefined,
      true,
      false,
    );

    await screen.rerender(
      <CandleHarness
        mode="candle"
        candleWidth={86_400}
        transitions={{ candleLerpSpeed: 1 }}
      />,
    );

    expect(widthLerpSpy).toHaveBeenLastCalledWith(86_400, 1, true, true);
    widthLerpSpy.mockRestore();
  });

  it("disables gradient in candle mode", async () => {
    await render(<CandleHarness gradient />);
  });

  it("renders with tradeStream and degen", async () => {
    const screen = await render(<TradeStreamHarness />);
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("accepts onDegenShake with degen enabled", async () => {
    const onDegenShake = jest.fn();
    const screen = await render(<Harness degen onDegenShake={onDegenShake} />);
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders in static mode and lays out without throwing", async () => {
    const screen = await render(
      <Harness static timeWindow={30} nowOverride={1700000030} />,
    );
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("static gates off pulse + degen but keeps scrub/scrubAction live", async () => {
    // The controller forces the continuous animations (pulse, degen) off in
    // static, but scrub / scrubAction stay live (on-demand, no per-frame loop).
    // Exercising every gating branch with all of them enabled must render cleanly.
    const screen = await render(
      <Harness
        static
        pulse
        scrub
        scrubAction
        degen
        nowOverride={1700000030}
      />,
    );
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("composes the default drag-to-scroll gesture when timeScroll is on (line)", async () => {
    const screen = await render(<Harness timeScroll scrub />);
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("enables time-scroll in candle mode", async () => {
    const screen = await render(<CandleHarness timeScroll />);
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("composes the axis-drag pan-scroll gesture via the config form", async () => {
    const screen = await render(
      <CandleHarness timeScroll={{ gesture: "axisDrag" }} scrub />,
    );
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("composes the order ticket (scrubAction) with time-scroll", async () => {
    // axisDrag carves the bottom band out of the scrub + tap hit area (so a drag
    // there scrolls, not scrubs); holdToScrub keeps the whole plot live. Both
    // compose with scrubAction without crashing.
    for (const gesture of ["axisDrag", "holdToScrub"] as const) {
      const screen = await render(
        <CandleHarness
          timeScroll={{ gesture }}
          scrubAction
          onScrubAction={jest.fn()}
        />,
      );
      const views = getAllByHostType(screen, View);
      await fireEvent(views[0], "layout", {
        nativeEvent: { layout: { width: 400, height: 200 } },
      });
    }
  });

  it("renders the floating y-axis + floating badge (full-width plot)", async () => {
    // Float composes with the badge — the badge floats over the right edge.
    const screen = await render(<CandleHarness yAxis={{ float: true }} badge />);
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("reserves the float gutter at rest when timeScroll is on", async () => {
    // float + timeScroll: at the live edge (not scrolled) the chart keeps its
    // right gutter so the plot doesn't sit under the floating axis/badge. The
    // float collapses only once scrolled back (driven on the UI thread).
    const screen = await render(
      <CandleHarness yAxis={{ float: true }} timeScroll badge />,
    );
    const views = getAllByHostType(screen, View);
    await fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("mounts the live indicators across time-scroll visibility configs", async () => {
    // Behavioral opacity coverage lives in liveIndicatorVisibility.test.ts.
    // This integration check ensures each public config form wires into the
    // complete chart without disrupting the mounted badge, dot, or value line.
    for (const props of [
      { timeScroll: true as const },
      { timeScroll: { hideLiveOnScrollBack: false } },
      { timeScroll: true as const, badge: { followViewEdge: true } },
    ]) {
      const screen = await render(<Harness {...props} valueLine dot />);
      const views = getAllByHostType(screen, View);
      await fireEvent(views[0], "layout", {
        nativeEvent: { layout: { width: 400, height: 200 } },
      });
    }
  });

  it("composes the hold-to-scrub (one-finger drag) gesture", async () => {
    // Default hold (no scrubHoldMs) and an explicit override both render cleanly.
    for (const ts of [
      { gesture: "holdToScrub" } as const,
      { gesture: "holdToScrub", scrubHoldMs: 600 } as const,
    ]) {
      const screen = await render(<CandleHarness timeScroll={ts} scrub />);
      const views = getAllByHostType(screen, View);
      await fireEvent(views[0], "layout", {
        nativeEvent: { layout: { width: 400, height: 200 } },
      });
    }
  });
});
