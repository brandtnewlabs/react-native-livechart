import { render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue } from "react-native-reanimated";
import { LiveChart } from "../src/components/LiveChart";
import * as engines from "../src/core/useLiveChartEngine";
import * as badges from "../src/hooks/useBadge";
import * as dots from "../src/hooks/useLiveDot";
import * as paths from "../src/hooks/useChartPaths";
import type { CandlePoint } from "../src/types";

const useActualEngine = engines.useLiveChartEngine;

it.each([
  { mode: "line" as const, controlled: false, buffer: 0, recorded: false },
  { mode: "line" as const, controlled: false, buffer: 0.1, recorded: true },
  { mode: "line" as const, controlled: true, buffer: 0, recorded: true },
  { mode: "candle" as const, controlled: false, buffer: 0.1, recorded: false },
  { mode: "candle" as const, controlled: true, buffer: 0, recorded: false },
])("keeps indicator prices aligned in $mode mode (viewport=$controlled, buffer=$buffer)", async ({ mode, controlled, buffer, recorded }) => {
  // Derived values freeze at mount in Jest. Seed the engine before its consumers
  // read it, with deliberately different recorded-line and live-candle prices.
  const engineSpy = jest.spyOn(engines, "useLiveChartEngine").mockImplementation((config) => {
    const engine = useActualEngine(config);
    engine.canvasWidth.set(200);
    engine.canvasHeight.set(100);
    engine.displayMin.set(0);
    engine.displayMax.set(10);
    engine.displayValue.set(9);
    engine.timestamp.set(1000);
    engine.displayWindow.set(30);
    // Bypass the reveal bridge, whose UI-thread morph does not run in Jest.
    return { ...engine, data: config.dataChangeSource ?? config.data };
  });
  const dotSpy = jest.spyOn(dots, "useLiveDot");
  const badgeSpy = jest.spyOn(badges, "useBadge");
  const pathSpy = jest.spyOn(paths, "useChartPaths");
  function Chart() {
    const data = useSharedValue([{ time: 980, value: 1 }, { time: 985, value: 2 }]);
    const value = useSharedValue(9);
    const candles = useSharedValue([{ time: 985, open: 8, high: 10, low: 7, close: 9 }]);
    const liveCandle = useSharedValue<CandlePoint | null>({ time: 995, open: 9, high: 10, low: 8, close: 9 });
    const end = useSharedValue<number | null>(null);
    const window = useSharedValue<number | null>(null);
    return <LiveChart data={data} value={value} mode={mode} candles={candles} liveCandle={liveCandle}
      viewport={controlled ? { end, window } : false} windowBuffer={buffer} badge valueLine dot />;
  }
  try {
    await render(<Chart />);
    const { dotX, dotY } = dotSpy.mock.results.at(-1)!.value;
    const [engine, padding] = dotSpy.mock.calls.at(-1)!;
    const badgeEngine = badgeSpy.mock.calls.at(-1)![0];
    const expectedValue = recorded ? 2 : 9;
    const expectedY = padding.top + ((10 - expectedValue) / 10) * (100 - padding.top - padding.bottom);
    expect(dotY.value).toBeCloseTo(expectedY);
    expect(badgeEngine.displayValue.get()).toBe(expectedValue);
    const right = 200 - padding.right;
    expect(dotX.value).toBeCloseTo(recorded ? (padding.left + right) / 2 : right);
    expect(pathSpy.mock.calls.at(-1)![10]).toBe(recorded);
    // The source engine retains its live easing state.
    expect(engine.displayValue.get()).toBe(9);
  } finally {
    engineSpy.mockRestore();
    dotSpy.mockRestore();
    badgeSpy.mockRestore();
    pathSpy.mockRestore();
  }
});
