import {
  liveIndicatorScrollOpacity,
  resolveHideLiveOnScrollBack,
} from "../../src/core/liveIndicatorVisibility";

describe("live indicator visibility while time-scrolling", () => {
  const historicalViewEnd = 1_700_000_000;

  it("hides the live dot and value line by default while scrolled back", () => {
    const hide = resolveHideLiveOnScrollBack(true, false);

    expect(hide).toBe(true);
    expect(liveIndicatorScrollOpacity(hide, historicalViewEnd)).toBe(0);
  });

  it("keeps both indicators visible at the live edge", () => {
    const hide = resolveHideLiveOnScrollBack(true, false);

    expect(liveIndicatorScrollOpacity(hide, null)).toBe(1);
  });

  it("honors the explicit hideLiveOnScrollBack opt-out", () => {
    const hide = resolveHideLiveOnScrollBack(
      { hideLiveOnScrollBack: false },
      false,
    );

    expect(hide).toBe(false);
    expect(liveIndicatorScrollOpacity(hide, historicalViewEnd)).toBe(1);
  });

  it("keeps visible-edge indicators visible while scrolled back", () => {
    const hide = resolveHideLiveOnScrollBack(true, true);

    expect(hide).toBe(false);
    expect(liveIndicatorScrollOpacity(hide, historicalViewEnd)).toBe(1);
  });
});
