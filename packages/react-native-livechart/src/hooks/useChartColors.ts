import type { SharedValue } from "react-native-reanimated";
import type { ResolvedGradientConfig } from "../core/resolveConfig";
import type { ChartPadding } from "../draw/line";
import { parseColorRgb } from "../theme";
import type { LiveChartPalette } from "../types";

export interface ChartColors {
  /** Background color derived from the theme palette. */
  backgroundColor: string;
  /** Y coordinate of the gradient bottom edge — accounts for bottom inset. */
  gradientEnd: number;
  /** Top gradient stop — custom opacity or palette default. */
  gradientTopColor: string;
  /** Bottom gradient stop — custom opacity or palette default. */
  gradientBottomColor: string;
  /** Gradient color stops (top → bottom). Custom `colors` when provided (static
   *  or animated), else the 2-stop `[gradientTopColor, gradientBottomColor]`
   *  fallback. */
  gradientColors: string[] | SharedValue<string[]>;
  /** Stop positions matching `gradientColors`, or undefined for even spacing. */
  gradientPositions: number[] | undefined;
}

/**
 * Derives background and gradient colors from the resolved palette and
 * optional GradientConfig opacities. The React Compiler memoizes the result
 * so strings are only recomputed when inputs change.
 */
export function useChartColors(
  palette: LiveChartPalette,
  gradientCfg: ResolvedGradientConfig | null,
  accentColor: string,
  layoutHeight: number,
  padding: ChartPadding,
): ChartColors {
  const backgroundColor = `rgb(${palette.bgRgb[0]}, ${palette.bgRgb[1]}, ${palette.bgRgb[2]})`;
  const gradientEnd = Math.max(1, layoutHeight - padding.bottom);

  const [r, g, b] = parseColorRgb(accentColor);
  const gradientTopColor =
    gradientCfg?.topOpacity !== undefined
      ? `rgba(${r}, ${g}, ${b}, ${gradientCfg.topOpacity})`
      : palette.fillTop;
  const gradientBottomColor =
    gradientCfg?.bottomOpacity !== undefined
      ? `rgba(${r}, ${g}, ${b}, ${gradientCfg.bottomOpacity})`
      : palette.fillBottom;

  const customColors = gradientCfg?.colors;
  const positions = gradientCfg?.positions;
  const staticColors = Array.isArray(customColors) ? customColors : undefined;
  const hasStaticColors = staticColors !== undefined && staticColors.length >= 2;
  // An animated `colors` can't be measured on the JS thread without reading it
  // during render, so it's trusted to hold ≥2 stops and to match `positions`.
  const isAnimatedColors = customColors !== undefined && staticColors === undefined;

  let gradientColors: string[] | SharedValue<string[]> = [
    gradientTopColor,
    gradientBottomColor,
  ];
  let gradientPositions: number[] | undefined;
  if (isAnimatedColors) {
    gradientColors = customColors;
    gradientPositions = positions;
  } else if (hasStaticColors) {
    gradientColors = staticColors;
    gradientPositions =
      positions !== undefined && positions.length === staticColors.length
        ? positions
        : undefined;
  }

  return {
    backgroundColor,
    gradientEnd,
    gradientTopColor,
    gradientBottomColor,
    gradientColors,
    gradientPositions,
  };
}
