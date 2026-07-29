import { resolveCrosshairVisibleOpacity } from "../../src/hooks/useCrosshairVisibleOpacity";

describe("resolveCrosshairVisibleOpacity", () => {
  it("stays visible at the exact live edge when fade is disabled", () => {
    expect(resolveCrosshairVisibleOpacity(true, 320, 400, 80, false)).toBe(1);
  });

  it("stays hidden when scrub is inactive", () => {
    expect(resolveCrosshairVisibleOpacity(false, 200, 400, 80, false)).toBe(0);
  });

  it("uses the configured fade distance when fade is enabled", () => {
    expect(resolveCrosshairVisibleOpacity(true, 318, 400, 80, true, 8)).toBe(
      0.25,
    );
  });

  it("uses the backwards-compatible 4 px fade by default", () => {
    expect(resolveCrosshairVisibleOpacity(true, 318, 400, 80, true)).toBe(0.5);
  });

  it("removes the ramp at zero distance", () => {
    expect(resolveCrosshairVisibleOpacity(true, 319, 400, 80, true, 0)).toBe(1);
    expect(resolveCrosshairVisibleOpacity(true, 320, 400, 80, true, 0)).toBe(0);
  });
});
