import { resolveSegment } from "../src/core/resolveSegment";

const ACCENT = "#3323E6";

describe("resolveSegment", () => {
  it("fills defaults from the accent color for a bare segment", () => {
    const r = resolveSegment({}, ACCENT);
    expect(r.color).toBe(ACCENT);
    expect(r.opacity).toBe(0.06);
    expect(r.highlightColor).toBe(ACCENT);
    expect(r.highlightOpacity).toBe(0.16);
    expect(r.recolorLine).toBe(true);
    expect(r.lineColor).toBe(ACCENT);
    expect(r.lineColors).toBeUndefined();
    expect(r.active).toBe(false);
    expect(r.divider).toBe(false);
    expect(r.dividerColor).toBe(ACCENT);
    expect(r.labelPosition).toBe("left");
  });

  it("derives sub-colors from an explicit band color", () => {
    const r = resolveSegment({ color: "#ff8800" }, ACCENT);
    expect(r.color).toBe("#ff8800");
    expect(r.highlightColor).toBe("#ff8800");
    expect(r.lineColor).toBe("#ff8800");
    expect(r.dividerColor).toBe("#ff8800");
  });

  it("respects explicit overrides", () => {
    const r = resolveSegment(
      {
        from: 100,
        to: 200,
        color: "#111",
        opacity: 0.2,
        highlightColor: "#222",
        highlightOpacity: 0.5,
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
    expect(r.opacity).toBe(0.2);
    expect(r.highlightColor).toBe("#222");
    expect(r.highlightOpacity).toBe(0.5);
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
