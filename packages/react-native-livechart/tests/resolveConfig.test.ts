import {
  resolveAreaDots,
  resolveAxisLabel,
  resolveBadge,
  resolveDegen,
  resolveDot,
  resolveDotRing,
  resolveFontConfig,
  resolveGradient,
  resolveGridStyle,
  resolveLeftEdgeFade,
  resolveMetrics,
  resolveMultiSeriesDot,
  resolvePulse,
  resolveReferenceLineConfig,
  resolveScrub,
  resolveScrubAction,
  resolveSelectionDot,
  resolveSelectionDotRing,
  resolveThreshold,
  resolveThresholdLine,
  resolveTradeStream,
  resolveValueLine,
  resolveXAxis,
  resolveYAxis,
} from "../src/core/resolveConfig";

import {
  BADGE_METRICS_DEFAULTS,
  CANDLE_METRICS_DEFAULTS,
  EMPTY_STATE_METRICS_DEFAULTS,
  FADE_EDGE_WIDTH,
  GRID_METRICS_DEFAULTS,
  MOTION_METRICS_DEFAULTS,
} from "../src/constants";
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

// ─── resolveAxisLabel ──────────────────────────────────────────────────────────

describe("resolveAxisLabel", () => {
  it("returns null for undefined (opt-in, default off)", () => {
    expect(resolveAxisLabel(undefined)).toBeNull();
  });

  it("returns null for false", () => {
    expect(resolveAxisLabel(false)).toBeNull();
  });

  it("returns the built-in defaults for true (dot on, no connector)", () => {
    expect(resolveAxisLabel(true)).toEqual({
      format: undefined,
      color: undefined,
      position: "right",
      dot: true,
      connector: null,
      render: undefined,
    });
  });

  it("merges partial config (color / position) with defaults", () => {
    expect(resolveAxisLabel({ color: "#abc", position: "left" })).toEqual({
      format: undefined,
      color: "#abc",
      position: "left",
      dot: true,
      connector: null,
      render: undefined,
    });
  });

  it("carries through a custom format and render escape hatch", () => {
    const format = (v: number) => `$${v}`;
    const render = () => null;
    expect(resolveAxisLabel({ format, render })).toEqual({
      format,
      color: undefined,
      position: "right",
      dot: true,
      connector: null,
      render,
    });
  });

  it('carries through the "extrema" position mode (no connector)', () => {
    expect(resolveAxisLabel({ position: "extrema" })).toEqual({
      format: undefined,
      color: undefined,
      position: "extrema",
      dot: true,
      connector: null,
      render: undefined,
    });
  });

  it("carries through the font + dot styling knobs", () => {
    expect(
      resolveAxisLabel({
        position: "extrema",
        fontSize: 16,
        fontWeight: "700",
        fontFamily: "JetBrainsMono",
        dotColor: "#f0f",
        dotSize: 12,
        dot: false,
      }),
    ).toEqual({
      format: undefined,
      color: undefined,
      position: "extrema",
      fontSize: 16,
      fontWeight: "700",
      fontFamily: "JetBrainsMono",
      dotColor: "#f0f",
      dotSize: 12,
      dot: false,
      connector: null,
      render: undefined,
    });
  });

  it('defaults the connector to dashed in "extrema-edge" mode', () => {
    const resolved = resolveAxisLabel({ position: "extrema-edge" });
    expect(resolved?.position).toBe("extrema-edge");
    expect(resolved?.connector).toEqual({
      color: undefined,
      strokeWidth: 1,
      intervals: [2, 3],
    });
  });

  it('"extrema-edge" with connector: false disables the connector', () => {
    expect(
      resolveAxisLabel({ position: "extrema-edge", connector: false })
        ?.connector,
    ).toBeNull();
  });

  it("resolves a custom connector line style", () => {
    expect(
      resolveAxisLabel({
        position: "extrema-edge",
        connector: { color: "#abc", strokeWidth: 2, intervals: [5, 5] },
      })?.connector,
    ).toEqual({ color: "#abc", strokeWidth: 2, intervals: [5, 5] });
  });

  it("a solid connector omits intervals", () => {
    expect(
      resolveAxisLabel({
        position: "extrema-edge",
        connector: { color: "#abc" },
      })?.connector,
    ).toEqual({ color: "#abc", strokeWidth: 1, intervals: undefined });
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
    expect(resolveScrub(true)).toEqual({
      tooltip: true,
      dimOpacity: 0.3,
      tooltipBorderRadius: 5,
      tooltipPlacement: "side",
      tooltipMargin: 8,
      tooltipShowValue: true,
      tooltipShowTime: true,
      panGestureDelay: 0,
    });
  });

  it("merges partial config with defaults", () => {
    expect(resolveScrub({ tooltip: false })).toEqual({
      tooltip: false,
      dimOpacity: 0.3,
      tooltipBorderRadius: 5,
      tooltipPlacement: "side",
      tooltipMargin: 8,
      tooltipShowValue: true,
      tooltipShowTime: true,
      panGestureDelay: 0,
    });
  });

  it("accepts a custom dimOpacity", () => {
    expect(resolveScrub({ dimOpacity: 0.5 })).toEqual({
      tooltip: true,
      dimOpacity: 0.5,
      tooltipBorderRadius: 5,
      tooltipPlacement: "side",
      tooltipMargin: 8,
      tooltipShowValue: true,
      tooltipShowTime: true,
      panGestureDelay: 0,
    });
  });

  it("normalizes the crosshairDash shorthand", () => {
    // `true` → a default dash, an array passes through, `false` → solid.
    expect(resolveScrub(true)?.crosshairDash).toBeUndefined();
    expect(resolveScrub({ crosshairDash: true })?.crosshairDash).toEqual([4, 4]);
    expect(resolveScrub({ crosshairDash: [2, 6] })?.crosshairDash).toEqual([
      2, 6,
    ]);
    expect(resolveScrub({ crosshairDash: false })?.crosshairDash).toBeUndefined();
  });

  it("carries a custom panGestureDelay (press-and-hold to scrub)", () => {
    expect(resolveScrub({ panGestureDelay: 300 })).toEqual({
      tooltip: true,
      dimOpacity: 0.3,
      tooltipBorderRadius: 5,
      tooltipPlacement: "side",
      tooltipMargin: 8,
      tooltipShowValue: true,
      tooltipShowTime: true,
      panGestureDelay: 300,
    });
  });

  it("carries a custom tooltipBorderRadius", () => {
    expect(resolveScrub({ tooltipBorderRadius: 12 })).toMatchObject({
      tooltipBorderRadius: 12,
      tooltipPlacement: "side",
    });
  });

  it("carries a tooltipPlacement override", () => {
    expect(resolveScrub({ tooltipPlacement: "bottom" })).toMatchObject({
      tooltipPlacement: "bottom",
      tooltipBorderRadius: 5,
    });
  });

  it("carries a custom tooltipMargin (edge gap)", () => {
    expect(resolveScrub({ tooltipMargin: 24 })).toMatchObject({
      tooltipMargin: 24,
      tooltipPlacement: "side",
    });
  });

  it("can drop the value row (date-only tooltip)", () => {
    expect(resolveScrub({ tooltipShowValue: false })).toMatchObject({
      tooltipShowValue: false,
      tooltipShowTime: true,
    });
  });
});

// ─── resolveScrubAction ───────────────────────────────────────────────────────

describe("resolveScrubAction", () => {
  const DEFAULTS = {
    icon: "+",
    background: undefined,
    iconColor: undefined,
    lineColor: undefined,
    text: true,
    timeBadge: false,
    snap: undefined,
    dismissOnTapOutside: false,
  };

  it("returns null for undefined (opt-in, off by default)", () => {
    expect(resolveScrubAction(undefined)).toBeNull();
  });

  it("returns null for false", () => {
    expect(resolveScrubAction(false)).toBeNull();
  });

  it("returns defaults for true", () => {
    expect(resolveScrubAction(true)).toEqual(DEFAULTS);
  });

  it("merges a partial config with defaults", () => {
    expect(
      resolveScrubAction({ icon: "★", snap: 0.5, text: false, timeBadge: true }),
    ).toEqual({
      ...DEFAULTS,
      icon: "★",
      snap: 0.5,
      text: false,
      timeBadge: true,
    });
  });

  it("carries color + dismiss overrides", () => {
    expect(
      resolveScrubAction({
        background: "#16a34a",
        iconColor: "#fff",
        lineColor: "#999",
        dismissOnTapOutside: true,
      }),
    ).toEqual({
      ...DEFAULTS,
      background: "#16a34a",
      iconColor: "#fff",
      lineColor: "#999",
      dismissOnTapOutside: true,
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
      colors: undefined,
      positions: undefined,
    });
  });

  it("merges custom topOpacity", () => {
    expect(resolveGradient({ topOpacity: 0.25 })).toEqual({
      topOpacity: 0.25,
      bottomOpacity: undefined,
      colors: undefined,
      positions: undefined,
    });
  });

  it("accepts both opacities", () => {
    expect(resolveGradient({ topOpacity: 0.3, bottomOpacity: 0.05 })).toEqual({
      topOpacity: 0.3,
      bottomOpacity: 0.05,
      colors: undefined,
      positions: undefined,
    });
  });

  it("preserves explicit color stops", () => {
    const colors = ["rgba(0,0,0,0.4)", "rgba(0,0,0,0.1)", "rgba(0,0,0,0)"];
    expect(resolveGradient({ colors })).toEqual({
      topOpacity: undefined,
      bottomOpacity: undefined,
      colors,
      positions: undefined,
    });
  });

  it("preserves color stops with positions", () => {
    const colors = ["#fff", "#000"];
    const positions = [0, 1];
    expect(resolveGradient({ colors, positions })).toEqual({
      topOpacity: undefined,
      bottomOpacity: undefined,
      colors,
      positions,
    });
  });

  it("leaves colors/positions undefined for an opacity-only object", () => {
    expect(resolveGradient({ topOpacity: 0.5 })).toEqual({
      topOpacity: 0.5,
      bottomOpacity: undefined,
      colors: undefined,
      positions: undefined,
    });
  });
});

// ─── resolveAreaDots ──────────────────────────────────────────────────────────

describe("resolveAreaDots", () => {
  const DEFAULTS = { spacing: 12, size: 1.6, color: undefined, opacity: 1 };

  it("returns null for undefined (default off)", () => {
    expect(resolveAreaDots(undefined)).toBeNull();
  });

  it("returns null for false", () => {
    expect(resolveAreaDots(false)).toBeNull();
  });

  it("returns defaults for true (color undefined = palette-derived tint)", () => {
    expect(resolveAreaDots(true)).toEqual(DEFAULTS);
  });

  it("merges a partial override over the defaults", () => {
    expect(resolveAreaDots({ spacing: 16 })).toEqual({
      ...DEFAULTS,
      spacing: 16,
    });
  });

  it("preserves an explicit color and opacity", () => {
    expect(
      resolveAreaDots({ color: "rgba(247,147,26,0.3)", size: 2, opacity: 0.8 }),
    ).toEqual({
      spacing: 12,
      size: 2,
      color: "rgba(247,147,26,0.3)",
      opacity: 0.8,
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

// ─── resolveDotRing ───────────────────────────────────────────────────────────

describe("resolveDotRing", () => {
  it("returns null when disabled", () => {
    expect(resolveDotRing(false)).toBeNull();
  });

  it("returns haloed defaults for true/undefined", () => {
    expect(resolveDotRing(true)).toEqual({ color: undefined, width: 2.5 });
    expect(resolveDotRing(undefined)).toEqual({ color: undefined, width: 2.5 });
  });

  it("merges a partial ring config over the defaults", () => {
    expect(resolveDotRing({ color: "#000", width: 4 })).toEqual({
      color: "#000",
      width: 4,
    });
    expect(resolveDotRing({ color: "#fff" })).toEqual({
      color: "#fff",
      width: 2.5,
    });
  });
});

// ─── resolveDot ───────────────────────────────────────────────────────────────

describe("resolveDot", () => {
  it("defaults to a haloed, shown dot (line color)", () => {
    expect(resolveDot(undefined)).toEqual({
      radius: 3.5,
      ring: { color: undefined, width: 2.5 },
      show: true,
      color: undefined,
    });
  });

  it("applies overrides (flat ring, hidden, color, radius)", () => {
    expect(
      resolveDot({ radius: 6, ring: false, show: false, color: "#abcdef" }),
    ).toEqual({ radius: 6, ring: null, show: false, color: "#abcdef" });
  });

  it("treats `true` as shown defaults", () => {
    expect(resolveDot(true)).toEqual(resolveDot(undefined));
    expect(resolveDot(true).show).toBe(true);
  });

  it("treats `false` as shown:false over the defaults (dot={false})", () => {
    expect(resolveDot(false)).toEqual({
      radius: 3.5,
      ring: { color: undefined, width: 2.5 },
      show: false,
      color: undefined,
    });
  });
});

// ─── resolveMultiSeriesDot ──────────────────────────────────────────────────────

describe("resolveMultiSeriesDot", () => {
  it("defaults to a haloed, shown dot with pulse", () => {
    expect(resolveMultiSeriesDot(undefined)).toEqual({
      radius: 3.5,
      ring: { color: undefined, width: 2.5 },
      show: true,
      color: undefined,
      pulse: expect.objectContaining({ maxRadius: expect.any(Number) }),
      valueLine: null,
      valueLabel: true,
    });
  });

  it("applies overrides (flat ring, hidden, color, label off)", () => {
    expect(
      resolveMultiSeriesDot({
        radius: 5,
        ring: false,
        show: false,
        color: "#abcdef",
        valueLabel: false,
      }),
    ).toEqual({
      radius: 5,
      ring: null,
      show: false,
      color: "#abcdef",
      pulse: expect.objectContaining({ maxRadius: expect.any(Number) }),
      valueLine: null,
      valueLabel: false,
    });
  });

  it("treats `true` as shown defaults with pulse", () => {
    expect(resolveMultiSeriesDot(true)).toEqual(
      resolveMultiSeriesDot(undefined),
    );
  });

  it("treats `false` as a hidden dot (dot={false})", () => {
    const r = resolveMultiSeriesDot(false);
    expect(r.show).toBe(false);
    expect(r.radius).toBe(3.5);
    expect(r.valueLabel).toBe(true);
  });
});

// ─── resolveSelectionDotRing ─────────────────────────────────────────────────

describe("resolveSelectionDotRing", () => {
  it("returns null when disabled", () => {
    expect(resolveSelectionDotRing(false)).toBeNull();
  });

  it("returns defaults for true/undefined (ring on)", () => {
    expect(resolveSelectionDotRing(true)).toEqual({ color: undefined, width: 2 });
    expect(resolveSelectionDotRing(undefined)).toEqual({
      color: undefined,
      width: 2,
    });
  });

  it("merges a partial ring config over the defaults", () => {
    expect(resolveSelectionDotRing({ width: 3 })).toEqual({
      color: undefined,
      width: 3,
    });
    expect(resolveSelectionDotRing({ color: "#fbbf24" })).toEqual({
      color: "#fbbf24",
      width: 2,
    });
  });
});

// ─── resolveSelectionDot ─────────────────────────────────────────────────────

describe("resolveSelectionDot", () => {
  it("defaults to the built-in dot for undefined/true (default ON)", () => {
    const expected = {
      size: 4,
      color: undefined,
      ring: { color: undefined, width: 2 },
    };
    expect(resolveSelectionDot(undefined)).toEqual(expected);
    expect(resolveSelectionDot(true)).toEqual(expected);
  });

  it("returns null when disabled (selectionDot={false})", () => {
    expect(resolveSelectionDot(false)).toBeNull();
  });

  it("applies size/color/ring knobs from a config object", () => {
    expect(
      resolveSelectionDot({ size: 6, color: "#abcdef", ring: { width: 3 } }),
    ).toEqual({
      size: 6,
      color: "#abcdef",
      ring: { color: undefined, width: 3 },
      component: undefined,
    });
  });

  it("turns the ring off via ring:false", () => {
    const r = resolveSelectionDot({ ring: false })!;
    expect(r.ring).toBeNull();
    expect(r.size).toBe(4);
  });

  it("carries a custom component through", () => {
    const Custom = () => null;
    const r = resolveSelectionDot({ component: Custom })!;
    expect(r.component).toBe(Custom);
    // size/color/ring still resolved (ignored by the slot when component set)
    expect(r.size).toBe(4);
    expect(r.ring).toEqual({ color: undefined, width: 2 });
  });
});

// ─── resolveMetrics ─────────────────────────────────────────────────────────

describe("resolveMetrics", () => {
  it("returns full defaults for undefined", () => {
    expect(resolveMetrics(undefined)).toEqual({
      badge: BADGE_METRICS_DEFAULTS,
      candle: CANDLE_METRICS_DEFAULTS,
      grid: GRID_METRICS_DEFAULTS,
      motion: MOTION_METRICS_DEFAULTS,
      emptyState: EMPTY_STATE_METRICS_DEFAULTS,
    });
  });

  it("ships the documented default values", () => {
    const m = resolveMetrics(undefined);
    expect(m.badge).toEqual({
      padX: 10,
      padY: 3,
      tailLength: 5,
      marginEdge: 4,
      dotGap: 12,
      tailSpread: 2.5,
    });
    expect(m.candle).toEqual({
      minBodyPx: 1,
      maxBodyPx: 40,
      bodyWidthRatio: 0.8,
    });
    expect(m.grid).toEqual({ fadeInSpeed: 0.18, fadeOutSpeed: 0.12 });
    expect(m.motion).toEqual({
      badgeColorSpeed: 0.08,
      adaptiveSpeedBoost: 0.12,
    });
    expect(m.emptyState).toEqual({
      labelOpacity: 0.35,
      gapPad: 20,
      gapFadeWidth: 30,
    });
  });

  it("replaces only the keys set within a namespace", () => {
    const m = resolveMetrics({ badge: { padX: 20, tailLength: 9 } });
    expect(m.badge).toEqual({
      padX: 20,
      padY: 3,
      tailLength: 9,
      marginEdge: 4,
      dotGap: 12,
      tailSpread: 2.5,
    });
    // Untouched namespaces keep their defaults.
    expect(m.candle).toEqual(CANDLE_METRICS_DEFAULTS);
    expect(m.motion).toEqual(MOTION_METRICS_DEFAULTS);
  });

  it("merges multiple namespaces independently", () => {
    const m = resolveMetrics({
      candle: { maxBodyPx: 12 },
      grid: { fadeInSpeed: 0.5 },
      motion: { adaptiveSpeedBoost: 0 },
      emptyState: { labelOpacity: 1 },
    });
    expect(m.candle).toEqual({ minBodyPx: 1, maxBodyPx: 12, bodyWidthRatio: 0.8 });
    expect(m.grid).toEqual({ fadeInSpeed: 0.5, fadeOutSpeed: 0.12 });
    expect(m.motion).toEqual({ badgeColorSpeed: 0.08, adaptiveSpeedBoost: 0 });
    expect(m.emptyState).toEqual({
      labelOpacity: 1,
      gapPad: 20,
      gapFadeWidth: 30,
    });
    expect(m.badge).toEqual(BADGE_METRICS_DEFAULTS);
  });
});

// ─── resolveThreshold ─────────────────────────────────────────────────────────

describe("resolveThresholdLine", () => {
  it("returns null for undefined / false", () => {
    expect(resolveThresholdLine(undefined)).toBeNull();
    expect(resolveThresholdLine(false)).toBeNull();
  });

  it("returns dashed defaults for true (label on the left)", () => {
    expect(resolveThresholdLine(true)).toEqual({
      label: undefined,
      labelPosition: "left",
      color: undefined,
      intervals: [4, 4],
      strokeWidth: 1,
      showValue: false,
    });
  });

  it("merges an object over the defaults (incl. labelPosition)", () => {
    expect(
      resolveThresholdLine({
        label: "Break-even",
        labelPosition: "right",
        color: "#0f0",
        intervals: [6, 3],
        strokeWidth: 2,
        showValue: true,
      }),
    ).toEqual({
      label: "Break-even",
      labelPosition: "right",
      color: "#0f0",
      intervals: [6, 3],
      strokeWidth: 2,
      showValue: true,
    });
  });
});

describe("resolveThreshold", () => {
  // resolveThreshold passes `value` through untouched — a sentinel is enough.
  const value = {
    sentinel: true,
  } as unknown as import("react-native-reanimated").SharedValue<number>;

  it("returns null when no threshold is set", () => {
    expect(resolveThreshold(undefined)).toBeNull();
  });

  it("fills defaults (no colors, no fill, no line) for a bare value", () => {
    const r = resolveThreshold({ value });
    expect(r).toEqual({
      value,
      aboveColor: undefined,
      belowColor: undefined,
      fill: false,
      line: null,
    });
    // Identity of the SharedValue must be preserved (read on the UI thread).
    expect(r?.value).toBe(value);
  });

  it("passes through above/below colors and fill", () => {
    expect(
      resolveThreshold({
        value,
        aboveColor: "#0f0",
        belowColor: "#f00",
        fill: true,
      }),
    ).toEqual({
      value,
      aboveColor: "#0f0",
      belowColor: "#f00",
      fill: true,
      line: null,
    });
  });

  it("resolves the line sub-config (true → dashed defaults)", () => {
    const r = resolveThreshold({ value, line: true });
    expect(r?.line).toEqual({
      label: undefined,
      labelPosition: "left",
      color: undefined,
      intervals: [4, 4],
      strokeWidth: 1,
      showValue: false,
    });
  });

  it("resolves a configured line + keeps line null when disabled", () => {
    expect(resolveThreshold({ value, line: { label: "VWAP" } })?.line).toEqual({
      label: "VWAP",
      labelPosition: "left",
      color: undefined,
      intervals: [4, 4],
      strokeWidth: 1,
      showValue: false,
    });
    expect(resolveThreshold({ value, line: false })?.line).toBeNull();
  });
});
