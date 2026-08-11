import { DEFAULT_PADDING } from "../../src/draw/line";
import type {
  ChartEngineScroll,
  SingleEngineState,
} from "../../src/core/useLiveChartEngine";
import type { LiveChartPoint } from "../../src/types";
import { renderHook } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";
import { useLiveDot } from "../../src/hooks/useLiveDot";

function engine(
  partial: Partial<{
    canvasWidth: number;
    canvasHeight: number;
    displayMin: number;
    displayMax: number;
    displayValue: number;
    displayWindow: number;
    timestamp: number;
    data: LiveChartPoint[];
    viewEnd: number | null;
  }>,
): SingleEngineState & ChartEngineScroll {
  return {
    data: { value: partial.data ?? [] },
    value: { value: 0 },
    displayValue: { value: partial.displayValue ?? 5 },
    displayMin: { value: partial.displayMin ?? 0 },
    displayMax: { value: partial.displayMax ?? 10 },
    displayWindow: { value: partial.displayWindow ?? 30 },
    canvasWidth: { value: partial.canvasWidth ?? 200 },
    canvasHeight: { value: partial.canvasHeight ?? 100 },
    timestamp: { value: partial.timestamp ?? 0 },
    viewEnd: { value: partial.viewEnd ?? null },
  } as unknown as SingleEngineState & ChartEngineScroll;
}

describe("useLiveDot", () => {
  it("offsets dot when width is zero", async () => {
    const { result } = await renderHook(() =>
      useLiveDot(engine({ canvasWidth: 0 }), DEFAULT_PADDING),
    );
    expect(result.current.dotX.value).toBe(-100);
  });

  it("centers vertically when val range is zero", async () => {
    const { result } = await renderHook(() =>
      useLiveDot(
        engine({
          displayMin: 5,
          displayMax: 5,
          displayValue: 5,
        }),
        DEFAULT_PADDING,
      ),
    );
    expect(result.current.dotY.value).toBeGreaterThan(0);
  });

  it("maps dot to chart coordinates", async () => {
    const { result } = await renderHook(() =>
      useLiveDot(engine({ displayValue: 5 }), DEFAULT_PADDING),
    );
    expect(result.current.dotX.value).toBeGreaterThan(0);
    expect(result.current.dotY.value).toBeGreaterThan(0);
  });

  it("tracks the edge value when followViewEdge is set", async () => {
    const edgeValue = { value: 9 } as unknown as SharedValue<number>;
    const { result } = await renderHook(() =>
      useLiveDot(
        engine({ displayValue: 5, displayMin: 0, displayMax: 10 }),
        DEFAULT_PADDING,
        edgeValue,
        true,
      ),
    );
    // dotY tracks edgeValue (9) — high in [0,10] → near the top, not the live
    // value (5) which would sit mid-range. chartH = 100-12-28 = 60.
    expect(result.current.dotY.value).toBeCloseTo(12 + ((10 - 9) / 10) * 60);
  });

  describe("trackWhileParked", () => {
    // Frozen window: [970, 1000] (timestamp 1000, displayWindow 30).
    // chartW = 200 - 12 - 12 = 176; plot right edge = 188.
    const parked = {
      timestamp: 1000,
      displayWindow: 30,
      viewEnd: 985,
    };

    it("stays pinned to the right edge while parked when off (default)", async () => {
      const { result } = await renderHook(() =>
        useLiveDot(
          engine({ ...parked, data: [{ time: 985, value: 5 }] }),
          DEFAULT_PADDING,
        ),
      );
      expect(result.current.dotX.value).toBe(188);
    });

    it("tracks the live point's x while parked", async () => {
      const { result } = await renderHook(() =>
        useLiveDot(
          engine({ ...parked, data: [{ time: 985, value: 5 }] }),
          DEFAULT_PADDING,
          undefined,
          false,
          true,
        ),
      );
      // x = left + ((985 - 970) / 30) * 176 = 12 + 88
      expect(result.current.dotX.value).toBeCloseTo(100);
    });

    it("hides the dot once the live point leaves the window (both sides)", async () => {
      const past = await renderHook(() =>
        useLiveDot(
          engine({ ...parked, data: [{ time: 960, value: 5 }] }),
          DEFAULT_PADDING,
          undefined,
          false,
          true,
        ),
      );
      expect(past.result.current.dotX.value).toBe(-100);

      const future = await renderHook(() =>
        useLiveDot(
          engine({ ...parked, data: [{ time: 1005, value: 5 }] }),
          DEFAULT_PADDING,
          undefined,
          false,
          true,
        ),
      );
      expect(future.result.current.dotX.value).toBe(-100);
    });

    it("hides the dot while parked with no data", async () => {
      const { result } = await renderHook(() =>
        useLiveDot(
          engine({ ...parked, data: [] }),
          DEFAULT_PADDING,
          undefined,
          false,
          true,
        ),
      );
      expect(result.current.dotX.value).toBe(-100);
    });

    it("hides the dot while parked with a degenerate window or plot width", async () => {
      const zeroWindow = await renderHook(() =>
        useLiveDot(
          engine({
            ...parked,
            displayWindow: 0,
            data: [{ time: 985, value: 5 }],
          }),
          DEFAULT_PADDING,
          undefined,
          false,
          true,
        ),
      );
      expect(zeroWindow.result.current.dotX.value).toBe(-100);

      // Canvas narrower than the horizontal padding → non-positive plot width.
      const noPlot = await renderHook(() =>
        useLiveDot(
          engine({
            ...parked,
            canvasWidth: 20,
            data: [{ time: 985, value: 5 }],
          }),
          DEFAULT_PADDING,
          undefined,
          false,
          true,
        ),
      );
      expect(noPlot.result.current.dotX.value).toBe(-100);
    });

    it("keeps the right-edge pin while following live (viewEnd null)", async () => {
      const { result } = await renderHook(() =>
        useLiveDot(
          engine({ timestamp: 1000, data: [{ time: 985, value: 5 }] }),
          DEFAULT_PADDING,
          undefined,
          false,
          true,
        ),
      );
      expect(result.current.dotX.value).toBe(188);
    });

    it("is ignored with followViewEdge (edge-pinned dot stays with its badge)", async () => {
      const edgeValue = { value: 9 } as unknown as SharedValue<number>;
      const { result } = await renderHook(() =>
        useLiveDot(
          engine({ ...parked, data: [{ time: 985, value: 5 }] }),
          DEFAULT_PADDING,
          edgeValue,
          true,
          true,
        ),
      );
      expect(result.current.dotX.value).toBe(188);
    });
  });
});
