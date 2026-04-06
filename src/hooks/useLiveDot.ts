import type { ChartPadding } from "../draw/line";
import type { SingleEngineState } from "../useLivelineEngine";
import { useDerivedValue } from "react-native-reanimated";

export function useLiveDot(engine: SingleEngineState, padding: ChartPadding) {
  const dotX = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    if (w === 0) return -100;
    return w - padding.right;
  });

  const dotY = useDerivedValue(() => {
    const h = engine.canvasHeight.value;
    if (h === 0) return -100;
    const chartH = h - padding.top - padding.bottom;
    const dMin = engine.displayMin.value;
    const dMax = engine.displayMax.value;
    const valRange = dMax - dMin;
    if (valRange === 0) return padding.top + chartH / 2;
    return (
      padding.top + ((dMax - engine.displayValue.value) / valRange) * chartH
    );
  });

  return { dotX, dotY } as const;
}
