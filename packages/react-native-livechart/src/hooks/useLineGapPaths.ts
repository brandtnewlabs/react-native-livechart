import { useDerivedValue } from "react-native-reanimated";
import type { ResolvedCandleGapsConfig } from "../core/resolveConfig";
import type { SingleEngineState } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { buildLineGapGeometry } from "../draw/lineGap";
import { usePathBuilder } from "./usePathBuilder";

/** Batched flat previous-value bridge paths for each semantic line-gap kind. */
export function useLineGapPaths(
  engine: SingleEngineState,
  padding: ChartPadding,
  config: ResolvedCandleGapsConfig,
) {
  const noTradesBuilder = usePathBuilder();
  const unavailableBuilder = usePathBuilder();
  const unknownBuilder = usePathBuilder();

  /* istanbul ignore next -- worklet */
  const geometry = useDerivedValue(() =>
    buildLineGapGeometry(
      engine.data.get(),
      config.gaps,
      padding,
      engine.canvasWidth.get(),
      engine.canvasHeight.get(),
      engine.timestamp.get() - engine.displayWindow.get(),
      engine.displayWindow.get(),
      engine.displayMin.get(),
      engine.displayMax.get(),
      config.styles["no-trades"].bridge !== null,
      config.styles.unavailable.bridge !== null,
      config.styles.unknown.bridge !== null,
    ),
  );

  /* istanbul ignore next -- worklet */
  const noTradesPath = useDerivedValue(() => {
    const b = noTradesBuilder.get();
    const bridges = geometry.get().bridges;
    for (let i = 0; i < bridges.length; i++) {
      const bridge = bridges[i];
      if (bridge.kind !== "no-trades") continue;
      b.moveTo(bridge.x1, bridge.y);
      b.lineTo(bridge.x2, bridge.y);
    }
    return b.detach();
  });

  /* istanbul ignore next -- worklet */
  const unavailablePath = useDerivedValue(() => {
    const b = unavailableBuilder.get();
    const bridges = geometry.get().bridges;
    for (let i = 0; i < bridges.length; i++) {
      const bridge = bridges[i];
      if (bridge.kind !== "unavailable") continue;
      b.moveTo(bridge.x1, bridge.y);
      b.lineTo(bridge.x2, bridge.y);
    }
    return b.detach();
  });

  /* istanbul ignore next -- worklet */
  const unknownPath = useDerivedValue(() => {
    const b = unknownBuilder.get();
    const bridges = geometry.get().bridges;
    for (let i = 0; i < bridges.length; i++) {
      const bridge = bridges[i];
      if (bridge.kind !== "unknown") continue;
      b.moveTo(bridge.x1, bridge.y);
      b.lineTo(bridge.x2, bridge.y);
    }
    return b.detach();
  });

  return { noTradesPath, unavailablePath, unknownPath } as const;
}
