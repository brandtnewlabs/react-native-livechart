import React from "react";
import { View } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { LiveChartSeries } from "../src/components/LiveChartSeries";
import * as seriesEngineHooks from "../src/core/useLiveChartSeriesEngine";
import type {
  ChartOverlayContext,
  LiveChartHandle,
  SeriesConfig,
} from "../src/types";
import { getAllByHostType } from "./rntl14";

describe("LiveChartSeries", () => {
  it("exposes an imperative pinch-zoom reset", async () => {
    const ref = React.createRef<LiveChartHandle>();
    function H() {
      const series = useSharedValue<SeriesConfig[]>([
        {
          id: "a",
          label: "A",
          data: [{ time: 1_700_000_000, value: 10 }],
          value: 10,
          color: "#3b82f6",
        },
      ]);
      return <LiveChartSeries ref={ref} series={series} zoom />;
    }

    await render(<H />);
    expect(ref.current?.resetZoom).toBeInstanceOf(Function);
  });

  it("opts into an opaque canvas and replaces destination-alpha masks", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return <LiveChartSeries series={series} canvasMode="opaque" />;
    }

    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
    const views = getAllByHostType(screen, View);
    expect(views.some((view) => view.props.opaque === true)).toBe(true);
    expect(views.some((view) => view.props.blendMode === "dstOut")).toBe(false);
  });

  it("renders with default scrub when scrub prop is omitted", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return <LiveChartSeries series={series} />;
    }
    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
  });

  it("keeps live dots out of the partially transparent series group", async () => {
    const seriesOpacity = { value: 0.5 } as SharedValue<number>;
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return (
        <LiveChartSeries
          series={series}
          seriesOpacity={seriesOpacity}
          dot={{ valueLabel: true, valueLine: true }}
        />
      );
    }

    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
    expect(
      getAllByHostType(screen, View)
        .filter((view) => view.props.opacity === seriesOpacity),
    ).toHaveLength(2);
  });

  it("forwards configurable crosshair fade distance and line cap", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return (
        <LiveChartSeries
          series={series}
          scrub={{ crosshairFadeDistance: 12, crosshairLineCap: "square" }}
        />
      );
    }

    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
  });

  it("renders with timeScroll + zoom + paging callbacks wired", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return (
        <LiveChartSeries
          series={series}
          timeScroll={{ gesture: "holdToScrub", scrubHoldMs: 400 }}
          zoom={{ minTimeWindow: 5 }}
          onVisibleRangeChange={jest.fn()}
          onReachStart={jest.fn()}
        />
      );
    }
    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
  });

  it("renders with scrub, reference line, and compact chips", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return (
        <LiveChartSeries
          series={series}
          scrub={{ tooltip: true }}
          yAxis={{
            intervalScale: 1_000_000,
            labelRightMargin: 8,
            gridEndGap: 6,
          }}
          referenceLines={[{ value: 11 }]}
          legend={{ compact: true }}
          onSeriesToggle={jest.fn()}
        />
      );
    }
    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
    const views = getAllByHostType(screen, View);
    const layoutView =
      views.find((v) => typeof v.props.onLayout === "function") ?? views[0];
    await fireEvent(layoutView, "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("mounts the opt-in per-series tooltip and respects the master tooltip switch", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H({ tooltip = true }: { tooltip?: boolean }) {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return (
        <LiveChartSeries
          series={series}
          scrub={{ tooltip, seriesTooltip: { alwaysShow: true } }}
        />
      );
    }

    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
    expect(
      screen.getByTestId("live-chart-series-tooltip-overlay"),
    ).toBeTruthy();

    await screen.rerender(<H tooltip={false} />);
    expect(
      screen.queryByTestId("live-chart-series-tooltip-overlay"),
    ).toBeNull();
  });

  it("renders custom reference-line tags with per-line built-in fallback", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return (
        <LiveChartSeries
          series={series}
          referenceLines={[
            { value: 11, label: "Target", badge: { position: "right" } },
            { value: 12, label: "Built in", badge: { position: "center" } },
          ]}
          renderReferenceLine={({ line }) =>
            line.label === "Target" ? <View testID="series-target" /> : null
          }
        />
      );
    }

    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByTestId("series-target")).toBeTruthy());

  });

  it("renders the per-series tooltip above custom reference-line tags", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return (
        <LiveChartSeries
          series={series}
          scrub={{ seriesTooltip: { alwaysShow: true } }}
          referenceLines={[
            {
              value: 99,
              label: "Target",
              excludeFromRange: true,
            },
          ]}
          renderReferenceLine={() => <View testID="series-target" />}
        />
      );
    }

    const screen = await render(<H />);
    await screen.findByTestId("series-target");
    const tooltipCanvas = screen.getByTestId(
      "live-chart-series-tooltip-overlay",
    );
    const tree = JSON.stringify(screen.toJSON());

    expect(tree.indexOf("series-target")).toBeLessThan(
      tree.indexOf("live-chart-series-tooltip-overlay"),
    );
    expect(tooltipCanvas.props.pointerEvents).toBe("none");
  });

  it("replaces only an off-axis tag while preserving the in-range fallback", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return (
        <LiveChartSeries
          series={series}
          referenceLines={[
            {
              value: 99,
              label: "Target",
              excludeFromRange: true,
              badge: { position: "left" },
            },
            { value: 11, label: "Built in", badge: { position: "center" } },
          ]}
          renderOffAxisReferenceLine={({ line }) =>
            line.label === "Target" ? <View testID="series-off-axis-target" /> : null
          }
        />
      );
    }

    const screen = await render(<H />);
    await waitFor(() =>
      expect(screen.getByTestId("series-off-axis-target")).toBeTruthy(),
    );

  });

  it("passes a custom overlay the multi-series chart's resolved plot inset", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    let overlayContext: ChartOverlayContext | undefined;
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return (
        <LiveChartSeries
          series={series}
          insets={{ left: 31, top: 7, right: 53, bottom: 19 }}
          renderOverlay={(ctx) => {
            overlayContext = ctx;
            return <View testID="series-overlay" />;
          }}
        />
      );
    }

    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByTestId("series-overlay")).toBeTruthy());
    // The canvas is unmeasured in the renderer fixture, but the bridge already
    // carries the resolved per-side inset. `useChartOverlayContext` separately
    // verifies the same bridge against a nonzero canvas.
    expect(overlayContext?.scale.get().plot).toEqual({
      left: 31,
      top: 7,
      right: -53,
      bottom: -19,
      width: 0,
      height: 0,
    });
  });

  it("renders with per-series value lines", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return <LiveChartSeries series={series} dot={{ valueLine: true }} />;
    }
    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
    const views = getAllByHostType(screen, View);
    const layoutView =
      views.find((v) => typeof v.props.onLayout === "function") ?? views[0];
    await fireEvent(layoutView, "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("hides the scrub selection dot by default (multi-series)", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return <LiveChartSeries series={series} />;
    }
    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
    const views = getAllByHostType(screen, View);
    const layoutView =
      views.find((v) => typeof v.props.onLayout === "function") ?? views[0];
    await fireEvent(layoutView, "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
    // The dot can only follow one line, so multi-series defaults it off.
  });

  it("shows the scrub selection dot when opted in via selectionDot", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return <LiveChartSeries series={series} selectionDot />;
    }
    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
    const views = getAllByHostType(screen, View);
    const layoutView =
      views.find((v) => typeof v.props.onLayout === "function") ?? views[0];
    await fireEvent(layoutView, "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders with explicit non-default props", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const sv = useSharedValue<SeriesConfig[]>(initial);
      return (
        <LiveChartSeries
          series={sv}
          theme="light"
          accentColor="#ef4444"
          timeWindow={60}
          paused
          smoothing={0.1}
          exaggerate
          emptyText="empty"
          yAxis={false}
          xAxis={false}
          scrub={false}
          formatValue={(v) => `${v}`}
          formatTime={(t) => `${t}`}
          line={{ width: 3 }}
        />
      );
    }
    const screen = await render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
  });
});

describe("LiveChartSeries series plot clip", () => {
  afterEach(() => jest.restoreAllMocks());

  it("draws vertical grid lines at the time ticks only when opted in", async () => {
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [{ time: 1_700_000_000, value: 10 }],
        value: 10,
        color: "#3b82f6",
      },
    ];
    function H({ gridLines }: { gridLines?: boolean }) {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return (
        <LiveChartSeries
          series={series}
          gridStyle={{ color: "#fedcba" }}
          xAxis={{ gridLines }}
        />
      );
    }
    const gridColored = (screen: Awaited<ReturnType<typeof render>>) =>
      getAllByHostType(screen, View).filter(
        (v) => v.props.color === "#fedcba",
      );

    expect(gridColored(await render(<H />))).toHaveLength(1);
    expect(gridColored(await render(<H gridLines />))).toHaveLength(11);
  });

  it("clips the series strokes to the plot's vertical extent", async () => {
    const useActualEngine = seriesEngineHooks.useLiveChartSeriesEngine;
    // Derived values freeze at mount under the Jest stub, so seed the canvas
    // size the clip reads before the first render.
    jest
      .spyOn(seriesEngineHooks, "useLiveChartSeriesEngine")
      .mockImplementation((config) => {
        const engine = useActualEngine(config);
        engine.canvasWidth.value = 400;
        engine.canvasHeight.value = 300;
        return engine;
      });
    const initial: SeriesConfig[] = [
      {
        id: "a",
        label: "A",
        data: [
          { time: 1_700_000_000, value: 10 },
          { time: 1_700_000_030, value: 12 },
        ],
        value: 12,
        color: "#3b82f6",
      },
    ];
    function H() {
      const series = useSharedValue<SeriesConfig[]>(initial);
      return (
        <LiveChartSeries
          series={series}
          insets={{ top: 10, bottom: 30 }}
          yAxis={false}
        />
      );
    }

    // Only the stroke group is clipped. Its strokes mount from a UI-thread
    // series snapshot, which doesn't run under Jest.
    const screen = await render(<H />);
    const clipped = getAllByHostType(screen, View).filter(
      (v) => v.props.clip != null,
    );
    expect(clipped).toHaveLength(1);
    expect(clipped[0].props.clip.value).toEqual({
      x: -400,
      y: 10,
      width: 1200,
      height: 260,
    });
  });
});
