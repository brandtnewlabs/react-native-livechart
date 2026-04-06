import { revealRamp, useChartReveal } from "../../src/hooks/useChartReveal";

import { renderHook } from "@testing-library/react-native";
import { useSharedValue } from "react-native-reanimated";

// ─── revealRamp ───────────────────────────────────────────────────────────────

describe("revealRamp", () => {
  it("returns 0 at morphT=0 for any delay", () => {
    expect(revealRamp(0, 0)).toBe(0);
    expect(revealRamp(0, 0.3)).toBe(0);
    expect(revealRamp(0, 0.55)).toBe(0);
  });

  it("returns 1 at morphT=1 for any delay", () => {
    expect(revealRamp(1, 0)).toBe(1);
    expect(revealRamp(1, 0.15)).toBe(1);
    expect(revealRamp(1, 0.55)).toBe(1);
  });

  it("returns 0 before the delay threshold", () => {
    // delay=0.4: no reveal until morphT > 0.4
    expect(revealRamp(0.39, 0.4)).toBe(0);
  });

  it("starts revealing at the delay threshold", () => {
    // delay=0.4, morphT=0.4: (0.4-0.4)/(1-0.4)=0 → smoothstep(0)=0
    expect(revealRamp(0.4, 0.4)).toBe(0);
    // morphT slightly above delay → just started
    expect(revealRamp(0.41, 0.4)).toBeGreaterThan(0);
  });

  it("reaches 1 at morphT=1 regardless of delay", () => {
    for (const delay of [0, 0.1, 0.3, 0.55]) {
      expect(revealRamp(1, delay)).toBeCloseTo(1);
    }
  });

  it("is monotonically non-decreasing", () => {
    const delay = 0.15;
    let prev = revealRamp(0, delay);
    for (let t = 0.05; t <= 1; t += 0.05) {
      const cur = revealRamp(t, delay);
      expect(cur).toBeGreaterThanOrEqual(prev - 1e-10);
      prev = cur;
    }
  });

  it("returns 0 when delay >= 1", () => {
    expect(revealRamp(0.9, 1)).toBe(0);
    expect(revealRamp(1, 1)).toBe(0);
  });

  it("fill reveals before y-axis (lower delay)", () => {
    // fill delay=0.05, yAxis delay=0.15; at morphT=0.1 fill > 0, yAxis = 0
    expect(revealRamp(0.1, 0.05)).toBeGreaterThan(0);
    expect(revealRamp(0.1, 0.15)).toBe(0);
  });

  it("dot reveals before badge", () => {
    // dot delay=0.4, badge delay=0.55; at morphT=0.5: dot > 0, badge = 0
    expect(revealRamp(0.5, 0.4)).toBeGreaterThan(0);
    expect(revealRamp(0.5, 0.55)).toBe(0);
  });
});

// ─── useChartReveal (hook) ───────────────────────────────────────────────────

function useChartRevealTestSetup(
  loading: boolean,
  has: boolean,
  initialMorphT: number,
): ReturnType<typeof useChartReveal> {
  const hasData = useSharedValue(has);
  return useChartReveal(loading, hasData, initialMorphT);
}

describe("useChartReveal (hook)", () => {
  it("morphT starts at 0 when loading=true", () => {
    const { result } = renderHook(() => useChartRevealTestSetup(true, true, 0));
    expect(result.current.morphT.value).toBe(0);
  });

  it("morphT starts at 1 when loading=false and hasData", () => {
    const { result } = renderHook(() =>
      useChartRevealTestSetup(false, true, 1),
    );
    expect(result.current.morphT.value).toBe(1);
  });

  it("morphT starts at 0 when loading=false and no hasData", () => {
    const { result } = renderHook(() =>
      useChartRevealTestSetup(false, false, 0),
    );
    expect(result.current.morphT.value).toBe(0);
  });

  it("isLoading is true when loading=true", () => {
    const { result } = renderHook(() =>
      useChartRevealTestSetup(true, false, 0),
    );
    expect(result.current.isLoading.value).toBe(true);
  });

  it("isLoading is false when loading=false", () => {
    const { result } = renderHook(() =>
      useChartRevealTestSetup(false, true, 1),
    );
    expect(result.current.isLoading.value).toBe(false);
  });

  it("isEmpty when not loading and no hasData", () => {
    const { result } = renderHook(() =>
      useChartRevealTestSetup(false, false, 0),
    );
    expect(result.current.isEmpty.value).toBe(true);
  });

  it("isEmpty false when loading even if no hasData", () => {
    const { result } = renderHook(() =>
      useChartRevealTestSetup(true, false, 0),
    );
    expect(result.current.isEmpty.value).toBe(false);
  });

  it("isEmpty false when hasData", () => {
    const { result } = renderHook(() =>
      useChartRevealTestSetup(false, true, 1),
    );
    expect(result.current.isEmpty.value).toBe(false);
  });

  it("all stagger opacities are 0 when morphT=0", () => {
    const { result } = renderHook(() => useChartRevealTestSetup(true, true, 0));
    expect(result.current.yAxisOpacity.value).toBe(0);
    expect(result.current.fillOpacity.value).toBe(0);
    expect(result.current.dotOpacity.value).toBe(0);
    expect(result.current.badgeOpacity.value).toBe(0);
  });

  it("all stagger opacities are 1 when morphT=1", () => {
    const { result } = renderHook(() =>
      useChartRevealTestSetup(false, true, 1),
    );
    expect(result.current.yAxisOpacity.value).toBeCloseTo(1);
    expect(result.current.fillOpacity.value).toBeCloseTo(1);
    expect(result.current.dotOpacity.value).toBeCloseTo(1);
    expect(result.current.badgeOpacity.value).toBeCloseTo(1);
  });

  it("opacities stay 0 when loading=false but no hasData", () => {
    const { result } = renderHook(() =>
      useChartRevealTestSetup(false, false, 0),
    );
    expect(result.current.yAxisOpacity.value).toBe(0);
    expect(result.current.fillOpacity.value).toBe(0);
  });

  it("updates isLoading when loading prop changes", () => {
    const { result, rerender } = renderHook(
      (props: { loading: boolean }) => {
        const hasData = useSharedValue(true);
        return useChartReveal(props.loading, hasData, 0);
      },
      { initialProps: { loading: true } },
    );
    expect(result.current.isLoading.value).toBe(true);
    rerender({ loading: false });
    expect(result.current.isLoading.value).toBe(false);
  });

  it("resets to loading shell when loading becomes true again", () => {
    const { result, rerender } = renderHook(
      (props: { loading: boolean }) => {
        const hasData = useSharedValue(true);
        return useChartReveal(props.loading, hasData, props.loading ? 0 : 1);
      },
      { initialProps: { loading: false } },
    );
    expect(result.current.morphT.value).toBe(1);
    rerender({ loading: true });
    expect(result.current.isLoading.value).toBe(true);
    expect(result.current.isEmpty.value).toBe(false);
  });
});
