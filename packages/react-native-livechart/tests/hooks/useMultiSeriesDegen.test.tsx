import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";

import { resolveDegen } from "../../src/core/resolveConfig";
import { useLiveChartSeriesEngine } from "../../src/core/useLiveChartSeriesEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { useMultiSeriesDegen } from "../../src/hooks/useMultiSeriesDegen";
import type { SeriesConfig } from "../../src/types";
import { DEGEN_STRIDE } from "../../src/constants";

let mockDegenFrame: (frame: { timestamp: number }) => void;
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => React.useRef({
      value: initial,
      get() { return this.value; },
      set(next: T) { this.value = next; },
    }).current,
    useDerivedValue: <T,>(derive: () => T) => ({
      get value() { return derive(); },
      get() { return derive(); },
    }),
    useFrameCallback: (callback: typeof mockDegenFrame) => {
      mockDegenFrame = callback;
      return { setActive() {} };
    },
  };
});

function useMakeEngine() {
  const series = useSharedValue<SeriesConfig[]>([
    {
      id: "a",
      data: [{ time: 1_700_000_000, value: 50 }],
      value: 50,
      color: "#3b82f6",
    },
  ]);
  return useLiveChartSeriesEngine({ series, timeWindow: 100, smoothing: 0.08 });
}

describe("useMultiSeriesDegen", () => {
  it.each([true, false])("spawns at the projected dot with a buffered clock (explicit head=%s)", async (explicit) => {
    const { result } = await renderHook(() => {
      const series = useSharedValue<SeriesConfig[]>([{
        id: "a", value: 30,
        data: Array.from({ length: 6 }, (_, i) => ({ time: 1045 + i, value: 20 + i * 2 })),
      }]);
      const head = useSharedValue<number | undefined>(explicit ? 1050 : undefined);
      const engine = useLiveChartSeriesEngine({ series, presentationTime: head, nowOverride: 1050, timeWindow: 100, windowBuffer: 0.1, smoothing: 1 });
      engine.canvasWidth.set(320); engine.canvasHeight.set(200);
      engine.timestamp.set(1060); engine.currentTime.set(1050);
      engine.displayMin.set(20); engine.displayMax.set(40);
      engine.displaySeriesValues.set([30]); engine.seriesOpacities.set([1]);
      engine.series.set(series.get());
      const effect = useMultiSeriesDegen(engine, { left: 0, right: 0, top: 0, bottom: 0 }, resolveDegen({
        shake: false, positionJitterX: 0, positionJitterY: 0, speedMin: 0, speedMax: 0,
      }));
      return { effect, engine };
    });
    mockDegenFrame({ timestamp: 1000 });
    const buf = result.current.effect.pack.get();
    const active = Array.from({ length: buf.length / DEGEN_STRIDE }, (_, i) => i * DEGEN_STRIDE).filter(i => buf[i + 5] === 1);
    expect(active.length).toBeGreaterThan(0);
    expect(active.map(i => buf[i])).toEqual(active.map(() => 288));
    expect(active.map(i => buf[i + 1])).toEqual(active.map(() => 100));
  });

  it.each(["offscreen", "future-only", "future-momentum"])("does not spawn from %s history", async (mode) => {
    const { result } = await renderHook(() => {
      const history = Array.from({ length: 6 }, (_, i) => ({
        time: (mode === "future-only" ? 1051 : 1045) + i,
        value: mode === "future-momentum" ? 20 : 20 + i * 2,
      }));
      if (mode === "future-momentum") history.push({ time: 1060, value: 9999 });
      const series = useSharedValue<SeriesConfig[]>([{ id: "a", value: 30, data: history }]);
      const engine = useLiveChartSeriesEngine({ series, presentationTime: useSharedValue<number | undefined>(1050), nowOverride: 1050, timeWindow: 100, smoothing: 1 });
      engine.canvasWidth.set(320); engine.canvasHeight.set(200);
      engine.timestamp.set(mode === "offscreen" ? 1200 : 1060);
      engine.currentTime.set(1050); engine.seriesOpacities.set([1]);
      engine.series.set(series.get());
      return useMultiSeriesDegen(engine, { left: 0, right: 0, top: 0, bottom: 0 }, resolveDegen(true));
    });
    mockDegenFrame({ timestamp: 1000 });
    const buf = result.current.pack.get();
    expect(Array.from({ length: buf.length / DEGEN_STRIDE }, (_, i) => buf[i * DEGEN_STRIDE + 5]).every(active => active === 0)).toBe(true);
  });

  it("returns pack / packRevision / shakeTransform when enabled", async () => {
    const { result } = await renderHook(() => {
      const engine = useMakeEngine();
      return useMultiSeriesDegen(engine, DEFAULT_PADDING, resolveDegen(true));
    });
    expect(result.current.pack.value).toBeInstanceOf(Float64Array);
    expect(result.current.packRevision).toBeDefined();
    expect(result.current.shakeTransform).toBeDefined();
  });

  it.each([true, false])("writes and resets an externally owned shake transform (enabled=%s)", async enabled => {
    const { result } = await renderHook(() => {
      const engine = useMakeEngine();
      const output = useSharedValue<[{ translateX: number }, { translateY: number }]>([
        { translateX: 7 }, { translateY: 4 },
      ]);
      const effect = useMultiSeriesDegen(engine, DEFAULT_PADDING, resolveDegen(enabled), undefined, output);
      return { output, effect };
    });
    expect(result.current.effect.shakeTransform).toBe(result.current.output);
    mockDegenFrame({ timestamp: 1000 });
    expect(result.current.output.get()).toEqual([{ translateX: 0 }, { translateY: 0 }]);
  });

  it("returns a pack when cfg is null (disabled)", async () => {
    const { result } = await renderHook(() => {
      const engine = useMakeEngine();
      return useMultiSeriesDegen(engine, DEFAULT_PADDING, null);
    });
    expect(result.current.pack.value).toBeInstanceOf(Float64Array);
  });

  it("accepts shake:false, downMomentum:true and an onShake callback", async () => {
    const onShake = jest.fn();
    const { result } = await renderHook(() => {
      const engine = useMakeEngine();
      return useMultiSeriesDegen(
        engine,
        DEFAULT_PADDING,
        resolveDegen({ shake: false, downMomentum: true }),
        onShake,
      );
    });
    expect(result.current.shakeTransform).toBeDefined();
  });
});
