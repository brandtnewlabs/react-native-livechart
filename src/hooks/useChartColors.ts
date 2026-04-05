import { useMemo } from "react";
import type { ChartPadding } from "../draw/line";
import type { ResolvedGradientConfig } from "../resolveConfig";
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
}

/**
 * Derives background and gradient colors from the resolved palette and
 * optional GradientConfig opacities. Memoized so strings are only
 * recomputed when inputs change.
 */
export function useChartColors(
  palette: LiveChartPalette,
  gradientCfg: ResolvedGradientConfig | null,
  accentColor: string,
  layoutHeight: number,
  padding: ChartPadding,
): ChartColors {
  return useMemo(() => {
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

    return {
      backgroundColor,
      gradientEnd,
      gradientTopColor,
      gradientBottomColor,
    };
  }, [palette, gradientCfg, accentColor, layoutHeight, padding]);
}
