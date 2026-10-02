import { act, renderHook } from "@testing-library/react-native";

let mockNotifyInput: () => void = () => {};
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return {
    ...actual,
    useAnimatedReaction: (prepare: () => unknown, react: () => void) => {
      mockNotifyInput = () => { prepare(); react(); };
    },
  };
});
jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets"),
  scheduleOnUI: (work: () => void) => work(),
}));

import { useDemandFrameLoop } from "../../src/hooks/useDemandFrameLoop";

let queue: FrameRequestCallback[];
let now: number;
let raf: jest.SpyInstance;
function frame(dt = 1000 / 60) {
  now += dt;
  const work = queue;
  queue = [];
  work.forEach((callback) => callback(now));
}
function frames(count: number) { for (let i = 0; i < count; i++) frame(); }
beforeEach(() => {
  queue = [];
  now = 0;
  raf = jest.spyOn(global, "requestAnimationFrame").mockImplementation((callback) => {
    queue.push(callback);
    return queue.length;
  });
});
afterEach(() => raf.mockRestore());

it("stops requesting frames after settling and wakes once for an input change", async () => {
  const tick = jest.fn((_dt: number) => false);
  const prepare = jest.fn(() => 0);
  const { result } = await renderHook(() => useDemandFrameLoop(true, prepare, tick));
  await act(() => { frames(30); });
  expect(tick).toHaveBeenCalledTimes(10);
  expect(queue).toHaveLength(0);
  await act(() => { mockNotifyInput(); result.current(); result.current(); });
  expect(queue).toHaveLength(1);
  await act(() => { frame(60_000); });
  expect(tick.mock.calls.at(-1)).toEqual([1000 / 60]);
  await act(() => { frames(30); });
  expect(queue).toHaveLength(0);
});

it("keeps changing/continuous effects awake, then allows them to settle", async () => {
  let active = true;
  const tick = jest.fn(() => active);
  await renderHook(() => useDemandFrameLoop(true, () => active, tick));
  await act(() => { frames(120); });
  expect(tick).toHaveBeenCalledTimes(120);
  expect(queue).toHaveLength(1);
  active = false;
  await act(() => { frames(30); });
  expect(queue).toHaveLength(0);
});

it("invalidates queued callbacks when disabled, re-enabled, or unmounted", async () => {
  const tick = jest.fn(() => true);
  const prepare = () => 0;
  const { rerender, unmount } = await renderHook(
    ({ enabled }: { enabled: boolean }) => useDemandFrameLoop(enabled, prepare, tick),
    { initialProps: { enabled: true } },
  );
  await rerender({ enabled: false });
  await rerender({ enabled: true });
  await act(() => { frame(); });
  expect(tick).toHaveBeenCalledTimes(1); // stale generation did not tick
  await unmount();
  await act(() => { frame(); });
  expect(tick).toHaveBeenCalledTimes(1);
  expect(queue).toHaveLength(0);
});

it("does not start or wake a disabled loop", async () => {
  const tick = jest.fn(() => true);
  const { result } = await renderHook(() => useDemandFrameLoop(false, () => 0, tick));
  await act(() => { result.current(); mockNotifyInput(); frames(20); });
  expect(queue).toHaveLength(0);
  expect(tick).not.toHaveBeenCalled();
});
