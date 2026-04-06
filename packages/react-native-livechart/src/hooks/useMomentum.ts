import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { SingleEngineState } from "../core/useLiveChartEngine";
import { detectMomentum } from "../math/momentum";
import type { Momentum, MomentumConfig } from "../types";

/**
 * Resolve the momentum prop to a detected or forced momentum value.
 * - `true` = auto-detect from data with defaults
 * - `false` = disabled, always 'flat'
 * - `'up'` / `'down'` / `'flat'` = forced value
 * - `MomentumConfig` = auto-detect with custom threshold/lookback
 */
export function resolveMomentumProp(
  prop: boolean | Momentum | MomentumConfig,
  data: readonly { time: number; value: number }[],
): Momentum {
  "worklet";
  if (prop === false) return "flat";
  if (prop === true)
    return detectMomentum(data as { time: number; value: number }[]);
  if (typeof prop === "object")
    return detectMomentum(
      data as { time: number; value: number }[],
      prop.lookback,
      prop.threshold,
    );
  return prop;
}

export function useMomentum(
  engine: SingleEngineState,
  momentumProp: boolean | Momentum | MomentumConfig = true,
): SharedValue<Momentum> {
  return useDerivedValue(() =>
    resolveMomentumProp(momentumProp, engine.data.value),
  );
}
