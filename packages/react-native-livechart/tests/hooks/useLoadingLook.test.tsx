import { renderHook } from "@testing-library/react-native";

import { resolveLoading } from "../../src/core/resolveConfig";
import { useLoadingLook } from "../../src/hooks/useLoadingLook";
import type { LoadingConfig } from "../../src/types";

type Props = { loading: boolean | LoadingConfig };

describe("useLoadingLook", () => {
  it("returns the live config while loading and keeps the last one after", async () => {
    const { result, rerender } = await renderHook(
      ({ loading }: Props) => useLoadingLook(resolveLoading(loading)),
      { initialProps: { loading: { amplitude: 22, axisLabels: false } } },
    );
    expect(result.current?.amplitude).toBe(22);
    expect(result.current?.axisLabels).toBe(false);

    await rerender({ loading: false });
    expect(result.current?.amplitude).toBe(22);
    expect(result.current?.axisLabels).toBe(false);

    await rerender({ loading: { color: "#f00" } });
    expect(result.current?.color).toBe("#f00");
    expect(result.current?.axisLabels).toBe(true);
  });

  it("is null before the chart has ever been loading", async () => {
    const { result } = await renderHook(() =>
      useLoadingLook(resolveLoading(false)),
    );
    expect(result.current).toBeNull();
  });

  it("settles on a config with NaN in it", async () => {
    const { result } = await renderHook(() =>
      useLoadingLook(resolveLoading({ amplitude: NaN })),
    );
    expect(result.current?.amplitude).toBeNaN();
  });

  it("does not re-render for an equal inline config", async () => {
    let renders = 0;
    const { rerender } = await renderHook(
      ({ loading }: Props) => {
        renders++;
        return useLoadingLook(resolveLoading(loading));
      },
      { initialProps: { loading: { amplitude: 22 } } },
    );
    const afterMount = renders;
    await rerender({ loading: { amplitude: 22 } });
    expect(renders).toBe(afterMount + 1);
  });
});
