import { act, fireEvent, render } from "@testing-library/react-native";
import { SeriesToggleChips, seriesMetaSig } from "../../src/components/SeriesToggleChips";

import React from "react";
import { useSharedValue } from "react-native-reanimated";
import type { ResolvedLegendConfig } from "../../src/core/resolveConfig";
import type { SeriesConfig } from "../../src/types";

/**
 * `SeriesToggleChips` uses `scheduleOnRN` (→ `queueMicrotask` in Jest) from
 * `useAnimatedReaction` to call `setSnapshot`. Flush those microtasks inside
 * `act` so React does not warn about updates outside `act`.
 */
function flushScheduleOnRN() {
  return act(async () => {
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
}

const DEFAULT_LEGEND: ResolvedLegendConfig = {
  visible: true,
  compact: false,
  position: "top",
};

function ChipsHarness({
  onToggle,
  compact,
}: {
  onToggle: (id: string, visible: boolean) => void;
  compact?: boolean;
}) {
  const series = useSharedValue<SeriesConfig[]>([
    {
      id: "a",
      label: "Alpha",
      data: [],
      value: 1,
      color: "#3b82f6",
    },
  ]);
  return (
    <SeriesToggleChips
      series={series}
      onSeriesToggle={onToggle}
      legend={{ ...DEFAULT_LEGEND, compact: compact ?? false }}
    />
  );
}

describe("seriesMetaSig", () => {
  it("encodes id, label, color, and visibility", () => {
    expect(
      seriesMetaSig([
        {
          id: "x",
          label: undefined,
          data: [],
          value: 1,
          visible: false,
        },
        {
          id: "y",
          label: "Y",
          data: [],
          value: 2,
          color: "#fff",
        },
      ]),
    ).toContain("x\x1f\x1f\x1f0");
    expect(
      seriesMetaSig([
        {
          id: "y",
          label: "Y",
          data: [],
          value: 2,
          color: "#fff",
        },
      ]),
    ).toContain("#fff\x1f1");
  });
});

describe("SeriesToggleChips", () => {
  it("renders a chip per series and toggles visibility off", async () => {
    const onToggle = jest.fn();
    const screen = render(<ChipsHarness onToggle={onToggle} />);
    await flushScheduleOnRN();
    expect(screen.getByText("Alpha")).toBeTruthy();
    fireEvent.press(screen.getByText("Alpha"));
    await flushScheduleOnRN();
    expect(onToggle).toHaveBeenCalledWith("a", false);
  });

  // Skipped: second press requires full Worklets/Reanimated shared-value semantics in Jest
  // (see jest-setup.js native proxy). First toggle is covered above.
  it.skip("second press restores visibility and calls onSeriesToggle with true", async () => {
    const onToggle = jest.fn();
    const screen = render(<ChipsHarness onToggle={onToggle} />);
    await flushScheduleOnRN();
    fireEvent.press(screen.getByText("Alpha"));
    await flushScheduleOnRN();
    fireEvent.press(screen.getByText("Alpha"));
    await flushScheduleOnRN();
    expect(onToggle).toHaveBeenCalledWith("a", true);
  });

  it("uses id as chip text when label is omitted", async () => {
    function IdOnlyHarness() {
      const series = useSharedValue<SeriesConfig[]>([
        { id: "idOnly", data: [], value: 1, color: "#333" },
      ]);
      return <SeriesToggleChips series={series} legend={DEFAULT_LEGEND} />;
    }
    const screen = render(<IdOnlyHarness />);
    await flushScheduleOnRN();
    expect(screen.getByText("idOnly")).toBeTruthy();
  });

  it("accepts compact layout", async () => {
    const onToggle = jest.fn();
    render(<ChipsHarness onToggle={onToggle} compact />);
    await flushScheduleOnRN();
  });

  it("maps multiple series so only the toggled index updates", async () => {
    const onToggle = jest.fn();
    function TwoHarness() {
      const series = useSharedValue<SeriesConfig[]>([
        {
          id: "a",
          label: "A",
          data: [],
          value: 1,
          color: "#3b82f6",
        },
        {
          id: "b",
          label: "B",
          data: [],
          value: 2,
          color: "#ef4444",
        },
      ]);
      return (
        <SeriesToggleChips
          series={series}
          onSeriesToggle={onToggle}
          legend={DEFAULT_LEGEND}
        />
      );
    }
    const screen = render(<TwoHarness />);
    await flushScheduleOnRN();
    fireEvent.press(screen.getByText("B"));
    await flushScheduleOnRN();
    expect(onToggle).toHaveBeenCalledWith("b", false);
  });

  it("uses neutral swatch when color is missing", async () => {
    function NoColorHarness() {
      const series = useSharedValue<SeriesConfig[]>([
        {
          id: "plain",
          label: "Plain",
          data: [],
          value: 1,
        },
      ]);
      return <SeriesToggleChips series={series} legend={DEFAULT_LEGEND} />;
    }
    const screen = render(<NoColorHarness />);
    await flushScheduleOnRN();
    expect(screen.getByText("Plain")).toBeTruthy();
  });
});
