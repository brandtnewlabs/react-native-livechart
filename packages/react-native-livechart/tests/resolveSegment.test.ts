import {
  resolveSegment,
  type SegmentColorDefaults,
} from "../src/core/resolveSegment";

const DEFAULTS: SegmentColorDefaults = {
  muted: "#9aa0a6",
  divider: "#5b5b5b",
  label: "#cccccc",
};

describe("resolveSegment", () => {
  it("falls back to the palette defaults for a bare segment", () => {
    const r = resolveSegment({}, DEFAULTS);
    expect(r.recolorLine).toBe(true);
    expect(r.mutedColor).toBe(DEFAULTS.muted);
    expect(r.mutedColors).toBeUndefined();
    expect(r.active).toBe(false);
    expect(r.divider).toBe(false);
    expect(r.dividerColor).toBe(DEFAULTS.divider);
    expect(r.labelColor).toBe(DEFAULTS.label);
    expect(r.labelPosition).toBe("left");
  });

  it("respects explicit overrides", () => {
    const r = resolveSegment(
      {
        from: 100,
        to: 200,
        recolorLine: false,
        mutedColor: "#333",
        active: true,
        divider: true,
        dividerColor: "#444",
        label: "After hours",
        labelPosition: "right",
      },
      DEFAULTS,
    );
    expect(r.from).toBe(100);
    expect(r.to).toBe(200);
    expect(r.recolorLine).toBe(false);
    expect(r.mutedColor).toBe("#333");
    expect(r.active).toBe(true);
    expect(r.divider).toBe(true);
    expect(r.dividerColor).toBe("#444");
    expect(r.label).toBe("After hours");
    // The label color always comes from the palette (no per-segment override).
    expect(r.labelColor).toBe(DEFAULTS.label);
    expect(r.labelPosition).toBe("right");
  });

  it("keeps a ≥2 mutedColors gradient and drops a too-short one", () => {
    expect(
      resolveSegment({ mutedColors: ["#a", "#b"] }, DEFAULTS).mutedColors,
    ).toEqual(["#a", "#b"]);
    expect(
      resolveSegment({ mutedColors: ["#a"] }, DEFAULTS).mutedColors,
    ).toBeUndefined();
  });
});
