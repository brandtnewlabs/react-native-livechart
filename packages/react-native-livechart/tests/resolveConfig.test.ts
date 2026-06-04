import {
  resolveBadge,
  resolveDegen,
  resolveFontConfig,
  resolveGradient,
  resolveGridStyle,
  resolveLeftEdgeFade,
  resolvePulse,
  resolveReferenceLineConfig,
  resolveScrub,
  resolveTradeStream,
  resolveValueLine,
  resolveXAxis,
  resolveYAxis,
} from "../src/core/resolveConfig";

import { FADE_EDGE_WIDTH } from "../src/constants";
import { leftEdgeFadeColorsFromBgRgb } from "../src/theme";

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
    expect(resolveScrub(true)).toEqual({ tooltip: true, dimOpacity: 0.3 });
  });

  it("merges partial config with defaults", () => {
    expect(resolveScrub({ tooltip: false })).toEqual({
      tooltip: false,
      dimOpacity: 0.3,
    });
  });

  it("accepts a custom dimOpacity", () => {
    expect(resolveScrub({ dimOpacity: 0.5 })).toEqual({
      tooltip: true,
      dimOpacity: 0.5,
    });
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

// ─── resolveLeftEdgeFade ───────────────────────────────────────────────────────

describe("resolveLeftEdgeFade", () => {
  it("returns null for undefined", () => {
    expect(resolveLeftEdgeFade(undefined)).toBeNull();
  });

  it("returns null for false", () => {
    expect(resolveLeftEdgeFade(false)).toBeNull();
  });

  it("returns defaults for true", () => {
    expect(resolveLeftEdgeFade(true)).toEqual({
      width: FADE_EDGE_WIDTH,
      startColor: "rgba(0, 0, 0, 1)",
      endColor: "rgba(0, 0, 0, 0)",
    });
  });

  it("merges custom width and colors", () => {
    expect(
      resolveLeftEdgeFade({
        width: 24,
        startColor: "rgba(255, 0, 0, 0.8)",
        endColor: "#00000000",
      }),
    ).toEqual({
      width: 24,
      startColor: "rgba(255, 0, 0, 0.8)",
      endColor: "#00000000",
    });
  });

  it("merges single color override", () => {
    expect(resolveLeftEdgeFade({ startColor: "rgba(0,0,0,0.5)" })).toEqual({
      width: FADE_EDGE_WIDTH,
      startColor: "rgba(0,0,0,0.5)",
      endColor: "rgba(0, 0, 0, 0)",
    });
  });

  it("uses theme background colors when provided", () => {
    const bg = leftEdgeFadeColorsFromBgRgb([255, 128, 64]);
    expect(resolveLeftEdgeFade(true, bg)).toEqual({
      width: FADE_EDGE_WIDTH,
      startColor: "rgba(255, 128, 64, 1)",
      endColor: "rgba(255, 128, 64, 0)",
    });
    expect(resolveLeftEdgeFade({ width: 12 }, bg)).toEqual({
      width: 12,
      startColor: "rgba(255, 128, 64, 1)",
      endColor: "rgba(255, 128, 64, 0)",
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

// ─── resolveDegen ───────────────────────────────────────────────────────────

describe("resolveDegen", () => {
  const DEGEN_PARTICLE_DEFAULTS = {
    drag: 0.95,
    particleSizeMin: 1,
    particleSizeMax: 2.2,
    particleOpacity: 0.55,
    spreadAngle: Math.PI * 1.2,
    positionJitterX: 24,
    positionJitterY: 8,
    speedMin: 60,
    speedMax: 160,
    colors: null,
  };

  it("returns null for undefined and false", () => {
    expect(resolveDegen(undefined)).toBeNull();
    expect(resolveDegen(false)).toBeNull();
  });

  it("returns defaults for true", () => {
    expect(resolveDegen(true)).toEqual({
      scale: 1,
      downMomentum: false,
      shake: true,
      shakeIntensity: 1,
      shakeDurationSec: 0.45,
      particleSlotCount: 60,
      particleBurstDurationSec: 1.0,
      burstParticleCount: 20,
      ...DEGEN_PARTICLE_DEFAULTS,
    });
  });

  it("merges partial DegenOptions", () => {
    expect(resolveDegen({ scale: 2 })).toEqual(
      expect.objectContaining({ scale: 2, ...DEGEN_PARTICLE_DEFAULTS }),
    );
    expect(resolveDegen({ downMomentum: true })).toEqual(
      expect.objectContaining({
        downMomentum: true,
        ...DEGEN_PARTICLE_DEFAULTS,
      }),
    );
    expect(
      resolveDegen({ shake: false, shakeIntensity: 2, shakeDurationSec: 0.2 }),
    ).toEqual(
      expect.objectContaining({
        shake: false,
        shakeIntensity: 2,
        shakeDurationSec: 0.2,
      }),
    );
  });

  it("resolves custom colors", () => {
    expect(resolveDegen({ colors: "#ff0000" })).toEqual(
      expect.objectContaining({ colors: ["#ff0000"] }),
    );
    expect(resolveDegen({ colors: ["#ff0000", "#00ff00"] })).toEqual(
      expect.objectContaining({ colors: ["#ff0000", "#00ff00"] }),
    );
    expect(resolveDegen({ colors: [] })).toEqual(
      expect.objectContaining({ colors: null }),
    );
    expect(resolveDegen(true)?.colors).toBeNull();
  });

  it("resolves custom particle physics", () => {
    const cfg = resolveDegen({
      drag: 0.8,
      particleSizeMin: 0.5,
      particleSizeMax: 4,
      particleOpacity: 0.3,
      spreadAngle: Math.PI,
      positionJitterX: 50,
      positionJitterY: 20,
      speedMin: 30,
      speedMax: 200,
    });
    expect(cfg).toEqual(
      expect.objectContaining({
        drag: 0.8,
        particleSizeMin: 0.5,
        particleSizeMax: 4,
        particleOpacity: 0.3,
        spreadAngle: Math.PI,
        positionJitterX: 50,
        positionJitterY: 20,
        speedMin: 30,
        speedMax: 200,
      }),
    );
  });

  it("clamps particle slots, burst duration, and burst count to slot capacity", () => {
    expect(
      resolveDegen({
        particleSlotCount: 100,
        particleBurstDurationSec: 10,
        burstParticleCount: 99,
      }),
    ).toEqual(
      expect.objectContaining({
        particleSlotCount: 80,
        particleBurstDurationSec: 5,
        burstParticleCount: 80,
      }),
    );
    expect(
      resolveDegen({
        particleSlotCount: 3,
        burstParticleCount: 0,
      }),
    ).toEqual(
      expect.objectContaining({
        particleSlotCount: 4,
        burstParticleCount: 1,
      }),
    );
  });

  it("clamps drag and opacity to [0,1]", () => {
    expect(resolveDegen({ drag: 1.5 })).toEqual(
      expect.objectContaining({ drag: 1 }),
    );
    expect(resolveDegen({ drag: -0.5 })).toEqual(
      expect.objectContaining({ drag: 0 }),
    );
    expect(resolveDegen({ particleOpacity: 2 })).toEqual(
      expect.objectContaining({ particleOpacity: 1 }),
    );
  });
});

// ─── resolveTradeStream ───────────────────────────────────────────────────────

describe("resolveTradeStream", () => {
  const mockStream = {
    value: [],
  } as unknown as import("react-native-reanimated").SharedValue<
    import("../src/types").TradeEvent[]
  >;

  it("returns null when stream is undefined", () => {
    expect(resolveTradeStream(undefined)).toBeNull();
  });

  it("returns defaults when stream is set", () => {
    expect(resolveTradeStream(mockStream)).toEqual({
      maxCount: 50,
      labelOffsetX: 8,
    });
  });

  it("returns null when input is false", () => {
    expect(resolveTradeStream(mockStream, false)).toBeNull();
  });

  it("merges maxCount from input object", () => {
    expect(resolveTradeStream(mockStream, { maxCount: 12 })).toEqual({
      maxCount: 12,
      labelOffsetX: 8,
    });
  });

  it("merges labelOffsetX from input object", () => {
    expect(resolveTradeStream(mockStream, { labelOffsetX: 16 })).toEqual({
      maxCount: 50,
      labelOffsetX: 16,
    });
  });
});

describe("resolveGridStyle", () => {
  it("returns the solid 1px default when omitted", () => {
    expect(resolveGridStyle(undefined)).toEqual({
      color: undefined,
      strokeWidth: 1,
      intervals: [],
      opacity: 1,
    });
  });

  it("merges provided fields over the defaults", () => {
    expect(
      resolveGridStyle({ color: "#fff", intervals: [1, 3], opacity: 0.5 }),
    ).toEqual({
      color: "#fff",
      strokeWidth: 1,
      intervals: [1, 3],
      opacity: 0.5,
    });
  });

  it("keeps default strokeWidth/opacity when only some fields are set", () => {
    expect(resolveGridStyle({ strokeWidth: 2 })).toEqual({
      color: undefined,
      strokeWidth: 2,
      intervals: [],
      opacity: 1,
    });
  });
});
