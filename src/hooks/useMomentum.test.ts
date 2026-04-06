import { resolveMomentumProp, useMomentum } from "./useMomentum";

import type { LiveChartPoint } from "../types";
import type { SingleEngineState } from "../useLiveChartEngine";
import { renderHook } from "@testing-library/react-native";

const makeData = (values: number[]) =>
  values.map((v, i) => ({ time: i * 0.2, value: v }));

describe("resolveMomentumProp", () => {
  it("returns flat when disabled (false)", () => {
    const data = makeData([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(resolveMomentumProp(false, data)).toBe("flat");
  });

  it("returns forced value when string is passed", () => {
    expect(resolveMomentumProp("up", [])).toBe("up");
    expect(resolveMomentumProp("down", [])).toBe("down");
    expect(resolveMomentumProp("flat", [])).toBe("flat");
  });

  it("auto-detects up momentum when true", () => {
    const data = makeData([10, 10, 10, 10, 10, 11, 12, 13, 14, 15]);
    expect(resolveMomentumProp(true, data)).toBe("up");
  });

  it("auto-detects down momentum when true", () => {
    const data = makeData([15, 15, 15, 15, 15, 14, 13, 12, 11, 10]);
    expect(resolveMomentumProp(true, data)).toBe("down");
  });

  it("auto-detects flat when true and data is flat", () => {
    const data = makeData([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    expect(resolveMomentumProp(true, data)).toBe("flat");
  });

  it("returns flat when true but insufficient data", () => {
    const data = makeData([1, 2, 3]);
    expect(resolveMomentumProp(true, data)).toBe("flat");
  });
});

function engineWithData(data: LiveChartPoint[]): SingleEngineState {
  return {
    data: { value: data },
    value: { value: 0 },
    displayValue: { value: 0 },
    displayMin: { value: 0 },
    displayMax: { value: 10 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 0 },
  } as unknown as SingleEngineState;
}

describe("useMomentum", () => {
  it("defaults to auto-detect when prop is omitted", () => {
    const data = makeData([10, 10, 10, 10, 10, 11, 12, 13, 14, 15]).map(
      (p) => ({ ...p }),
    );
    const eng = engineWithData(data);
    const { result } = renderHook(() => useMomentum(eng));
    expect(result.current.value).toBe("up");
  });
});
