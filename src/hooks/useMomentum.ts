import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { detectMomentum } from "../math/momentum";
import type { Momentum } from "../types";
import type { EngineState } from "../useLivelineEngine";

/**
 * Resolve the momentum prop to a detected or forced momentum value.
 * - `true` = auto-detect from data
 * - `false` = disabled, always 'flat'
 * - `'up'` / `'down'` / `'flat'` = forced value
 */
export function resolveMomentumProp(
  prop: boolean | Momentum,
  data: readonly { time: number; value: number }[],
): Momentum {
  "worklet";
  if (prop === false) return "flat";
  if (prop === true)
    return detectMomentum(data as { time: number; value: number }[]);
  return prop;
}

export function useMomentum(
  engine: EngineState,
  momentumProp: boolean | Momentum = true,
): SharedValue<Momentum> {
  return useDerivedValue(() =>
    resolveMomentumProp(momentumProp, engine.data.value),
  );
}
