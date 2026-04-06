import {
  resolveBadge,
  resolveFontConfig,
  resolveGradient,
  resolveYAxis,
  resolvePulse,
  resolveReferenceLineConfig,
  resolveScrub,
  resolveXAxis,
  resolveValueLine,
} from "./resolveConfig";

// ─── resolveValueLine ─────────────────────────────────────────────────────────

describe("resolveValueLine", () => {
  it("returns null for undefined", () => {
    expect(resolveValueLine(undefined)).toBeNull();
  });

  it("returns null for false", () => {
    expect(resolveValueLine(false)).toBeNull();
  });

  it("returns defaults for true", () => {
    expect(resolveValueLine(true)).toEqual({
      strokeWidth: 1,
      intervals: [4, 4],
      color: undefined,
    });
  });

  it("merges partial config with defaults", () => {
    expect(resolveValueLine({ strokeWidth: 2 })).toEqual({
      strokeWidth: 2,
      intervals: [4, 4],
      color: undefined,
    });
  });

  it("accepts all fields", () => {
    expect(
      resolveValueLine({ strokeWidth: 2, intervals: [6, 3], color: "#f00" }),
    ).toEqual({ strokeWidth: 2, intervals: [6, 3], color: "#f00" });
  });
});

// ─── resolveBadge ─────────────────────────────────────────────────────────────

describe("resolveBadge", () => {
  it("returns null for undefined", () => {
    expect(resolveBadge(undefined)).toBeNull();
  });

  it("returns null for false", () => {
    expect(resolveBadge(false)).toBeNull();
  });

  it("returns defaults for true", () => {
    expect(resolveBadge(true)).toEqual({
      variant: "default",
      tail: true,
      position: "right",
      background: undefined,
    });
  });

  it("merges partial config with defaults", () => {
    expect(resolveBadge({ variant: "minimal" })).toEqual({
      variant: "minimal",
      tail: true,
      position: "right",
      background: undefined,
    });
  });

  it("accepts all fields", () => {
    expect(
      resolveBadge({
        variant: "minimal",
        tail: false,
        position: "left",
        background: "#f00",
      }),
    ).toEqual({
      variant: "minimal",
      tail: false,
      position: "left",
      background: "#f00",
    });
  });
});

// ─── resolveYAxis ──────────────────────────────────────────────────────────────

describe("resolveYAxis", () => {
  it("returns null for undefined", () => {
    expect(resolveYAxis(undefined)).toBeNull();
  });

  it("returns null for false", () => {
    expect(resolveYAxis(false)).toBeNull();
  });

  it("returns defaults for true", () => {
    expect(resolveYAxis(true)).toEqual({ minGap: 36 });
  });

  it("merges partial config with defaults", () => {
    expect(resolveYAxis({ minGap: 48 })).toEqual({ minGap: 48 });
  });
});

// ─── resolveScrub ─────────────────────────────────────────────────────────────

describe("resolveScrub", () => {
  it("returns null for undefined", () => {
    expect(resolveScrub(undefined)).toBeNull();
  });

  it("returns null for false", () => {
    expect(resolveScrub(false)).toBeNull();
  });

  it("returns defaults for true", () => {
    expect(resolveScrub(true)).toEqual({ tooltip: true });
  });

  it("merges partial config with defaults", () => {
    expect(resolveScrub({ tooltip: false })).toEqual({ tooltip: false });
  });
});

// ─── resolveFontConfig ────────────────────────────────────────────────────────

describe("resolveFontConfig", () => {
  const defaultFamily = "monospace";
  const defaultSize = 11;

  it("returns platform defaults when config is undefined", () => {
    expect(resolveFontConfig(undefined, defaultFamily, defaultSize)).toEqual({
      fontFamily: "monospace",
      fontSize: 11,
      fontWeight: "500",
    });
  });

  it("applies custom fontFamily", () => {
    expect(
      resolveFontConfig({ fontFamily: "Courier" }, defaultFamily, defaultSize),
    ).toEqual({ fontFamily: "Courier", fontSize: 11, fontWeight: "500" });
  });

  it("applies custom fontSize", () => {
    expect(
      resolveFontConfig({ fontSize: 14 }, defaultFamily, defaultSize),
    ).toEqual({ fontFamily: "monospace", fontSize: 14, fontWeight: "500" });
  });

  it("applies custom fontWeight", () => {
    expect(
      resolveFontConfig({ fontWeight: "700" }, defaultFamily, defaultSize),
    ).toEqual({ fontFamily: "monospace", fontSize: 11, fontWeight: "700" });
  });

  it("accepts all fields", () => {
    expect(
      resolveFontConfig(
        { fontFamily: "Courier", fontSize: 13, fontWeight: "bold" },
        defaultFamily,
        defaultSize,
      ),
    ).toEqual({ fontFamily: "Courier", fontSize: 13, fontWeight: "bold" });
  });
});

// ─── resolveReferenceLineConfig ───────────────────────────────────────────────

describe("resolveReferenceLineConfig", () => {
  it("returns null for undefined", () => {
    expect(resolveReferenceLineConfig(undefined)).toBeNull();
  });

  it("returns defaults when only value is provided", () => {
    expect(resolveReferenceLineConfig({ value: 50 })).toEqual({
      strokeWidth: 1,
      intervals: [4, 4],
      color: undefined,
    });
  });

  it("applies custom strokeWidth", () => {
    expect(resolveReferenceLineConfig({ value: 50, strokeWidth: 2 })).toEqual({
      strokeWidth: 2,
      intervals: [4, 4],
      color: undefined,
    });
  });

  it("applies custom intervals", () => {
    expect(
      resolveReferenceLineConfig({ value: 50, intervals: [8, 4] }),
    ).toEqual({ strokeWidth: 1, intervals: [8, 4], color: undefined });
  });

  it("applies custom color", () => {
    expect(resolveReferenceLineConfig({ value: 50, color: "#ff0000" })).toEqual(
      { strokeWidth: 1, intervals: [4, 4], color: "#ff0000" },
    );
  });
});

// ─── resolveGradient ──────────────────────────────────────────────────────────

describe("resolveGradient", () => {
  it("returns null for undefined", () => {
    expect(resolveGradient(undefined)).toBeNull();
  });

  it("returns null for false", () => {
    expect(resolveGradient(false)).toBeNull();
  });

  it("returns defaults for true (both opacities undefined = use palette)", () => {
    expect(resolveGradient(true)).toEqual({
      topOpacity: undefined,
      bottomOpacity: undefined,
    });
  });

  it("merges custom topOpacity", () => {
    expect(resolveGradient({ topOpacity: 0.25 })).toEqual({
      topOpacity: 0.25,
      bottomOpacity: undefined,
    });
  });

  it("accepts both opacities", () => {
    expect(resolveGradient({ topOpacity: 0.3, bottomOpacity: 0.05 })).toEqual({
      topOpacity: 0.3,
      bottomOpacity: 0.05,
    });
  });
});

// ─── resolvePulse ─────────────────────────────────────────────────────────────

describe("resolvePulse", () => {
  it("returns null for undefined", () => {
    expect(resolvePulse(undefined)).toBeNull();
  });

  it("returns null for false", () => {
    expect(resolvePulse(false)).toBeNull();
  });

  it("returns defaults for true", () => {
    expect(resolvePulse(true)).toEqual({
      interval: 1500,
      duration: 900,
      maxRadius: 21,
      opacity: 0.35,
      strokeWidth: 1.5,
    });
  });

  it("merges partial config with defaults", () => {
    expect(resolvePulse({ interval: 2000 })).toEqual({
      interval: 2000,
      duration: 900,
      maxRadius: 21,
      opacity: 0.35,
      strokeWidth: 1.5,
    });
  });

  it("accepts all fields", () => {
    expect(
      resolvePulse({
        interval: 1000,
        duration: 600,
        maxRadius: 30,
        opacity: 0.5,
        strokeWidth: 2,
      }),
    ).toEqual({
      interval: 1000,
      duration: 600,
      maxRadius: 30,
      opacity: 0.5,
      strokeWidth: 2,
    });
  });
});

// ─── resolveXAxis ──────────────────────────────────────────────────────────

describe("resolveXAxis", () => {
  it("returns defaults for undefined (time axis is on by default)", () => {
    expect(resolveXAxis(undefined)).toEqual({ minGap: 60 });
  });

  it("returns null for false", () => {
    expect(resolveXAxis(false)).toBeNull();
  });

  it("returns defaults for true", () => {
    expect(resolveXAxis(true)).toEqual({ minGap: 60 });
  });

  it("merges custom minGap", () => {
    expect(resolveXAxis({ minGap: 80 })).toEqual({ minGap: 80 });
  });
});
