import { resolveCrosshairVisibleOpacity } from "../../src/hooks/useCrosshairVisibleOpacity";

describe("resolveCrosshairVisibleOpacity", () => {
  it("stays visible at the exact live edge when fade is disabled", () => {
    expect(resolveCrosshairVisibleOpacity(0, true, false)).toBe(1);
  });

  it("stays hidden when scrub is inactive", () => {
    expect(resolveCrosshairVisibleOpacity(0, false, false)).toBe(0);
  });

  it("preserves edge opacity when fade is enabled", () => {
    expect(resolveCrosshairVisibleOpacity(0.25, true, true)).toBe(0.25);
  });
});
