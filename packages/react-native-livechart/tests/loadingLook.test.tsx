import { render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue } from "react-native-reanimated";

// Record what the loading shell and the reveal morph are handed; both are the
// real modules otherwise (the shell renders nothing here).
type ShellProps = {
  lineColor?: string;
  waveAmplitude?: number;
  waveSpeed?: number;
  showAxisLabels?: boolean;
};
const mockShellProps: ShellProps[] = [];
jest.mock("../src/components/LoadingOverlay", () => ({
  LoadingOverlay: (props: ShellProps) => {
    mockShellProps.push(props);
    return null;
  },
}));
const mockMorphArgs: unknown[][] = [];
jest.mock("../src/hooks/useChartPaths", () => {
  const actual = jest.requireActual("../src/hooks/useChartPaths");
  return {
    ...actual,
    useChartPaths: (...args: unknown[]) => {
      mockMorphArgs.push(args);
      return actual.useChartPaths(...args);
    },
  };
});

import { LiveChart } from "../src/components/LiveChart";
import { LiveChartSeries } from "../src/components/LiveChartSeries";
import type { LiveChartPoint, LoadingConfig, SeriesConfig } from "../src/types";

const LOOK: LoadingConfig = {
  color: "#ff0066",
  amplitude: 22,
  speed: 1.5,
  axisLabels: false,
};

beforeEach(() => {
  mockShellProps.length = 0;
  mockMorphArgs.length = 0;
});

function lastShell() {
  return mockShellProps[mockShellProps.length - 1];
}

// The shell fades out and the reveal morph runs once `loading` has turned off:
// they must keep the look the chart was loading with, not the defaults.
describe("the loading look outlives `loading`", () => {
  it("LiveChart: the fading shell and the reveal morph keep the config", async () => {
    function Chart({ loading }: { loading: boolean | LoadingConfig }) {
      const data = useSharedValue<LiveChartPoint[]>([
        { time: 1_700_000_000, value: 10 },
        { time: 1_700_000_030, value: 30 },
      ]);
      const value = useSharedValue(30);
      return <LiveChart data={data} value={value} timeWindow={30} loading={loading} />;
    }
    const screen = await render(<Chart loading={LOOK} />);
    await screen.rerender(<Chart loading={false} />);

    expect(lastShell()).toMatchObject({
      lineColor: "#ff0066",
      waveAmplitude: 22,
      waveSpeed: 1.5,
      showAxisLabels: false,
    });
    // useChartPaths(engine, padding, morphT, thresholdY, linear, squiggleAmplitude, squiggleSpeed, …)
    const morph = mockMorphArgs[mockMorphArgs.length - 1];
    expect(morph.slice(5, 7)).toEqual([22, 1.5]);
  });

  it("LiveChartSeries: the fading shell keeps the config", async () => {
    function Chart({ loading }: { loading: boolean | LoadingConfig }) {
      const series = useSharedValue<SeriesConfig[]>([
        {
          id: "a",
          label: "A",
          data: [{ time: 1_700_000_000, value: 10 }],
          value: 10,
          color: "#3b82f6",
        },
      ]);
      return <LiveChartSeries series={series} loading={loading} />;
    }
    const screen = await render(<Chart loading={LOOK} />);
    await screen.rerender(<Chart loading={false} />);

    expect(lastShell()).toMatchObject({
      lineColor: "#ff0066",
      waveAmplitude: 22,
      waveSpeed: 1.5,
      showAxisLabels: false,
    });
  });
});
