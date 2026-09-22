import {
  DEFAULT_RENDERER_PROFILE_ID,
  LIVE_RENDERER_PROFILES,
  resolveLiveRendererProfile,
} from "./liveRendererProfile";
import { advanceTimestampByPixel } from "../packages/react-native-livechart/src/core/liveChartEngineTick";

const IDLE_SAMPLE_FPS = 120;
const IDLE_SAMPLE_SECONDS = 60;

function estimateIdleTimestampPublicationsPerSecond(
  windowSeconds: number,
  width: number,
) {
  let timestamp = 1000;
  let publications = 0;
  for (let frame = 1; frame <= IDLE_SAMPLE_FPS * IDLE_SAMPLE_SECONDS; frame++) {
    const next = advanceTimestampByPixel(
      timestamp,
      1000 + frame / IDLE_SAMPLE_FPS,
      windowSeconds / width,
    );
    if (next !== timestamp) publications++;
    timestamp = next;
  }
  return Math.round(publications / IDLE_SAMPLE_SECONDS);
}

describe("live renderer profile matrix", () => {
  it("has unique ids and a resolvable default", () => {
    const ids = LIVE_RENDERER_PROFILES.map((profile) => profile.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_RENDERER_PROFILE_ID);
  });

  it("merges each run with the canonical defaults", () => {
    for (const profile of LIVE_RENDERER_PROFILES) {
      expect(profile.chartHeight).toBeGreaterThan(0);
      expect(profile.chartWidth).toBeGreaterThan(0);
      expect(profile.historySpanSeconds).toBeGreaterThan(0);
      expect(profile.lineWidth).toBeGreaterThan(0);
      expect(profile.maxPoints).toBeGreaterThan(0);
      expect(profile.timeWindowSeconds).toBeGreaterThan(0);
      expect(profile.tradesPerSecond).toBeGreaterThan(0);
    }
  });

  it("matches idle publication estimates to the pixel-aware timestamp gate", () => {
    const idleProfiles = LIVE_RENDERER_PROFILES.filter((profile) =>
      profile.id.startsWith("idle-publish-"),
    );
    expect(idleProfiles).toHaveLength(3);
    expect(idleProfiles.map((profile) => profile.baselinePublishedFps)).toEqual(
      [120, 120, 120],
    );
    for (const profile of idleProfiles) {
      expect(profile.optimizedPublishedFps).toBe(
        estimateIdleTimestampPublicationsPerSecond(
          profile.timeWindowSeconds,
          profile.chartWidth,
        ),
      );
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

  it("keeps the original static/live environment variable as an override", () => {
    expect(
      resolveLiveRendererProfile("live-linear-sharp", "static"),
    ).toMatchObject({ id: "live-linear-sharp", mode: "static" });
  });
});
