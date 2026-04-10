/**
 * Demo barrel: `useSimulatedData` is an alias of `useSimulatedChartData` so existing screens can keep
 * `import … from "…/sim/useSimulatedData"`. Prefer `useSimulatedChartData` in new code.
 */
export {
  HISTORY_RANGE_SPAN_SECONDS,
  useSimulatedChartData,
  useSimulatedChartData as useSimulatedData,
} from "./useSimulatedChartData";

export type {
  HistoryRange,
  SimulatedChartOptions,
  SimulatedData,
  SimulatedDataOptions,
  TradeSource,
} from "./useSimulatedChartData";
