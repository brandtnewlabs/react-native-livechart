import {
  HISTORY_RANGE_SPAN_SECONDS,
  baseIntervalMsForTps,
  buildSeededHistory,
  generateLiveMidTrade,
  nextJitteredDelayMs,
  pushFifo,
  resolveHistorySpanSeconds,
  resolveSeededHistoryParams,
} from "./chartSimCore";

describe("resolveSeededHistoryParams", () => {
  it("caps count by maxPoints for long spans", () => {
    const p = resolveSeededHistoryParams({ historyRange: "1y" }, 2000);
    expect(p.count).toBeLessThanOrEqual(2000);
    expect(p.count).toBeGreaterThanOrEqual(2);
  });

  it("uses finer spacing for short presets", () => {
    const p = resolveSeededHistoryParams({ historyRange: "1m" }, 2000);
    expect(p.intervalSec).toBeGreaterThan(0);
    expect(p.count).toBeLessThanOrEqual(2000);
  });
});

describe("resolveHistorySpanSeconds", () => {
  it("prefers explicit span over preset", () => {
    expect(resolveHistorySpanSeconds("1m", 120)).toBe(120);
  });

  it("uses preset when span omitted", () => {
    expect(resolveHistorySpanSeconds("1d", undefined)).toBe(
      HISTORY_RANGE_SPAN_SECONDS["1d"],
    );
  });
});

describe("buildSeededHistory", () => {
  it("returns deterministic points with fixed RNG and clock", () => {
    function makeRng(seed: number) {
      let s = seed;
      return () => {
        s = ((s * 9301 + 49297) % 233280) / 233280;
        return Math.max(1e-12, s);
      };
    }
    const now = 1_000_000;
    const a = buildSeededHistory(
      { historyRange: "1h" },
      500,
      100,
      0.003,
      makeRng(0.1),
      now,
    );
    const b = buildSeededHistory(
      { historyRange: "1h" },
      500,
      100,
      0.003,
      makeRng(0.1),
      now,
    );
    expect(a.points.length).toBe(b.points.length);
    expect(a.points.map((p) => p.value)).toEqual(b.points.map((p) => p.value));
  });
});

describe("generateLiveMidTrade", () => {
  it("produces a trade with optional symbol", () => {
    const rng = () => 0.4;
    const t = generateLiveMidTrade(50, 0.01, 1234, rng, "PEPE");
    expect(t.time).toBe(1234);
    expect(t.symbol).toBe("PEPE");
    expect(t.price).toBeGreaterThan(0);
  });
});

describe("nextJitteredDelayMs", () => {
  it("returns baseMs when jitter is 0", () => {
    expect(nextJitteredDelayMs(200, 0, () => 0.5)).toBe(200);
  });

  it("clamps jittered delay", () => {
    const rng = () => 0;
    const d = nextJitteredDelayMs(200, 0.5, rng);
    expect(d).toBeGreaterThanOrEqual(8);
    expect(d).toBeLessThanOrEqual(60_000);
  });
});

describe("baseIntervalMsForTps", () => {
  it("maps 5 TPS to 200ms", () => {
    expect(baseIntervalMsForTps(5)).toBe(200);
  });
});

describe("pushFifo", () => {
  it("drops oldest over max", () => {
    expect(pushFifo([1, 2], 3, 2)).toEqual([2, 3]);
  });
});
