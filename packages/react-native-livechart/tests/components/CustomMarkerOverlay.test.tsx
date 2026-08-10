import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { CustomMarkerOverlay } from "../../src/components/CustomMarkerOverlay";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { resolveMarkerCluster } from "../../src/core/resolveConfig";
import type { LiveChartPoint, Marker, SeriesConfig } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

const anchored = resolveMarkerCluster("anchored");
const stacked = resolveMarkerCluster("stacked");

function engine(): ChartEngineLayout {
  return withSharedValueAccessors({
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 1000 },
  }) as unknown as ChartEngineLayout;
}

const MARKERS: Marker[] = [
  { id: "a", time: 999, kind: "trade", value: 50 },
  { id: "b", time: 998, kind: "boost", value: 55 },
];

describe("CustomMarkerOverlay", () => {
  it("floats a custom element for each marker renderMarker handles", async () => {
    function Fixture() {
      const markers = useSharedValue<Marker[]>(MARKERS);
      const lineData = useSharedValue<LiveChartPoint[]>([]);
      return (
        <CustomMarkerOverlay
          markers={markers}
          renderMarker={(m) => <Text testID={`cm-${m.id}`}>{m.id}</Text>}
          engine={engine()}
          padding={DEFAULT_PADDING}
          cluster={anchored}
          lineData={lineData}
        />
      );
    }
    const { getByTestId } = await render(<Fixture />);
    expect(getByTestId("cm-a")).toBeTruthy();
    expect(getByTestId("cm-b")).toBeTruthy();
  });

  it("renders nothing when renderMarker opts out of every marker", async () => {
    function Fixture() {
      const markers = useSharedValue<Marker[]>(MARKERS);
      return (
        <CustomMarkerOverlay
          markers={markers}
          // Returns null for all → no custom views, component renders null.
          renderMarker={() => null}
          engine={engine()}
          padding={DEFAULT_PADDING}
          cluster={anchored}
        />
      );
    }
    const { queryByTestId, toJSON } = await render(<Fixture />);
    expect(queryByTestId("cm-a")).toBeNull();
    expect(toJSON()).toBeNull();
  });

  it("renders only the markers renderMarker returns an element for", async () => {
    function Fixture() {
      const markers = useSharedValue<Marker[]>(MARKERS);
      return (
        <CustomMarkerOverlay
          markers={markers}
          renderMarker={(m) =>
            m.kind === "trade" ? <Text testID={`cm-${m.id}`}>{m.id}</Text> : null
          }
          engine={engine()}
          padding={DEFAULT_PADDING}
          cluster={anchored}
        />
      );
    }
    const { getByTestId, queryByTestId } = await render(<Fixture />);
    expect(getByTestId("cm-a")).toBeTruthy(); // trade → custom
    expect(queryByTestId("cm-b")).toBeNull(); // boost → falls back to glyph
  });

  it("centers via onLayout without throwing (measures element size)", async () => {
    function Fixture() {
      const markers = useSharedValue<Marker[]>([MARKERS[0]]);
      return (
        <CustomMarkerOverlay
          markers={markers}
          renderMarker={(m) => (
            <View testID={`cm-${m.id}`} style={{ width: 24, height: 24 }} />
          )}
          engine={engine()}
          padding={DEFAULT_PADDING}
          cluster={anchored}
        />
      );
    }
    const { getByTestId } = await render(<Fixture />);
    // Drive an onLayout so the centering branch (size measurement) executes.
    await fireEvent(getByTestId("cm-a").parent!, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 24, height: 24 } },
    });
    expect(getByTestId("cm-a")).toBeTruthy();
  });

  it("passes a render context (index/side) to renderMarker", async () => {
    const seen: { index: number; side: string }[] = [];
    function Fixture() {
      const markers = useSharedValue<Marker[]>([
        { id: "a", time: 999, kind: "trade", value: 50, side: "below" },
      ]);
      return (
        <CustomMarkerOverlay
          markers={markers}
          renderMarker={(m, ctx) => {
            seen.push({ index: ctx.index, side: ctx.side });
            return <Text testID={`cm-${m.id}`}>{m.id}</Text>;
          }}
          engine={engine()}
          padding={DEFAULT_PADDING}
          cluster={anchored}
        />
      );
    }
    await render(<Fixture />);
    expect(seen[0]).toEqual({ index: 0, side: "below" });
  });

  it("clusters co-located custom markers without crashing (stacked)", async () => {
    function Fixture() {
      const markers = useSharedValue<Marker[]>([
        { id: "a", time: 999, kind: "trade", value: 50, side: "above" },
        { id: "b", time: 999, kind: "trade", value: 50, side: "above" },
      ]);
      return (
        <CustomMarkerOverlay
          markers={markers}
          renderMarker={(m) => <Text testID={`cm-${m.id}`}>{m.id}</Text>}
          engine={engine()}
          padding={DEFAULT_PADDING}
          cluster={stacked}
        />
      );
    }
    const { getByTestId } = await render(<Fixture />);
    expect(getByTestId("cm-a")).toBeTruthy();
  });

  it("collapses a co-located run of custom markers (stacked)", async () => {
    function Fixture() {
      const markers = useSharedValue<Marker[]>(
        Array.from({ length: 7 }, (_, i) => ({
          id: `m${i}`,
          time: 999,
          kind: "trade" as const,
          value: 50,
          side: "above" as const,
        })),
      );
      return (
        <CustomMarkerOverlay
          markers={markers}
          renderMarker={(m, ctx) => (
            <Text testID={`cm-${m.id}`}>{ctx.isGrouped ? `+${ctx.groupCount}` : m.id}</Text>
          )}
          engine={engine()}
          padding={DEFAULT_PADDING}
          cluster={stacked}
        />
      );
    }
    const { getByTestId } = await render(<Fixture />);
    // All views mount (collapsed members are hidden via opacity, not unmounted).
    expect(getByTestId("cm-m6")).toBeTruthy();
  });

  it("anchors a custom marker to a series by seriesId", async () => {
    function Fixture() {
      const markers = useSharedValue<Marker[]>([
        { id: "s", time: 990, kind: "winner", seriesId: "a" },
      ]);
      const series = useSharedValue<SeriesConfig[]>([
        {
          id: "a",
          value: 0,
          data: [
            { time: 980, value: 20 },
            { time: 1000, value: 40 },
          ],
        },
      ]);
      return (
        <CustomMarkerOverlay
          markers={markers}
          renderMarker={(m) => <Text testID={`cm-${m.id}`}>{m.id}</Text>}
          engine={engine()}
          padding={DEFAULT_PADDING}
          cluster={anchored}
          series={series}
        />
      );
    }
    const { getByTestId } = await render(<Fixture />);
    expect(getByTestId("cm-s")).toBeTruthy();
  });
});
