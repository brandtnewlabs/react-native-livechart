import { act, renderHook } from "@testing-library/react-native";

import {
  PHANTOM_TIMEFRAME_SECONDS,
  alignPhantomTimeframeMorph,
  buildPhantomTimeframeData,
  formatPhantomMarketOutcome,
  interpolatePhantomTimeframeMorph,
  phantomPriceAt,
  usePhantomMarketSimulation,
} from "./usePhantomMarketSimulation";

describe("Phantom market data", () => {
  it("builds coherent ranges that end at the same current value", () => {
    const now = Date.parse("2026-08-13T16:38:31.250Z") / 1000;
    const live = buildPhantomTimeframeData("live", now);
    const day = buildPhantomTimeframeData("1d", now);

    expect(live.at(-1)?.value).toBeCloseTo(phantomPriceAt(now), 10);
    expect(day.at(-1)?.value).toBeCloseTo(phantomPriceAt(now), 10);
    expect(live.at(-1)?.time).toBe(now);
    expect(day.at(-1)?.time).toBe(now);
    expect(live.at(-1)!.time - live[0].time).toBe(
      PHANTOM_TIMEFRAME_SECONDS.live,
    );
    expect(day.at(-1)!.time - day[0].time).toBe(
      PHANTOM_TIMEFRAME_SECONDS["1d"],
    );
  });

  it("produces a continuous, non-repeating live market path", () => {
    const now = Date.parse("2026-08-13T16:38:31.250Z") / 1000;
    const values = Array.from({ length: 301 }, (_, index) =>
      phantomPriceAt(now - 30 + index / 10),
    );
    const deltas = values.slice(1).map((value, index) => value - values[index]);
    const range = Math.max(...values) - Math.min(...values);
    const maxStep = Math.max(...deltas.map(Math.abs));
    const uniqueRoundedSteps = new Set(deltas.map((delta) => delta.toFixed(6)))
      .size;
    const directionChanges = deltas
      .slice(1)
      .filter(
        (delta, index) => Math.sign(delta) !== Math.sign(deltas[index]),
      ).length;

    expect(phantomPriceAt(now)).toBe(phantomPriceAt(now));
    expect(range).toBeGreaterThan(0.003);
    expect(range).toBeLessThan(0.15);
    expect(maxStep).toBeLessThan(0.008);
    expect(uniqueRoundedSteps).toBeGreaterThan(40);
    expect(directionChanges).toBeGreaterThan(8);
  });

  it("anti-aliases the weekly range while preserving its live endpoint", () => {
    const now = Date.parse("2026-08-13T16:38:31.250Z") / 1000;
    const week = buildPhantomTimeframeData("1w", now);
    const rawValues = week.map(({ time }) => phantomPriceAt(time));
    const filteredValues = week.map(({ value }) => value);
    const roughness = (values: number[]) =>
      values
        .slice(1, -1)
        .reduce(
          (total, value, index) =>
            total + Math.abs(values[index] - 2 * value + values[index + 2]),
          0,
        );

    expect(roughness(filteredValues)).toBeLessThan(roughness(rawValues) * 0.25);
    expect(filteredValues.at(-1)).toBeCloseTo(phantomPriceAt(now), 10);
  });

  it("normalizes and interpolates differently-sized timeframe shapes", () => {
    const previous = [
      { time: 0, value: 10 },
      { time: 1, value: 20 },
      { time: 2, value: 10 },
    ];
    const next = [
      { time: 100, value: 30 },
      { time: 101, value: 10 },
      { time: 102, value: 20 },
      { time: 103, value: 10 },
      { time: 104, value: 30 },
    ];
    const aligned = alignPhantomTimeframeMorph(previous, next);
    const midpoint = interpolatePhantomTimeframeMorph(
      aligned.from,
      aligned.to,
      0.5,
    );

    expect(aligned.from).toHaveLength(next.length);
    expect(aligned.from.map(({ time }) => time)).toEqual(
      next.map(({ time }) => time),
    );
    expect(midpoint[0].value).toBe(20);
    expect(midpoint[1].value).toBe(12.5);
    expect(midpoint[2].value).toBe(20);
    expect(midpoint.at(-1)?.value).toBe(30);
  });

  it("formats above, below, and display-rounded at-target outcomes", () => {
    expect(formatPhantomMarketOutcome(76.05, 75.95)).toEqual({
      side: "up",
      text: "+0.13% above target",
    });
    expect(formatPhantomMarketOutcome(75.85, 75.95)).toEqual({
      side: "down",
      text: "−0.13% below target",
    });
    expect(formatPhantomMarketOutcome(75.9501, 75.95)).toEqual({
      side: "at",
      text: "0.00% at target",
    });
  });
});

describe("usePhantomMarketSimulation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-13T16:38:31.250Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("retains and dims the old range for exactly one second", async () => {
    const { result, unmount } = await renderHook(() =>
      usePhantomMarketSimulation({ fadeInDurationMs: 0, morphDurationMs: 0 }),
    );
    const initialData = result.current.displayData.value;

    await act(() => result.current.selectTimeframe("15m"));
    expect(result.current.selectedTimeframe).toBe("15m");
    expect(result.current.committedTimeframe).toBe("live");
    expect(result.current.seriesOpacity.value).toBe(0.5);
    expect(result.current.displayData.value).toBe(initialData);

    await act(() => jest.advanceTimersByTime(999));
    expect(result.current.committedTimeframe).toBe("live");
    const loadingData = result.current.displayData.value;
    expect(loadingData.at(-1)!.time - loadingData[0].time).toBeLessThanOrEqual(
      34.2,
    );
    expect(loadingData.at(-1)!.time).toBeGreaterThan(initialData.at(-1)!.time);

    await act(() => jest.advanceTimersByTime(1));
    expect(result.current.committedTimeframe).toBe("15m");
    expect(result.current.displayData.value).not.toBe(initialData);
    expect(result.current.dataSnapVersion).toBe(1);
    expect(result.current.seriesOpacity.value).toBe(1);
    await unmount();
  });

  it("discards stale timeframe requests after rapid taps", async () => {
    const { result, unmount } = await renderHook(() =>
      usePhantomMarketSimulation({ fadeInDurationMs: 0, morphDurationMs: 0 }),
    );

    await act(() => result.current.selectTimeframe("15m"));
    await act(() => jest.advanceTimersByTime(500));
    await act(() => result.current.selectTimeframe("1d"));
    await act(() => jest.advanceTimersByTime(999));
    expect(result.current.committedTimeframe).toBe("live");

    await act(() => jest.advanceTimersByTime(1));
    expect(result.current.selectedTimeframe).toBe("1d");
    expect(result.current.committedTimeframe).toBe("1d");
    expect(result.current.displayData.value).toHaveLength(721);
    await unmount();
  });

  it("writes intermediate dataset shapes before settling on the new range", async () => {
    const { result, unmount } = await renderHook(() =>
      usePhantomMarketSimulation({ fadeInDurationMs: 0, morphDurationMs: 500 }),
    );

    await act(() => result.current.selectTimeframe("1d"));
    await act(() => jest.advanceTimersByTime(1016));
    const from = result.current.displayData.value;
    const replacement = buildPhantomTimeframeData(
      "1d",
      Date.parse("2026-08-13T16:38:32.250Z") / 1000,
    );
    const movingIndex = from.reduce(
      (bestIndex, point, index) =>
        Math.abs(point.value - replacement[index].value) >
        Math.abs(from[bestIndex].value - replacement[bestIndex].value)
          ? index
          : bestIndex,
      0,
    );

    await act(() => jest.advanceTimersByTime(266));
    const midway = result.current.displayData.value;
    const lower = Math.min(
      from[movingIndex].value,
      replacement[movingIndex].value,
    );
    const upper = Math.max(
      from[movingIndex].value,
      replacement[movingIndex].value,
    );
    expect(midway[movingIndex].value).toBeGreaterThan(lower);
    expect(midway[movingIndex].value).toBeLessThan(upper);

    await act(() => jest.advanceTimersByTime(300));
    expect(result.current.displayData.value).toEqual(replacement);
    await unmount();
  });

  it("cancels a pending load when the rendered timeframe is reselected", async () => {
    const { result, unmount } = await renderHook(() =>
      usePhantomMarketSimulation({ fadeInDurationMs: 0, morphDurationMs: 0 }),
    );
    const initialData = result.current.displayData.value;

    await act(() => result.current.selectTimeframe("1w"));
    await act(() => jest.advanceTimersByTime(400));
    await act(() => result.current.selectTimeframe("live"));

    expect(result.current.selectedTimeframe).toBe("live");
    expect(result.current.committedTimeframe).toBe("live");
    expect(result.current.seriesOpacity.value).toBe(1);

    await act(() => jest.advanceTimersByTime(2000));
    expect(result.current.committedTimeframe).toBe("live");
    const resumedData = result.current.displayData.value;
    expect(resumedData.at(-1)!.time - resumedData[0].time).toBeLessThanOrEqual(
      34.2,
    );
    expect(resumedData.at(-1)!.time).toBeGreaterThan(initialData.at(-1)!.time);
    await unmount();
  });

  it("caps Live history and resumes appending after returning from history", async () => {
    const { result, unmount } = await renderHook(() =>
      usePhantomMarketSimulation({ fadeInDurationMs: 0, morphDurationMs: 0 }),
    );

    await act(() => jest.advanceTimersByTime(5000));
    const livePoints = result.current.displayData.value;
    expect(livePoints.at(-1)!.time - livePoints[0].time).toBeLessThanOrEqual(
      34.2,
    );

    await act(() => result.current.selectTimeframe("1h"));
    await act(() => jest.advanceTimersByTime(1000));
    expect(result.current.committedTimeframe).toBe("1h");

    await act(() => result.current.selectTimeframe("live"));
    await act(() => jest.advanceTimersByTime(1000));
    const restoredLength = result.current.displayData.value.length;
    await act(() => jest.advanceTimersByTime(300));
    expect(result.current.displayData.value.length).toBeGreaterThan(
      restoredLength,
    );
    await unmount();
  });
});
