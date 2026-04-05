import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { LivelineMulti } from "./LivelineMulti";
import type { LivelineSeries } from "./types";
import React from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

describe("LivelineMulti", () => {
  it("renders with default scrub when scrub prop is omitted", async () => {
    const initial: LivelineSeries[] = [
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
      const series = useSharedValue<LivelineSeries[]>(initial);
      return <LivelineMulti series={series} />;
    }
    const screen = render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
  });

  it("renders with scrub, reference line, and compact chips", async () => {
    const initial: LivelineSeries[] = [
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
      const series = useSharedValue<LivelineSeries[]>(initial);
      return (
        <LivelineMulti
          series={series}
          scrub={{ tooltip: true }}
          referenceLine={{ value: 11 }}
          seriesToggleCompact
          onSeriesToggle={jest.fn()}
        />
      );
    }
    const screen = render(<H />);
    await waitFor(() => expect(screen.getByText("A")).toBeTruthy());
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders with explicit non-default props", async () => {
    const initial: LivelineSeries[] = [
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
      const sv = useSharedValue<LivelineSeries[]>(initial);
      return (
        <LivelineMulti
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
