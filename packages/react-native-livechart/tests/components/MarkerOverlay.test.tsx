import { render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue } from "react-native-reanimated";
import { MarkerOverlay } from "../../src/components/MarkerOverlay";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { resolveMarkerCluster } from "../../src/core/resolveConfig";
import type { ResolvedMarkerCluster } from "../../src/math/markerCluster";
import { resolveTheme } from "../../src/theme";
import type { Marker, SeriesConfig } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

const palette = resolveTheme("#3b82f6", "dark");
const anchored = resolveMarkerCluster("anchored");
const stacked = resolveMarkerCluster("stacked");

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;

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

const ALL_KINDS: Marker[] = [
  { id: "t", time: 999, kind: "trade", value: 50 },
  { id: "b", time: 998, kind: "boost", value: 55 },
  { id: "g", time: 997, kind: "graduation", value: 60 },
  { id: "w", time: 996, kind: "winner", value: 65 },
  { id: "c", time: 995, kind: "clawback", value: 40 },
];

function renderOverlay(
  markers: Marker[],
  opts: {
    cluster?: ResolvedMarkerCluster;
    series?: SeriesConfig[];
    renderMarker?: (m: Marker) => React.ReactElement | null;
  } = {},
) {
  function Fixture() {
    const m = useSharedValue<Marker[]>(markers);
    const s = useSharedValue<SeriesConfig[]>(opts.series ?? []);
    return (
      <MarkerOverlay
        markers={m}
        engine={engine()}
        padding={DEFAULT_PADDING}
        palette={palette}
        font={font}
        series={opts.series ? s : undefined}
        renderMarker={opts.renderMarker}
        cluster={opts.cluster ?? anchored}
      />
    );
  }
  return render(<Fixture />);
}

describe("MarkerOverlay", () => {
  it("renders a glyph for every marker kind (self-projected)", () => {
    renderOverlay(ALL_KINDS);
  });

  it("renders a text icon and a custom color", () => {
    renderOverlay([
      { id: "i", time: 999, kind: "trade", value: 50, icon: "★", color: "#ff0" },
    ]);
  });

  it("renders a pill badge around the icon", () => {
    renderOverlay([
      { id: "buy", time: 999, kind: "trade", value: 50, icon: "+", color: "#16a34a", pill: true },
      { id: "sell", time: 998, kind: "trade", value: 55, icon: "−", color: "#dc2626", pill: true },
    ]);
  });

  it("renders an image icon", () => {
    renderOverlay([
      {
        id: "img",
        time: 999,
        kind: "trade",
        value: 50,
        image: { width: () => 20, height: () => 20 } as never,
        size: 20,
      },
    ]);
  });

  it("excludes custom-rendered markers from the atlas (renderMarker)", () => {
    renderOverlay(
      [
        { id: "atlas", time: 999, kind: "trade", value: 50 },
        { id: "custom", time: 998, kind: "winner", value: 55 },
      ],
      { renderMarker: (m) => (m.id === "custom" ? <></> : null) },
    );
  });

  it("anchors a marker to a series by seriesId", () => {
    renderOverlay([{ id: "s", time: 990, kind: "winner", seriesId: "a" }], {
      series: [
        {
          id: "a",
          value: 0,
          data: [
            { time: 980, value: 20 },
            { time: 1000, value: 40 },
          ],
        },
      ],
    });
  });

  it("stacks and sides co-located markers without crashing", () => {
    renderOverlay(
      [
        { id: "buy", time: 999, kind: "trade", value: 50, icon: "+", pill: true, side: "below" },
        { id: "sell", time: 999, kind: "trade", value: 50, icon: "−", pill: true, side: "above" },
        { id: "buy2", time: 999, kind: "trade", value: 50, icon: "+", pill: true, side: "below" },
      ],
      { cluster: stacked },
    );
  });

  it("collapses a large co-located run into a count badge", () => {
    const burst: Marker[] = [];
    for (let i = 0; i < 9; i++) {
      burst.push({ id: `m${i}`, time: 999, kind: "trade", value: 50, side: "above" });
    }
    renderOverlay(burst, { cluster: stacked });
  });

  // #165: a collapsed group can draw the representative marker's own glyph
  // (its icon/pill/image/kind) instead of the round count badge.
  it("draws the representative glyph for a collapsed group with groupBadge: marker", () => {
    const markerBadge = resolveMarkerCluster({
      mode: "stacked",
      groupBadge: "marker",
    });
    const burst: Marker[] = [];
    for (let i = 0; i < 9; i++) {
      burst.push({
        id: `buy${i}`,
        time: 999,
        kind: "trade",
        value: 50,
        icon: "+",
        pill: true,
        color: "#16a34a",
        side: "below",
      });
    }
    renderOverlay(burst, { cluster: markerBadge });
  });

  it("overlays a corner count on the representative glyph with showGroupCount", () => {
    const markerCount = resolveMarkerCluster({
      mode: "stacked",
      groupBadge: "marker",
      showGroupCount: true,
    });
    const burst: Marker[] = [];
    for (let i = 0; i < 12; i++) {
      burst.push({
        id: `sell${i}`,
        time: 999,
        kind: "trade",
        value: 50,
        icon: "−",
        pill: true,
        color: "#dc2626",
        side: "above",
      });
    }
    renderOverlay(burst, { cluster: markerCount });
  });

  // #165 (dedicated badge): a collapsed group can draw a custom group-only glyph
  // supplied via `groupBadge` (object form), independent of the member markers.
  it("draws a dedicated group badge from the groupBadge object form", () => {
    const dedicated = resolveMarkerCluster({
      mode: "stacked",
      groupBadge: { icon: "★", pill: true, color: "#a855f7" },
      showGroupCount: true,
    });
    const burst: Marker[] = [];
    for (let i = 0; i < 9; i++) {
      // Members are plain trade dots — the group badge is intentionally distinct.
      burst.push({ id: `d${i}`, time: 999, kind: "trade", value: 50, side: "above" });
    }
    renderOverlay(burst, { cluster: dedicated });
  });

  it("falls back to the count badge when a group-badge object has no image/icon", () => {
    const empty = resolveMarkerCluster({
      mode: "stacked",
      groupBadge: {} as never,
    });
    const burst: Marker[] = [];
    for (let i = 0; i < 9; i++) {
      burst.push({ id: `e${i}`, time: 999, kind: "trade", value: 50, side: "above" });
    }
    renderOverlay(burst, { cluster: empty });
  });
});
