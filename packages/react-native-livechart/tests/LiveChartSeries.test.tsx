import React from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { LiveChartSeries } from "../src/components/LiveChartSeries";
import { ReferenceLineOverlay } from "../src/components/ReferenceLineOverlay";
import { DefaultSelectionDot } from "../src/components/SelectionDot";
import type { SeriesConfig } from "../src/types";

describe("LiveChartSeries", () => {
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
    const screen = render(<H />);
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
    const screen = render(<H />);
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
          referenceLines={[{ value: 11 }]}
          legend={{ compact: true }}
          onSeriesToggle={jest.fn()}
        />
      );
    }
    const screen = render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
    const views = screen.UNSAFE_getAllByType(View);
    const layoutView =
      views.find((v) => typeof v.props.onLayout === "function") ?? views[0];
    fireEvent(layoutView, "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
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

    const screen = render(<H />);
    await waitFor(() => expect(screen.getByTestId("series-target")).toBeTruthy());

    const badgePass = screen
      .UNSAFE_getAllByType(ReferenceLineOverlay)
      .filter((overlay) => overlay.props.badgeLayer);
    expect(badgePass.map((overlay) => overlay.props.suppressTag)).toEqual([
      true,
      false,
    ]);
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
    const screen = render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
    const views = screen.UNSAFE_getAllByType(View);
    const layoutView =
      views.find((v) => typeof v.props.onLayout === "function") ?? views[0];
    fireEvent(layoutView, "layout", {
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
    const screen = render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
    const views = screen.UNSAFE_getAllByType(View);
    const layoutView =
      views.find((v) => typeof v.props.onLayout === "function") ?? views[0];
    fireEvent(layoutView, "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
    // The dot can only follow one line, so multi-series defaults it off.
    expect(screen.UNSAFE_queryAllByType(DefaultSelectionDot)).toHaveLength(0);
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
    const screen = render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
    const views = screen.UNSAFE_getAllByType(View);
    const layoutView =
      views.find((v) => typeof v.props.onLayout === "function") ?? views[0];
    fireEvent(layoutView, "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
    expect(
      screen.UNSAFE_queryAllByType(DefaultSelectionDot).length,
    ).toBeGreaterThan(0);
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
    const screen = render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
  });
});
