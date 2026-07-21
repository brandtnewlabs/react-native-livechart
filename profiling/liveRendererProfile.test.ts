import {
  DEFAULT_RENDERER_PROFILE_ID,
  LIVE_RENDERER_PROFILES,
  resolveLiveRendererProfile,
} from "./liveRendererProfile";

describe("live renderer profile matrix", () => {
  it("has unique ids and a resolvable default", () => {
    const ids = LIVE_RENDERER_PROFILES.map((profile) => profile.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_RENDERER_PROFILE_ID);
  });

  it("merges each run with the canonical defaults", () => {
    for (const profile of LIVE_RENDERER_PROFILES) {
      expect(profile.chartHeight).toBeGreaterThan(0);
      expect(profile.historySpanSeconds).toBeGreaterThan(0);
      expect(profile.lineWidth).toBeGreaterThan(0);
      expect(profile.maxPoints).toBeGreaterThan(0);
      expect(profile.timeWindowSeconds).toBeGreaterThan(0);
      expect(profile.tradesPerSecond).toBeGreaterThan(0);
    }
  });

  it("selects a named run and falls back for an unknown id", () => {
    expect(resolveLiveRendererProfile("live-linear-sharp")).toMatchObject({
      curve: "linear",
      join: "miter",
      cap: "butt",
    });
    expect(resolveLiveRendererProfile("not-a-run").id).toBe(
      DEFAULT_RENDERER_PROFILE_ID,
    );
  });

  it("selects fixed and adaptive cadence runs", () => {
    expect(resolveLiveRendererProfile("live-monotone-round-30fps").cadence).toBe(
      "fixed30",
    );
    expect(
      resolveLiveRendererProfile("live-monotone-round-adaptive").cadence,
    ).toBe("adaptive");
    expect(
      LIVE_RENDERER_PROFILES.filter(
        (profile) => profile.cadence === "adaptive",
      ).map((profile) => profile.timeWindowSeconds),
    ).toEqual([10, 20, 30]);
    for (const adaptive of LIVE_RENDERER_PROFILES.filter(
      (profile) => profile.cadence === "adaptive",
    )) {
      expect(
        LIVE_RENDERER_PROFILES.some(
          (profile) =>
            profile.cadence === "display" &&
            profile.timeWindowSeconds === adaptive.timeWindowSeconds,
        ),
      ).toBe(true);
    }
  });

  it("keeps the original static/live environment variable as an override", () => {
    expect(
      resolveLiveRendererProfile("live-linear-sharp", "static"),
    ).toMatchObject({ id: "live-linear-sharp", mode: "static" });
  });
});
