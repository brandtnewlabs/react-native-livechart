import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";

type MockFrameHandle = {
  isActive: boolean;
  setActive: jest.Mock<void, [boolean]>;
  callback: (info: {
    timestamp: number;
    timeSincePreviousFrame: number;
  }) => void;
};

const mockFrameHandles: MockFrameHandle[] = [];

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const actual = jest.requireActual("react-native-reanimated");
  return {
    ...actual,
    useFrameCallback: jest.fn(
      (
        callback: MockFrameHandle["callback"],
        autostart = true,
      ) => {
        const ref = React.useRef<MockFrameHandle | null>(null);
        if (ref.current === null) {
          const handle = {
            isActive: autostart,
            setActive: jest.fn<void, [boolean]>(),
            callback,
          };
          handle.setActive.mockImplementation((active) => {
            handle.isActive = active;
          });
          ref.current = handle;
          mockFrameHandles.push(handle);
        }
        ref.current.callback = callback;
        return ref.current;
      },
    ),
  };
});

import { useLiveChartEngine } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import { useCandleWidthLerp } from "../../src/hooks/useCandlePaths";
import { useMarkers } from "../../src/hooks/useMarkers";
import { useTradeStream } from "../../src/hooks/useTradeStream";
import type { Marker, TradeEvent } from "../../src/types";

beforeEach(() => {
  mockFrameHandles.length = 0;
});

describe("dynamic useFrameCallback activation", () => {
  it("starts and stops the core engine when static changes", async () => {
    const { rerender } = await renderHook(
      ({ isStatic }: { isStatic: boolean }) => {
        const data = useSharedValue([{ time: 1_700_000_000, value: 50 }]);
        const value = useSharedValue(50);
        return useLiveChartEngine({
          data,
          value,
          timeWindow: 30,
          smoothing: 0.08,
          static: isStatic,
        });
      },
      { initialProps: { isStatic: true } },
    );

    const handle = mockFrameHandles.at(-1)!;
    expect(handle.isActive).toBe(false);
    await rerender({ isStatic: false });
    expect(handle.isActive).toBe(true);
    await rerender({ isStatic: true });
    expect(handle.isActive).toBe(false);
  });

  it("gates engine frames from a SharedValue without stopping the handle", async () => {
    const { result } = await renderHook(() => {
      const data = useSharedValue([{ time: 1_700_000_000, value: 50 }]);
      const value = useSharedValue(50);
      const isFrameLoopActive = useSharedValue(false);
      const debugFrameStats = useSharedValue({
        frames: 0,
        published: 0,
        skipped: 0,
      });
      const engine = useLiveChartEngine({
        data,
        value,
        timeWindow: 30,
        smoothing: 0.08,
        isFrameLoopActive,
        debugFrameStats,
        nowOverride: 1000,
      });
      return { engine, isFrameLoopActive, debugFrameStats };
    });

    const handle = mockFrameHandles.at(-1)!;
    const frame = { timestamp: 1000, timeSincePreviousFrame: 16.67 };
    handle.callback(frame);
    expect(result.current.debugFrameStats.value.frames).toBe(0);

    result.current.isFrameLoopActive.value = true;
    handle.callback(frame);
    expect(result.current.debugFrameStats.value.frames).toBe(1);
    handle.callback(frame);
    expect(result.current.debugFrameStats.value).toMatchObject({
      frames: 2,
      skipped: 2,
      published: 0,
    });
    expect(handle.isActive).toBe(true);
  });

  it("starts and stops candle-width interpolation", async () => {
    const { rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useCandleWidthLerp(60, 0.08, enabled, true),
      { initialProps: { enabled: false } },
    );

    const handle = mockFrameHandles.at(-1)!;
    expect(handle.isActive).toBe(false);
    await rerender({ enabled: true });
    expect(handle.isActive).toBe(true);
    await rerender({ enabled: false });
    expect(handle.isActive).toBe(false);
  });

  it("gates candle-width interpolation without stopping its handle", async () => {
    const { result, rerender } = await renderHook(
      ({
        candleWidth,
        isActive,
      }: {
        candleWidth: number;
        isActive: boolean;
      }) => {
        const isFrameLoopActive = useSharedValue(false);
        const displayCandleWidth = useCandleWidthLerp(
          candleWidth,
          0.5,
          true,
          isActive,
          isFrameLoopActive,
        );
        return { displayCandleWidth, isFrameLoopActive };
      },
      { initialProps: { candleWidth: 60, isActive: false } },
    );

    const handle = mockFrameHandles.at(-1)!;
    await rerender({ candleWidth: 120, isActive: false });
    handle.callback({ timestamp: 1000, timeSincePreviousFrame: 16.67 });
    expect(result.current.displayCandleWidth.value).toBe(60);

    await rerender({ candleWidth: 120, isActive: true });
    handle.callback({ timestamp: 1016.67, timeSincePreviousFrame: 16.67 });
    expect(result.current.displayCandleWidth.value).toBe(60);

    result.current.isFrameLoopActive.value = true;
    handle.callback({ timestamp: 1033.34, timeSincePreviousFrame: 16.67 });
    expect(result.current.displayCandleWidth.value).toBe(60);
    expect(handle.isActive).toBe(true);
  });

  it("starts and stops marker projection", async () => {
    const { rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => {
        const data = useSharedValue([{ time: 1_700_000_000, value: 50 }]);
        const value = useSharedValue(50);
        const markers = useSharedValue<Marker[]>([]);
        const engine = useLiveChartEngine({
          data,
          value,
          timeWindow: 30,
          smoothing: 0.08,
        });
        return useMarkers(
          engine,
          DEFAULT_PADDING,
          markers,
          true,
          16,
          undefined,
          undefined,
          engine.data,
          enabled,
        );
      },
      { initialProps: { enabled: false } },
    );

    const markerHandle = mockFrameHandles.at(-1)!;
    expect(markerHandle.isActive).toBe(false);
    await rerender({ enabled: true });
    expect(markerHandle.isActive).toBe(true);
    await rerender({ enabled: false });
    expect(markerHandle.isActive).toBe(false);
  });

  it("starts and stops the trade-stream ticker", async () => {
    const { rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => {
        const data = useSharedValue([{ time: 1_700_000_000, value: 50 }]);
        const value = useSharedValue(50);
        const trades = useSharedValue<TradeEvent[]>([]);
        const engine = useLiveChartEngine({
          data,
          value,
          timeWindow: 30,
          smoothing: 0.08,
        });
        return useTradeStream(engine, trades, DEFAULT_PADDING, true, enabled);
      },
      { initialProps: { enabled: false } },
    );

    const tradeHandle = mockFrameHandles.at(-1)!;
    expect(tradeHandle.isActive).toBe(false);
    await rerender({ enabled: true });
    expect(tradeHandle.isActive).toBe(true);
    await rerender({ enabled: false });
    expect(tradeHandle.isActive).toBe(false);
  });
});
