import { renderHook } from "@testing-library/react-native";
import { useLatestCallback } from "../../src/hooks/useLatestCallback";

describe("useLatestCallback", () => {
  it("keeps a retained dispatcher current across committed callback changes", async () => {
    const oldCallback = jest.fn((value: number) => value + 1);
    const newCallback = jest.fn((value: number) => value + 10);
    const { result, rerender } = await renderHook(
      ({ callback }: { callback: (value: number) => number }) => useLatestCallback(callback),
      { initialProps: { callback: oldCallback } },
    );
    const retained = result.current;
    expect(retained(2)).toBe(3);
    await rerender({ callback: newCallback });
    expect(result.current).toBe(retained);
    expect(retained(2)).toBe(12);
    expect(oldCallback).toHaveBeenCalledTimes(1);
    expect(newCallback).toHaveBeenCalledTimes(1);
  });
});
