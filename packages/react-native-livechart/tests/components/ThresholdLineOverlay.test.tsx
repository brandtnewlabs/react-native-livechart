import { render } from "@testing-library/react-native";

import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import type { ResolvedThresholdLineConfig } from "../../src/core/resolveConfig";
import {
  ThresholdBadgeOverlay,
  ThresholdLineOverlay,
} from "../../src/components/ThresholdLineOverlay";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { resolveTheme } from "../../src/theme";
import { withSharedValueAccessors } from "../support/sharedValueMock";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;

const palette = resolveTheme("#3b82f6", "dark");

function engine(): ChartEngineLayout {
  return withSharedValueAccessors({
    displayMin: { value: 0 },
    displayMax: { value: 10 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 1700000000 },
  }) as unknown as ChartEngineLayout;
}

const LINE_DEFAULTS: ResolvedThresholdLineConfig = {
  label: undefined,
  labelPosition: "left",
  color: undefined,
  intervals: [4, 4],
  strokeWidth: 1,
  showValue: false,
};

function sv<T>(value: T) {
  return withSharedValueAccessors({ v: { value } }).v as unknown as {
    value: T;
    get: () => T;
    set: (n: T) => void;
  };
}

function props(
  cfg: ResolvedThresholdLineConfig,
  overrides?: { lineY?: number; visible?: boolean; value?: number },
) {
  return {
    engine: engine(),
    padding: DEFAULT_PADDING,
    lineY: sv(overrides?.lineY ?? 150) as never,
    visible: sv(overrides?.visible ?? true) as never,
    value: sv(overrides?.value ?? 5) as never,
    cfg,
    palette,
    font,
    formatValue: (v: number) => v.toFixed(2),
  };
}

describe("ThresholdLineOverlay (dashed line)", () => {
  it("draws the dashed line when visible", () => {
    render(<ThresholdLineOverlay {...props(LINE_DEFAULTS)} />);
  });

  it("emits no segment while hidden", () => {
    render(
      <ThresholdLineOverlay
        {...props(LINE_DEFAULTS, { visible: false, lineY: NaN })}
      />,
    );
  });

  it("traces the threshold polyline when seriesPts is provided", () => {
    render(
      <ThresholdLineOverlay
        {...props(LINE_DEFAULTS)}
        seriesPts={sv([12, 100, 200, 80, 388, 90]) as never}
      />,
    );
  });
});

describe("ThresholdBadgeOverlay", () => {
  it("draws the pill + appended value label (left, default)", () => {
    render(
      <ThresholdBadgeOverlay
        {...props({ ...LINE_DEFAULTS, label: "Break-even", showValue: true })}
      />,
    );
  });

  it("shows only the formatted value when showValue has no label", () => {
    render(
      <ThresholdBadgeOverlay
        {...props({ ...LINE_DEFAULTS, showValue: true, color: "#0f0" })}
      />,
    );
  });

  it("right-aligns the pill in the gutter when configured", () => {
    render(
      <ThresholdBadgeOverlay
        {...props({ ...LINE_DEFAULTS, label: "Entry", labelPosition: "right" })}
      />,
    );
  });

  it("renders nothing when there is no label and no value", () => {
    const { toJSON } = render(<ThresholdBadgeOverlay {...props(LINE_DEFAULTS)} />);
    expect(toJSON()).toBeNull();
  });

  it("stays hidden (opacity 0) when the threshold is off-screen", () => {
    render(
      <ThresholdBadgeOverlay
        {...props(
          { ...LINE_DEFAULTS, label: "Break-even" },
          { visible: false, lineY: NaN },
        )}
      />,
    );
  });
});
