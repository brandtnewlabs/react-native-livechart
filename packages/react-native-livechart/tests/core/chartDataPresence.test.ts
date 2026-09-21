import {
  hasCandleChartData,
  hasLineChartData,
  hasMultiSeriesChartData,
} from "../../src/core/chartDataPresence";
import type { CandlePoint, SeriesConfig } from "../../src/types";

describe("chart data presence", () => {
  it("treats one line point as data and an empty line as empty", () => {
    expect(hasLineChartData([{ time: 1, value: 100 }])).toBe(true);
    expect(hasLineChartData([])).toBe(false);
  });

  it("treats one committed candle as data", () => {
    const candle: CandlePoint = {
      time: 1,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
    };

    expect(hasCandleChartData([candle])).toBe(true);
    expect(hasCandleChartData([])).toBe(false);
    expect(hasCandleChartData(undefined)).toBe(false);
  });

  it("treats one point in any series as multi-series data", () => {
    const series: SeriesConfig[] = [
      { id: "empty", label: "Empty", data: [], value: 0 },
      {
        id: "one",
        label: "One point",
        data: [{ time: 1, value: 100 }],
        value: 100,
      },
    ];

    expect(hasMultiSeriesChartData(series)).toBe(true);
    expect(hasMultiSeriesChartData([{ ...series[0] }])).toBe(false);
    expect(hasMultiSeriesChartData([])).toBe(false);
  });
});
