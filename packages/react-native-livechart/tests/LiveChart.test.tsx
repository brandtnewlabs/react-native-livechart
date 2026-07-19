import { fireEvent, render } from "@testing-library/react-native";

import React from "react";
import { View } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { LiveChart } from "../src/components/LiveChart";
import * as badgeHooks from "../src/hooks/useBadge";
import * as candlePathHooks from "../src/hooks/useCandlePaths";
import * as chartOverlayHooks from "../src/hooks/useChartOverlayContext";
import * as degenHooks from "../src/hooks/useDegen";
import * as tradeStreamHooks from "../src/hooks/useTradeStream";
import * as xAxisHooks from "../src/hooks/useXAxis";
import * as yAxisHooks from "../src/hooks/useYAxis";
import type {
  CandlePoint,
  LiveChartPoint,
  LiveChartProps,
  Marker,
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

function layoutFirst(screen: ReturnType<typeof render>) {
  const views = screen.UNSAFE_getAllByType(View);
  fireEvent(views[0], "layout", {
    nativeEvent: { layout: { width: 400, height: 300 } },
  });
}

describe("LiveChart", () => {
  it("renders with defaults", () => {
    const screen = render(<Harness />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("opts into an opaque canvas and replaces destination-alpha masks", () => {
    const screen = render(
      <Harness canvasMode="opaque" theme="light" loading />,
    );
    let views = screen.UNSAFE_getAllByType(View);

    expect(views.some((view) => view.props.opaque === true)).toBe(true);
    expect(views.some((view) => view.props.blendMode === "dstOut")).toBe(false);
    expect(
      views.some(
        (view) =>
          typeof view.props.color === "string" &&
          view.props.color.includes("250, 250, 250"),
      ),
    ).toBe(true);

    screen.rerender(
      <Harness
        canvasMode="opaque"
        theme="dark"
        palette={{ bgRgb: [12, 34, 56] }}
      />,
    );
    views = screen.UNSAFE_getAllByType(View);
    expect(
      views.some(
        (view) =>
          typeof view.props.color === "string" &&
          view.props.color.includes("12, 34, 56"),
      ),
    ).toBe(true);
    expect(views.some((view) => view.props.blendMode === "dstOut")).toBe(false);
  });

  it("keeps the transparent canvas and destination-alpha masks as the fallback", () => {
    const screen = render(<Harness canvasMode="transparent" />);
    const views = screen.UNSAFE_getAllByType(View);

    expect(views.some((view) => view.props.opaque === false)).toBe(true);
    expect(views.some((view) => view.props.blendMode === "dstOut")).toBe(true);
  });

  it("supports gradient off and overlays off", () => {
    render(<Harness gradient={false} yAxis={false} badge={false} />);
  });

  it("does not register disabled optional subsystem worklets", () => {
    const badgeSpy = jest.spyOn(badgeHooks, "useBadge");
    const candlePathSpy = jest.spyOn(candlePathHooks, "useCandlePaths");
    const degenSpy = jest.spyOn(degenHooks, "useDegen");
    const overlaySpy = jest.spyOn(chartOverlayHooks, "useChartOverlayContext");
    const tradeSpy = jest.spyOn(tradeStreamHooks, "useTradeStream");
    const xAxisSpy = jest.spyOn(xAxisHooks, "useXAxis");
    const yAxisSpy = jest.spyOn(yAxisHooks, "useYAxis");

    render(
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

  it("renders areaDots (dot-lattice area fill) with default palette tint", () => {
    // Layout must fire so the lattice is non-empty and AreaDotsOverlay mounts.
    const screen = render(<Harness areaDots />);
    layoutFirst(screen);
  });

  it("renders an areaDots config alongside gradient off (dots-only fill)", () => {
    const screen = render(
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
    layoutFirst(screen);
  });

  it("uses custom insets and referenceLines", () => {
    render(
      <Harness
        style={{ backgroundColor: "#111111" }}
        insets={{ top: 4, bottom: 4 }}
        referenceLines={[{ value: 40 }]}
      />,
    );
  });

  it("supports scrubAction (order ticket) with onScrubAction", () => {
    const onScrubAction = jest.fn();
    const screen = render(
      <Harness scrubAction onScrubAction={onScrubAction} />,
    );
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
    // Fires only from the UI-thread tap worklet (istanbul-ignored under Jest).
    expect(onScrubAction).not.toHaveBeenCalled();
  });

  it("supports scrubAction config alongside markers and plain scrub off", () => {
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
    render(<MarkersScrubActionHarness />);
  });

  it("supports scrubAction in candle mode", () => {
    render(<CandleHarness scrubAction onScrubAction={jest.fn()} />);
  });

  it("renders volume bars below the candles", () => {
    const screen = render(<VolumeCandleHarness volume />);
    layoutFirst(screen);
  });

  it("renders volume bars with a custom config", () => {
    const screen = render(
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
    layoutFirst(screen);
  });

  it("ignores the volume prop in line mode", () => {
    const screen = render(<Harness volume />);
    layoutFirst(screen);
  });

  it("does not collide React keys for duplicate-value reference lines", () => {
    // Two working orders at the same price + label (reachable from the
    // order-ticket flow) must each render — a content-derived key would
    // collapse them and warn. Index keys keep them distinct.
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(
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

  it("supports onReferenceLinePress on a badged reference line", () => {
    const onReferenceLinePress = jest.fn();
    render(
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

  it("composes reference-line press with markers and scrubAction", () => {
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
    render(<ComboHarness />);
  });

  it("renders draggable, custom-rendered, and grouped reference lines", () => {
    const screen = render(
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

  it("accepts a boolean referenceLineGrouping and a non-draggable custom line", () => {
    render(
      <Harness
        referenceLines={[{ value: 50 }, { value: 50.2 }]}
        referenceLineGrouping
        renderReferenceLine={() => <View testID="rl" />}
      />,
    );
  });

  it("renders styled reference-line badges and a styled group count pill", () => {
    render(
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

  it("accepts custom formatters", () => {
    render(
      <Harness formatValue={(v) => v.toFixed(4)} formatTime={() => "x"} />,
    );
  });

  it("renders time-range segments (recolor + divider + active)", () => {
    const screen = render(
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
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders segments in candle mode", () => {
    render(
      <CandleHarness
        segments={[{ from: 1700000000, to: 1700000120, divider: true }]}
      />,
    );
  });

  it("renders with scrub enabled (default tooltip)", () => {
    const screen = render(<Harness scrub />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("accepts config objects for badge, grid, scrub, valueLine", () => {
    render(
      <Harness
        badge={{ variant: "minimal", tail: false }}
        yAxis={{ minGap: 48 }}
        scrub={{ tooltip: false }}
        valueLine={{ strokeWidth: 2, intervals: [6, 3] }}
      />,
    );
  });

  it("accepts left-position badge", () => {
    render(<Harness badge={{ position: "left" }} yAxis={false} />);
  });

  it("accepts GradientConfig with custom opacities", () => {
    render(<Harness gradient={{ topOpacity: 0.3, bottomOpacity: 0.02 }} />);
  });

  it("accepts LineConfig with width and color override", () => {
    render(<Harness line={{ width: 3, color: "#ff0000" }} />);
  });

  it("accepts LineConfig with gradient colors", () => {
    render(<Harness line={{ colors: ["#ff0000", "#0000ff"] }} />);
  });

  it("accepts LineConfig with empty colors array (no gradient)", () => {
    render(<Harness line={{ colors: [] }} />);
  });

  it("accepts LineConfig with both color and colors", () => {
    render(
      <Harness line={{ color: "#ff0000", colors: ["#00ff00", "#0000ff"] }} />,
    );
  });

  it("accepts PulseConfig", () => {
    render(<Harness pulse={{ interval: 2000, maxRadius: 30 }} />);
  });

  it("disables timeAxis", () => {
    render(<Harness xAxis={false} />);
  });

  it("accepts visual config on referenceLines", () => {
    render(
      <Harness
        referenceLines={[{ value: 40, strokeWidth: 2, color: "#ff0000" }]}
      />,
    );
  });

  it("colors the line above/below a threshold (palette defaults)", () => {
    layoutFirst(render(<ThresholdHarness thresholdValue={0.5} />));
  });

  it("renders the threshold fill band + dashed labelled marker line", () => {
    layoutFirst(
      render(
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

  it("accepts a bare dashed marker line (no label)", () => {
    layoutFirst(
      render(
        <ThresholdHarness thresholdValue={0.5} thresholdExtra={{ line: true }} />,
      ),
    );
  });

  it("hides the marker line when the threshold is off-screen", () => {
    layoutFirst(
      render(
        <ThresholdHarness
          thresholdValue={50}
          thresholdExtra={{ fill: true, line: { showValue: true } }}
        />,
      ),
    );
  });

  it("colors the line above/below a time-varying threshold series (#174)", () => {
    layoutFirst(render(<ThresholdSeriesHarness />));
  });

  it("mounts the split shader when a series threshold is added after mount", () => {
    // Regression scenario for the stale split-color memo (a threshold added
    // after mount with default colors must not stay on the black fallback).
    // The jest Reanimated stub never re-runs a derived value's mapper, so the
    // recomputed uniforms can't be asserted here — the fresh-mount test below
    // pins the resolved colors; this covers the mount-then-add wiring.
    const series: LiveChartPoint[] = [
      { time: 1700000000, value: 45 },
      { time: 1700000030, value: 55 },
    ];
    const screen = render(<ToggleableThresholdHarness />);
    layoutFirst(screen);
    screen.rerender(
      <ToggleableThresholdHarness threshold={{ value: series, fill: true }} />,
    );
    const shaders = screen
      .UNSAFE_getAllByType(View)
      .filter((v) => v.props.uniforms != null);
    expect(shaders).toHaveLength(2); // stroke + fill band
  });

  it("resolves default palette split colors on mount (not the black fallback)", () => {
    const screen = render(<ThresholdSeriesHarness />);
    layoutFirst(screen);
    const shaders = screen
      .UNSAFE_getAllByType(View)
      .filter((v) => v.props.uniforms != null);
    expect(shaders.length).toBeGreaterThan(0);
    for (const s of shaders) {
      expect(s.props.uniforms.value.aboveColor).not.toEqual([0, 0, 0, 1]);
      expect(s.props.uniforms.value.belowColor).not.toEqual([0, 0, 0, 1]);
    }
  });

  it("carries an rgba() alpha into the series split stroke", () => {
    const screen = render(
      <ThresholdSeriesHarness
        thresholdExtra={{ aboveColor: "rgba(0, 255, 0, 0.5)" }}
      />,
    );
    layoutFirst(screen);
    const shaders = screen
      .UNSAFE_getAllByType(View)
      .filter((v) => v.props.uniforms != null);
    expect(shaders).toHaveLength(1); // stroke only (no fill band)
    expect(shaders[0].props.uniforms.value.aboveColor).toEqual([0, 1, 0, 0.5]);
  });

  it("scales the band alpha with fill: { opacity } (series form)", () => {
    const screen = render(
      <ThresholdSeriesHarness
        gradient={false}
        thresholdExtra={{
          aboveColor: "rgba(0, 255, 0, 1)",
          fill: { opacity: 0.5 },
        }}
      />,
    );
    layoutFirst(screen);
    const shaders = screen
      .UNSAFE_getAllByType(View)
      .filter((v) => v.props.uniforms != null);
    expect(shaders).toHaveLength(2); // stroke + band
    const alphas = shaders.map((v) => v.props.uniforms.value.aboveColor[3]);
    expect(alphas).toContain(1); // stroke keeps full strength
    expect(alphas).toContain(0.5); // band uses the custom opacity
  });

  it("renders the live SharedValue series form (threshold.series)", () => {
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
    layoutFirst(render(<LiveSeriesHarness />));
  });

  it("clips the split at the series end with extendToNow: false", () => {
    const screen = render(
      <ThresholdSeriesHarness
        thresholdExtra={{ extendToNow: false } as never}
      />,
    );
    layoutFirst(screen);
    const shaders = screen
      .UNSAFE_getAllByType(View)
      .filter((v) => v.props.uniforms != null);
    expect(shaders).toHaveLength(1);
    // The clip uniforms are wired (their live values are computed on the UI
    // thread post-layout — pinned in the useThresholdSeries hook tests; the
    // jest stub freezes derived values at their pre-layout mount computation).
    expect(typeof shaders[0].props.uniforms.value.clipRight).toBe("number");
    expect(shaders[0].props.uniforms.value.restColor).toHaveLength(4);
  });

  it("renders a labelled marker with a custom labelColor", () => {
    layoutFirst(
      render(
        <ThresholdSeriesHarness
          thresholdExtra={{
            line: { label: "VWAP", showValue: true, labelColor: "#123456" },
          }}
        />,
      ),
    );
  });

  it("renders no split paint or band for an empty threshold series", () => {
    // An empty series (threshold history not loaded yet) must look like "no
    // threshold": no shader-forced stroke color, no full-area fill band.
    const screen = render(
      <ToggleableThresholdHarness
        threshold={{ value: [], fill: true, line: true }}
      />,
    );
    layoutFirst(screen);
    const shaders = screen
      .UNSAFE_getAllByType(View)
      .filter((v) => v.props.uniforms != null);
    expect(shaders).toHaveLength(0);
  });

  it("renders the series threshold band + polyline marker + label badge", () => {
    layoutFirst(
      render(
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

  it("renders in loading state", () => {
    const screen = render(<Harness loading />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders loading state without layout (zero canvas size)", () => {
    render(<Harness loading />);
  });

  it("renders with paused=true", () => {
    render(<Harness paused />);
  });

  it("renders with valueLine enabled", () => {
    render(<Harness valueLine />);
  });

  it("accepts a custom font config", () => {
    render(
      <Harness
        font={{ fontFamily: "Courier", fontSize: 13, fontWeight: "700" }}
      />,
    );
  });

  it("renders in candle mode", () => {
    const screen = render(<CandleHarness />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders candle mode with scrub enabled", () => {
    render(<CandleHarness scrub />);
  });

  it("renders candle mode with an instant candleLerpSpeed (transitions)", () => {
    const screen = render(
      <CandleHarness transitions={{ candleLerpSpeed: 1 }} />,
    );
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("disables gradient in candle mode", () => {
    render(<CandleHarness gradient />);
  });

  it("renders with tradeStream and degen", () => {
    const screen = render(<TradeStreamHarness />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("accepts onDegenShake with degen enabled", () => {
    const onDegenShake = jest.fn();
    const screen = render(<Harness degen onDegenShake={onDegenShake} />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders in static mode and lays out without throwing", () => {
    const screen = render(
      <Harness static timeWindow={30} nowOverride={1700000030} />,
    );
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("static gates off pulse + degen but keeps scrub/scrubAction live", () => {
    // The controller forces the continuous animations (pulse, degen) off in
    // static, but scrub / scrubAction stay live (on-demand, no per-frame loop).
    // Exercising every gating branch with all of them enabled must render cleanly.
    const screen = render(
      <Harness
        static
        pulse
        scrub
        scrubAction
        degen
        nowOverride={1700000030}
      />,
    );
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("composes the default drag-to-scroll gesture when timeScroll is on (line)", () => {
    const screen = render(<Harness timeScroll scrub />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("enables time-scroll in candle mode", () => {
    const screen = render(<CandleHarness timeScroll />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("composes the axis-drag pan-scroll gesture via the config form", () => {
    const screen = render(
      <CandleHarness timeScroll={{ gesture: "axisDrag" }} scrub />,
    );
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("composes the order ticket (scrubAction) with time-scroll", () => {
    // axisDrag carves the bottom band out of the scrub + tap hit area (so a drag
    // there scrolls, not scrubs); holdToScrub keeps the whole plot live. Both
    // compose with scrubAction without crashing.
    for (const gesture of ["axisDrag", "holdToScrub"] as const) {
      const screen = render(
        <CandleHarness
          timeScroll={{ gesture }}
          scrubAction
          onScrubAction={jest.fn()}
        />,
      );
      const views = screen.UNSAFE_getAllByType(View);
      fireEvent(views[0], "layout", {
        nativeEvent: { layout: { width: 400, height: 200 } },
      });
    }
  });

  it("renders the floating y-axis + floating badge (full-width plot)", () => {
    // Float composes with the badge — the badge floats over the right edge.
    const screen = render(<CandleHarness yAxis={{ float: true }} badge />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("reserves the float gutter at rest when timeScroll is on", () => {
    // float + timeScroll: at the live edge (not scrolled) the chart keeps its
    // right gutter so the plot doesn't sit under the floating axis/badge. The
    // float collapses only once scrolled back (driven on the UI thread).
    const screen = render(
      <CandleHarness yAxis={{ float: true }} timeScroll badge />,
    );
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("composes the hold-to-scrub (one-finger drag) gesture", () => {
    // Default hold (no scrubHoldMs) and an explicit override both render cleanly.
    for (const ts of [
      { gesture: "holdToScrub" } as const,
      { gesture: "holdToScrub", scrubHoldMs: 600 } as const,
    ]) {
      const screen = render(<CandleHarness timeScroll={ts} scrub />);
      const views = screen.UNSAFE_getAllByType(View);
      fireEvent(views[0], "layout", {
        nativeEvent: { layout: { width: 400, height: 200 } },
      });
    }
  });
});
