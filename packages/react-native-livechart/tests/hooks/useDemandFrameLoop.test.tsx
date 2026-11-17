import { act, renderHook } from "@testing-library/react-native";

const mockMappers = new Map<number, { run: () => void; inputs: unknown[] }>();
let mockMapperId = 0;
function mockStartMapper(run: () => void, inputs: unknown[] = []) {
  const id = ++mockMapperId;
  mockMappers.set(id, { run, inputs });
  return id;
}
function mockStopMapper(id: number) { mockMappers.delete(id); }
function mockNotifyInput(input?: unknown) {
  mockMappers.forEach((mapper) => {
    if (input === undefined || mapper.inputs.includes(input)) mapper.run();
  });
}

jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  const { useEffect } = jest.requireActual("react");
  return {
    ...actual,
    startMapper: mockStartMapper,
    stopMapper: mockStopMapper,
    // Reanimated 4.7 native ignores explicit dependencies and derives them from
    // the worklet closures. Object.values also accepts the newer array closures.
    useAnimatedReaction: (prepare: (() => unknown) & { __closure?: object }, react: (() => void) & { __closure?: object }) => {
      const dependencies = [
        ...Object.values(prepare.__closure ?? {}),
        ...Object.values(react.__closure ?? {}),
      ];
      useEffect(() => {
        const id = mockStartMapper(() => { prepare(); react(); }, Object.values(prepare.__closure ?? {}));
        return () => mockStopMapper(id);
      }, dependencies);
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
  mockMappers.clear();
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

it.each(["object", "array"])("toggles the native input subscription without changing effect dependency size (%s closure)", async (shape) => {
  const input = { get: () => 42 };
  const prepare = Object.assign(jest.fn(() => input.get()), {
    __closure: shape === "array" ? [input] : { input },
  });
  const tick = jest.fn(() => false);
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const { rerender, unmount } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useDemandFrameLoop(enabled, prepare, tick),
      { initialProps: { enabled: true } },
    );
    for (const enabled of [false, true, false, true]) {
      await rerender({ enabled });
      expect(errors.mock.calls.filter((args) => String(args[0]).includes("changed size"))).toEqual([]);
      const before = prepare.mock.calls.length;
      await act(() => { mockNotifyInput(input); frames(30); });
      expect(prepare.mock.calls.length - before).toBe(enabled ? 1 : 0);
    }
    await unmount();
    expect(mockMappers.size).toBe(0);
    expect(errors.mock.calls.filter((args) => String(args[0]).includes("changed size"))).toEqual([]);
  } finally {
    errors.mockRestore();
  }
});

it("rebinds changed input sets and drops old subscriptions", async () => {
  const first = { get: () => 1 };
  const second = { get: () => 2 };
  const third = { get: () => 3 };
  const prepare = Object.assign(jest.fn(() => first.get()), { __closure: { first } });
  const replacement = Object.assign(jest.fn(() => second.get() + third.get()), { __closure: [second, third] });
  const tick = jest.fn(() => false);
  const { rerender, unmount } = await renderHook(
    ({ read }: { read: () => unknown }) => useDemandFrameLoop(true, read, tick),
    { initialProps: { read: prepare } },
  );
  await act(() => { frames(30); });
  await rerender({ read: replacement });
  expect(mockMappers.size).toBe(1);
  await act(() => { mockNotifyInput(first); });
  expect(prepare).not.toHaveBeenCalled();
  expect(replacement).not.toHaveBeenCalled();
  await act(() => { mockNotifyInput(second); mockNotifyInput(third); });
  expect(replacement).toHaveBeenCalledTimes(2);
  expect(queue.length).toBeGreaterThan(0);
  await unmount();
  expect(mockMappers.size).toBe(0);
});
