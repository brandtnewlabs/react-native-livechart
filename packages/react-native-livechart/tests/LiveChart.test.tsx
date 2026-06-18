import { fireEvent, render } from "@testing-library/react-native";

import React from "react";
import { View } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { LiveChart } from "../src/components/LiveChart";
import type {
  CandlePoint,
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

  it("supports gradient off and overlays off", () => {
    render(<Harness gradient={false} yAxis={false} badge={false} />);
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

  it("static gates off pulse, scrub, and degen even when requested", () => {
    // The controller forces these features off in static; exercising the gating
    // branches with all three explicitly enabled must still render cleanly.
    const screen = render(
      <Harness static pulse scrub degen nowOverride={1700000030} />,
    );
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 200 } },
    });
  });

  it("composes the two-finger pan-scroll gesture when timeScroll is on (line)", () => {
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
