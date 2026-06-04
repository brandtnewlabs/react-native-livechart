import {
  createTradeStreamState,
  LABEL_LIFETIME,
  MAX_LABELS,
  projectLabels,
  tickTradeStream,
  type TradeStreamState,
} from "../../src/draw/trade";
import type { TradeEvent } from "../../src/types";

function makeTrades(count: number, baseTime = 100): TradeEvent[] {
  const trades: TradeEvent[] = [];
  for (let i = 0; i < count; i++) {
    trades.push({
      time: baseTime + i,
      price: 50 + i * 0.1,
      size: 1 + i * 0.5,
      side: i % 2 === 0 ? "buy" : "sell",
    });
  }
  return trades;
}

describe("tickTradeStream", () => {
  const chartTop = 12;
  const chartBottom = 280;

  it("starts with empty state", () => {
    const state = createTradeStreamState();
    expect(state.labels).toHaveLength(0);
    expect(state.spawnTimer).toBe(0);
  });

  it("spawns labels when trades arrive", () => {
    const state = createTradeStreamState();
    const trades = makeTrades(5);
    tickTradeStream(state, trades, 50, chartTop, chartBottom);
    expect(state.labels.length).toBeGreaterThan(0);
    expect(state.labels[0].y).toBeGreaterThan(chartBottom - 20);
    expect(state.labels[0].text).toMatch(/[+-] \$/);
  });

  it("prefixes label with symbol when present", () => {
    const state = createTradeStreamState();
    const trades: TradeEvent[] = [
      {
        time: 100,
        price: 10,
        size: 2,
        side: "buy",
        symbol: "ABC",
      },
    ];
    tickTradeStream(state, trades, 50, chartTop, chartBottom);
    expect(state.labels.some((l) => l.text.startsWith("ABC "))).toBe(true);
  });

  it("does not spawn when no new trades", () => {
    const state = createTradeStreamState();
    const trades = makeTrades(3);
    tickTradeStream(state, trades, 50, chartTop, chartBottom);
    const countAfterFirst = state.labels.length;

    // Same trades again — no new count
    tickTradeStream(state, trades, 50, chartTop, chartBottom);
    expect(state.labels.length).toBe(countAfterFirst);
  });

  it("moves labels upward over time", () => {
    const state = createTradeStreamState();
    const trades = makeTrades(5);
    tickTradeStream(state, trades, 50, chartTop, chartBottom);
    const initialY = state.labels[0].y;

    tickTradeStream(state, trades, 200, chartTop, chartBottom);
    expect(state.labels[0].y).toBeLessThan(initialY);
  });

  it("expires labels when life reaches 0", () => {
    const state = createTradeStreamState();
    const trades = makeTrades(3);
    tickTradeStream(state, trades, 50, chartTop, chartBottom);
    expect(state.labels.length).toBeGreaterThan(0);

    // Simulate enough time for labels to expire (> LABEL_LIFETIME seconds)
    tickTradeStream(
      state,
      trades,
      (LABEL_LIFETIME + 1) * 1000,
      chartTop,
      chartBottom,
    );
    expect(state.labels.length).toBe(0);
  });

  it("caps at MAX_LABELS", () => {
    const state = createTradeStreamState();
    // Feed lots of trades in small increments to force many spawns
    for (let batch = 0; batch < 200; batch++) {
      const trades = makeTrades(batch + 5, 100 + batch * 10);
      tickTradeStream(state, trades, 50, chartTop, chartBottom);
    }
    expect(state.labels.length).toBeLessThanOrEqual(MAX_LABELS);
  });

  it("skips spawn when overlap within MIN_LABEL_GAP", () => {
    const state = createTradeStreamState();
    const trades = makeTrades(10, 100);
    tickTradeStream(state, trades, 50, chartTop, chartBottom);
    const firstCount = state.labels.length;
    // New trades with later times but only 5ms elapsed — label still near bottom
    const trades2 = [...trades, ...makeTrades(3, 200)];
    tickTradeStream(state, trades2, 5, chartTop, chartBottom);
    // Should not spawn because existing label is still within MIN_LABEL_GAP of spawn point
    expect(state.labels.length).toBe(firstCount);
  });

  it("continues spawning when array is capped but new trades arrive", () => {
    const state = createTradeStreamState();
    // Initial batch
    const trades1 = makeTrades(50, 100);
    tickTradeStream(state, trades1, 50, chartTop, chartBottom);
    const count1 = state.labels.length;
    expect(count1).toBeGreaterThan(0);

    // Move existing labels away from bottom so overlap check passes
    tickTradeStream(state, trades1, 500, chartTop, chartBottom);

    // New batch with same length but later times (simulates sim trimming to 50)
    const trades2 = makeTrades(50, 200);
    tickTradeStream(state, trades2, 50, chartTop, chartBottom);
    expect(state.labels.length).toBeGreaterThan(count1);
  });

  it("handles zero range gracefully", () => {
    const state = createTradeStreamState();
    tickTradeStream(state, makeTrades(3), 50, 100, 100);
    expect(state.labels.length).toBe(0);
  });

  it("formats small sizes with two decimals", () => {
    const state = createTradeStreamState();
    const trades: TradeEvent[] = [
      { time: 100, price: 50, size: 0.25, side: "buy" },
      { time: 101, price: 51, size: 0.5, side: "sell" },
    ];
    tickTradeStream(state, trades, 50, chartTop, chartBottom);
    if (state.labels.length > 0) {
      expect(state.labels[0].text).toMatch(/\$0\.\d{2}/);
    }
  });
});

describe("projectLabels", () => {
  it("returns empty for empty state", () => {
    const state = createTradeStreamState();
    expect(projectLabels(state, 12, 268)).toEqual([]);
  });

  it("projects labels with alpha from intensity and fade", () => {
    const state: TradeStreamState = {
      labels: [
        {
          y: 200,
          text: "+ $5",
          green: true,
          life: 5,
          maxLife: LABEL_LIFETIME,
          intensity: 0.8,
        },
        {
          y: 50,
          text: "+ $2",
          green: false,
          life: 1,
          maxLife: LABEL_LIFETIME,
          intensity: 0.6,
        },
      ],
      spawnTimer: 0,
      smoothSpeed: 60,
      lastSeenTime: 5,
    };
    const markers = projectLabels(state, 12, 268);
    expect(markers).toHaveLength(2);
    expect(markers[0].green).toBe(true);
    expect(markers[0].label).toBe("+ $5");
    expect(markers[0].alpha).toBeGreaterThan(0);
    expect(markers[0].alpha).toBeLessThanOrEqual(1);
    expect(markers[1].green).toBe(false);
  });

  it("fades labels near the top", () => {
    const state: TradeStreamState = {
      labels: [
        {
          y: 15,
          text: "+ $1",
          green: true,
          life: 3,
          maxLife: LABEL_LIFETIME,
          intensity: 1,
        },
        {
          y: 250,
          text: "+ $1",
          green: true,
          life: 3,
          maxLife: LABEL_LIFETIME,
          intensity: 1,
        },
      ],
      spawnTimer: 0,
      smoothSpeed: 60,
      lastSeenTime: 5,
    };
    const markers = projectLabels(state, 12, 268);
    // Label near top should have lower alpha than label near bottom
    expect(markers[0].alpha).toBeLessThan(markers[1].alpha);
  });
});
