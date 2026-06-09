import { resolveSegment } from "../src/core/resolveSegment";

const ACCENT = "#3323E6";

describe("resolveSegment", () => {
  it("fills defaults from the accent color for a bare segment", () => {
    const r = resolveSegment({}, ACCENT);
    expect(r.color).toBe(ACCENT);
    expect(r.recolorLine).toBe(true);
    expect(r.lineColor).toBe(ACCENT);
    expect(r.lineColors).toBeUndefined();
    expect(r.active).toBe(false);
    expect(r.divider).toBe(false);
    expect(r.dividerColor).toBe(ACCENT);
    expect(r.labelPosition).toBe("left");
  });

  it("derives sub-colors from an explicit base color", () => {
    const r = resolveSegment({ color: "#ff8800" }, ACCENT);
    expect(r.color).toBe("#ff8800");
    expect(r.lineColor).toBe("#ff8800");
    expect(r.dividerColor).toBe("#ff8800");
  });

  it("respects explicit overrides", () => {
    const r = resolveSegment(
      {
        from: 100,
        to: 200,
        color: "#111",
        recolorLine: false,
        lineColor: "#333",
        active: true,
        divider: true,
        dividerColor: "#444",
        label: "After hours",
        labelPosition: "right",
      },
      ACCENT,
    );
    expect(r.from).toBe(100);
    expect(r.to).toBe(200);
    expect(r.color).toBe("#111");
    expect(r.recolorLine).toBe(false);
    expect(r.lineColor).toBe("#333");
    expect(r.active).toBe(true);
    expect(r.divider).toBe(true);
    expect(r.dividerColor).toBe("#444");
    expect(r.label).toBe("After hours");
    expect(r.labelPosition).toBe("right");
  });

  it("keeps a ≥2 lineColors gradient and drops a too-short one", () => {
    expect(resolveSegment({ lineColors: ["#a", "#b"] }, ACCENT).lineColors).toEqual([
      "#a",
      "#b",
    ]);
    expect(resolveSegment({ lineColors: ["#a"] }, ACCENT).lineColors).toBeUndefined();
  });
});
