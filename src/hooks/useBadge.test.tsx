import { renderHook } from "@testing-library/react-native";
import { DEFAULT_PADDING } from "../draw/line";
import { resolveTheme } from "../theme";
import type { EngineState } from "../useLivelineEngine";
import { useBadge } from "./useBadge";

const font = {
  getSize: () => 12,
  getTextWidth: (s: string) => s.length * 7,
} as never;

function makeEngine(
  w: number,
  h: number,
): EngineState {
  return {
    data: { value: [] },
    value: { value: 1 },
    displayValue: { value: 50 },
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: w },
    canvasHeight: { value: h },
    timestamp: { value: 1000 },
  } as unknown as EngineState;
}

describe("useBadge", () => {
  const palette = resolveTheme("#3b82f6", "dark");

  it("returns empty path when canvas not laid out", () => {
    const { result } = renderHook(() =>
      useBadge(
        makeEngine(0, 0),
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
      ),
    );
    expect(result.current.value.text).toBe("");
  });

  it("builds badge with tail for default variant", () => {
    const { result } = renderHook(() =>
      useBadge(
        makeEngine(400, 300),
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "default",
        true,
      ),
    );
    expect(result.current.value.text).toBeTruthy();
  });

  it("uses minimal colors and no tail", () => {
    const { result } = renderHook(() =>
      useBadge(
        makeEngine(400, 300),
        DEFAULT_PADDING,
        palette,
        (v) => v.toFixed(2),
        font,
        "minimal",
        false,
      ),
    );
    expect(result.current.value.bgColor).toContain("255");
  });

  it("centers badge vertically when value range is zero", () => {
    const eng = {
      ...makeEngine(400, 300),
      displayMin: { value: 5 },
      displayMax: { value: 5 },
      displayValue: { value: 5 },
    } as unknown as EngineState;
    const { result } = renderHook(() =>
      useBadge(eng, DEFAULT_PADDING, palette, (v) => v.toFixed(2), font),
    );
    expect(result.current.value.text).toBeTruthy();
  });
});
