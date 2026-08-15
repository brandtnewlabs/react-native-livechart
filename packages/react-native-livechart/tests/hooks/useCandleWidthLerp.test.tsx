import { act, renderHook } from "@testing-library/react-native";

type FrameInfo = { timeSincePreviousFrame: number | null };
type FrameCallback = (info: FrameInfo) => void;

const frameCallbacks: Array<{
  callback: FrameCallback;
  autostart: boolean | undefined;
}> = [];

jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return {
    ...actual,
    useDerivedValue: jest.fn((updater: () => unknown) => ({
      get: updater,
      get value() {
        return updater();
      },
    })),
    useFrameCallback: jest.fn(
      (callback: FrameCallback, autostart?: boolean) => {
        frameCallbacks.push({ callback, autostart });
        return { isActive: autostart, setActive: jest.fn() };
      },
    ),
  };
});

import { useCandleWidthLerp } from "../../src/hooks/useCandlePaths";

beforeEach(() => {
  frameCallbacks.length = 0;
});

it("holds width changes while inactive and applies the latest width when activated", async () => {
  const { result, rerender } = await renderHook(
    ({ width, active }: { width: number; active: boolean }) =>
      useCandleWidthLerp(width, 1, true, active),
    { initialProps: { width: 3_600, active: false } },
  );

  expect(frameCallbacks.at(-1)?.autostart).toBe(true);
  expect(result.current.get()).toBe(3_600);

  await rerender({ width: 86_400, active: false });
  await act(() => {
    frameCallbacks.at(-1)?.callback({ timeSincePreviousFrame: 16.67 });
  });
  expect(result.current.get()).toBe(3_600);

  await rerender({ width: 86_400, active: true });
  await act(() => {
    frameCallbacks.at(-1)?.callback({ timeSincePreviousFrame: 16.67 });
  });
  expect(result.current.get()).toBe(86_400);
});
