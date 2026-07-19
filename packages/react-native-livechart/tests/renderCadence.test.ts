import { MS_PER_FRAME_60FPS } from "../src/constants";
import {
  FIXED_30FPS_INTERVAL_MS,
  makeRenderCadenceSchedulerState,
  renderCadenceIntervalMs,
  resolveRenderCadenceMode,
  scheduleRenderCadenceFrame,
  type RenderCadenceMode,
} from "../src/core/renderCadence";

function simulateSecond(
  mode: RenderCadenceMode,
  refreshRate: 60 | 120,
  displayWindowSeconds: number,
) {
  const state = makeRenderCadenceSchedulerState();
  const frameMs = 1000 / refreshRate;
  const publishedElapsed: number[] = [];
  for (let frame = 0; frame < refreshRate; frame += 1) {
    const elapsed = scheduleRenderCadenceFrame(
      state,
      mode,
      frameMs,
      400,
      displayWindowSeconds,
    );
    if (elapsed !== null) publishedElapsed.push(elapsed);
  }
  return { state, publishedElapsed };
}

describe("render cadence profiling", () => {
  it("preserves display cadence by default", () => {
    expect(resolveRenderCadenceMode(undefined)).toBe("display");
    expect(resolveRenderCadenceMode("unknown")).toBe("display");
    expect(renderCadenceIntervalMs("display", 400, 30)).toBe(0);
  });

  it("resolves the fixed and adaptive experiment modes", () => {
    expect(resolveRenderCadenceMode("fixed30")).toBe("fixed30");
    expect(resolveRenderCadenceMode("adaptive")).toBe("adaptive");
    expect(renderCadenceIntervalMs("fixed30", 400, 30)).toBe(
      FIXED_30FPS_INTERVAL_MS,
    );
  });

  it("uses display cadence when a short window moves at least half a pixel", () => {
    expect(renderCadenceIntervalMs("adaptive", 400, 10)).toBe(
      MS_PER_FRAME_60FPS,
    );
  });

  it("caps slow windows at 30 fps", () => {
    expect(renderCadenceIntervalMs("adaptive", 400, 30)).toBe(
      FIXED_30FPS_INTERVAL_MS,
    );
  });

  it("chooses an intermediate interval from visible pixel velocity", () => {
    expect(renderCadenceIntervalMs("adaptive", 400, 20)).toBe(25);
  });

  it("does not delay pre-layout engine settlement", () => {
    expect(renderCadenceIntervalMs("adaptive", 0, 30)).toBe(0);
  });

  it.each([60, 120] as const)(
    "publishes fixed30 exactly 30 times from %d Hz callbacks",
    (refreshRate) => {
      const { state, publishedElapsed } = simulateSecond(
        "fixed30",
        refreshRate,
        30,
      );

      expect(state.publicationCount).toBe(30);
      expect(publishedElapsed).toHaveLength(30);
      expect(
        publishedElapsed.reduce((total, elapsed) => total + elapsed, 0),
      ).toBeCloseTo(1000);
    },
  );

  it.each([60, 120] as const)(
    "preserves distinct adaptive rates from %d Hz callbacks",
    (refreshRate) => {
      expect(simulateSecond("adaptive", refreshRate, 10).state.publicationCount).toBe(
        60,
      );
      expect(simulateSecond("adaptive", refreshRate, 20).state.publicationCount).toBe(
        40,
      );
      expect(simulateSecond("adaptive", refreshRate, 30).state.publicationCount).toBe(
        30,
      );
    },
  );

  it("passes all accumulated engine time through after a dropped frame", () => {
    const state = makeRenderCadenceSchedulerState();
    expect(scheduleRenderCadenceFrame(state, "fixed30", 1000 / 60, 400, 30)).toBeNull();

    const publishedElapsed = scheduleRenderCadenceFrame(
      state,
      "fixed30",
      50,
      400,
      30,
    );

    expect(publishedElapsed).toBeCloseTo(1000 / 60 + 50);
    expect(state.publicationCount).toBe(1);
    expect(state.elapsedSincePublicationMs).toBe(0);
  });

  it("retains elapsed time across cadence changes and resets at display cadence", () => {
    const state = makeRenderCadenceSchedulerState();
    const frameMs = 1000 / 60;

    expect(scheduleRenderCadenceFrame(state, "fixed30", frameMs, 400, 30)).toBeNull();
    expect(
      scheduleRenderCadenceFrame(state, "adaptive", frameMs, 400, 10),
    ).toBeCloseTo(frameMs * 2);
    expect(scheduleRenderCadenceFrame(state, "display", frameMs, 400, 30)).toBe(
      frameMs,
    );
    expect(state).toMatchObject({
      elapsedSincePublicationMs: 0,
      cadenceElapsedMs: 0,
      publicationCount: 2,
    });
  });
});
