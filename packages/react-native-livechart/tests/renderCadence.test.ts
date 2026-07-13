import { MS_PER_FRAME_60FPS } from "../src/constants";
import {
  FIXED_30FPS_INTERVAL_MS,
  renderCadenceIntervalMs,
  resolveRenderCadenceMode,
} from "../src/core/renderCadence";

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
});
