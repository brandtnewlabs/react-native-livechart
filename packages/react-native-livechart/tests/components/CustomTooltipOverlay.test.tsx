import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { CustomTooltipOverlay } from "../../src/components/CustomTooltipOverlay";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import type { TooltipLayout } from "../../src/hooks/crosshairShared";
import type { CandlePoint, TooltipRenderProps } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

function engine(): ChartEngineLayout {
  return withSharedValueAccessors({
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 1000 },
    data: { value: [] },
  }) as unknown as ChartEngineLayout;
}

const LAYOUT: TooltipLayout = {
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
};

function Fixture({
  renderTooltip,
  placement = "side",
  candle,
  captureLineTop,
  scrubDotY,
  crosshairFade,
  crosshairFadeDistance,
  scrubXValue = 100,
}: {
  renderTooltip: (ctx: TooltipRenderProps) => React.ReactElement | null | undefined;
  placement?: "side" | "top" | "bottom" | "point";
  candle?: CandlePoint | null;
  captureLineTop?: (lineTop: SharedValue<number>) => void;
  scrubDotY?: number;
  crosshairFade?: boolean;
  crosshairFadeDistance?: number;
  scrubXValue?: number;
}) {
  const scrubX = useSharedValue(scrubXValue);
  const scrubValue = useSharedValue<number | null>(42);
  const scrubTime = useSharedValue(985);
  const scrubActive = useSharedValue(true);
  const tooltipLayout = useSharedValue<TooltipLayout>(LAYOUT);
  const scrubCandle = useSharedValue<CandlePoint | null>(candle ?? null);
  const lineTop = useSharedValue(-1);
  const scrubDotYSV = useSharedValue(scrubDotY ?? -1);
  captureLineTop?.(lineTop);
  return (
    <CustomTooltipOverlay
      renderTooltip={renderTooltip}
      scrubX={scrubX}
      scrubValue={scrubValue}
      scrubTime={scrubTime}
      scrubActive={scrubActive}
      // Only wire scrubCandle when a candle is supplied, so the line-mode tests
      // also exercise the `?? nullCandle` fallback (candle prop omitted).
      scrubCandle={candle === undefined ? undefined : scrubCandle}
      tooltipLayout={tooltipLayout}
      engine={engine()}
      padding={DEFAULT_PADDING}
      placement={placement}
      crosshairFade={crosshairFade}
      crosshairFadeDistance={crosshairFadeDistance}
      lineTop={lineTop}
      scrubDotY={scrubDotYSV}
    />
  );
}

describe("CustomTooltipOverlay", () => {
  it("floats the consumer's element over the canvas", async () => {
    const { getByTestId } = await render(
      <Fixture renderTooltip={() => <Text testID="custom-tip">tip</Text>} />,
    );
    expect(getByTestId("custom-tip")).toBeTruthy();
  });

  it("keeps the custom tooltip opaque when edge fade is disabled", async () => {
    const { toJSON } = await render(
      <Fixture
        crosshairFade={false}
        scrubXValue={400 - DEFAULT_PADDING.right}
        renderTooltip={() => <Text testID="custom-tip">tip</Text>}
      />,
    );
    expect(JSON.stringify(toJSON())).toContain('"opacity":1');
  });

  it("uses the configured edge-fade distance", async () => {
    const { toJSON } = await render(
      <Fixture
        crosshairFadeDistance={8}
        scrubXValue={400 - DEFAULT_PADDING.right - 2}
        renderTooltip={() => <Text testID="custom-tip">tip</Text>}
      />,
    );
    expect(JSON.stringify(toJSON())).toContain('"opacity":0.25');
  });

  it("measures the element via onLayout without throwing", async () => {
    const { getByTestId } = await render(
      <Fixture renderTooltip={() => <Text testID="custom-tip">tip</Text>} />,
    );
    // Drive an onLayout so the size-measurement branch executes.
    await fireEvent(getByTestId("custom-tip").parent!, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 80, height: 40 } },
    });
    expect(getByTestId("custom-tip")).toBeTruthy();
  });

  it("renders nothing when renderTooltip returns null", async () => {
    const { toJSON } = await render(<Fixture renderTooltip={() => null} />);
    expect(toJSON()).toBeNull();
  });

  it("exposes the scrub state as SharedValues in the context", async () => {
    let captured: TooltipRenderProps | undefined;
    await render(
      <Fixture
        renderTooltip={(ctx) => {
          captured = ctx;
          return <Text testID="tip">{ctx.valueStr.get()}</Text>;
        }}
      />,
    );
    expect(captured).toBeDefined();
    // Live bits are SharedValues (not snapshots) so animated text stays smooth.
    expect(typeof captured!.value.get).toBe("function");
    expect(typeof captured!.timeStr.get).toBe("function");
    expect(captured!.valueStr.get()).toBe("42.00");
    expect(captured!.timeStr.get()).toBe("12:00:00");
    // `candle` is always present (a SharedValue); null in line mode.
    expect(typeof captured!.candle.get).toBe("function");
    expect(captured!.candle.get()).toBeNull();
  });

  it("exposes the scrubbed OHLC candle in candle mode", async () => {
    const ohlc: CandlePoint = {
      time: 985,
      open: 100,
      high: 120,
      low: 90,
      close: 110,
    };
    let captured: TooltipRenderProps | undefined;
    const { getByTestId } = await render(
      <Fixture
        candle={ohlc}
        renderTooltip={(ctx) => {
          captured = ctx;
          const c = ctx.candle.get();
          return <Text testID="ohlc">{c ? `C ${c.close}` : "—"}</Text>;
        }}
      />,
    );
    expect(getByTestId("ohlc")).toBeTruthy();
    expect(captured!.candle.get()).toEqual(ohlc);
  });

  it("publishes the top-pinned label's bottom edge as the crosshair line-stop", async () => {
    let lineTop: SharedValue<number> | undefined;
    const { getByTestId } = await render(
      <Fixture
        placement="top"
        captureLineTop={(sv) => {
          lineTop = sv;
        }}
        renderTooltip={() => <Text testID="tip-top">tip</Text>}
      />,
    );
    // Before layout the line keeps its default start.
    expect(lineTop!.value).toBe(-1);
    await fireEvent(getByTestId("tip-top").parent!, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 80, height: 40 } },
    });
    // Label bottom = margin (default 8) + measured height (40).
    expect(lineTop!.value).toBe(48);
  });

  it("leaves the line-stop unset (-1) for non-top placement", async () => {
    let lineTop: SharedValue<number> | undefined;
    const { getByTestId } = await render(
      <Fixture
        placement="bottom"
        captureLineTop={(sv) => {
          lineTop = sv;
        }}
        renderTooltip={() => <Text testID="tip-bottom">tip</Text>}
      />,
    );
    await fireEvent(getByTestId("tip-bottom").parent!, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 80, height: 40 } },
    });
    expect(lineTop!.value).toBe(-1);
  });

  it("positions for top/bottom placement without error", async () => {
    const top = await render(
      <Fixture
        placement="top"
        renderTooltip={() => <Text testID="tip-top">tip</Text>}
      />,
    );
    expect(top.getByTestId("tip-top")).toBeTruthy();

    const bottom = await render(
      <Fixture
        placement="bottom"
        renderTooltip={() => <Text testID="tip-bottom">tip</Text>}
      />,
    );
    expect(bottom.getByTestId("tip-bottom")).toBeTruthy();
  });

  it("positions for 'point' placement (anchored above the dot) without error", async () => {
    const { getByTestId } = await render(
      <Fixture
        placement="point"
        scrubDotY={150}
        renderTooltip={() => <Text testID="tip-point">tip</Text>}
      />,
    );
    await fireEvent(getByTestId("tip-point").parent!, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 80, height: 40 } },
    });
    expect(getByTestId("tip-point")).toBeTruthy();
  });

  it("leaves the crosshair line-stop unset (-1) for 'point' placement", async () => {
    let lineTop: SharedValue<number> | undefined;
    const { getByTestId } = await render(
      <Fixture
        placement="point"
        scrubDotY={150}
        captureLineTop={(sv) => {
          lineTop = sv;
        }}
        renderTooltip={() => <Text testID="tip-point">tip</Text>}
      />,
    );
    await fireEvent(getByTestId("tip-point").parent!, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 80, height: 40 } },
    });
    // The pill floats over the line (not above it), so the line runs full height.
    expect(lineTop!.value).toBe(-1);
  });

  it("'point' placement flips below / falls back at edge dot positions without error", async () => {
    // Dot near the top → the pill flips below it.
    const flip = await render(
      <Fixture
        placement="point"
        scrubDotY={4}
        renderTooltip={() => <Text testID="tip-flip">tip</Text>}
      />,
    );
    expect(flip.getByTestId("tip-flip")).toBeTruthy();

    // Unknown dot Y (-1) → top-pin fallback.
    const fallback = await render(
      <Fixture
        placement="point"
        scrubDotY={-1}
        renderTooltip={() => <Text testID="tip-fallback">tip</Text>}
      />,
    );
    expect(fallback.getByTestId("tip-fallback")).toBeTruthy();
  });
});
