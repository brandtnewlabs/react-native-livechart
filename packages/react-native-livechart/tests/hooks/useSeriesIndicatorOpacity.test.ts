import { seriesIndicatorOpacityTarget } from "../../src/hooks/useSeriesIndicatorOpacity";

describe("seriesIndicatorOpacityTarget", () => {
  it("hides dots and pulses while plotted data is dimmed", () => {
    expect(seriesIndicatorOpacityTarget(0)).toBe(0);
    expect(seriesIndicatorOpacityTarget(0.5)).toBe(0);
    expect(seriesIndicatorOpacityTarget(0.998)).toBe(0);
  });

  it("restores indicators only once plotted data is fully opaque", () => {
    expect(seriesIndicatorOpacityTarget(0.999)).toBe(1);
    expect(seriesIndicatorOpacityTarget(1)).toBe(1);
  });
});
