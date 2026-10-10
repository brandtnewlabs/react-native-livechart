import { act, renderHook } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";
import type { SeriesConfig } from "../../src/types";
import { projectSeriesPresentation, seriesPresentationSignature, useSeriesPresentation } from "../../src/hooks/useSeriesPresentation";

let mockPrepare: () => { signature: string; value: number };
let mockReact: (current: { signature: string; value: number }) => void;
const mockQueue: (() => void)[] = [];
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("react-native-reanimated"),
    useSharedValue: <T,>(initial: T) => React.useRef({
      value: initial,
      get() { return this.value; },
      set(value: T) { this.value = value; },
    }).current,
    useAnimatedReaction: (prepare: typeof mockPrepare, react: typeof mockReact) => {
      mockPrepare = prepare;
      mockReact = react;
    },
  };
});

jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets"),
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => {
    mockQueue.push(() => fn(...args));
  },
}));

function feed(value = 35) {
  const shared = {
    value: [{ id: "a", label: "Alpha", value, data: [{ time: 1, value }] }] as SeriesConfig[],
    get() { return this.value; },
    set(next: SeriesConfig[]) { this.value = next; },
  };
  return shared as SharedValue<SeriesConfig[]>;
}
function react() { mockReact(mockPrepare()); }
async function flush() {
  await act(() => { while (mockQueue.length) mockQueue.shift()!(); });
}
beforeEach(() => { mockQueue.length = 0; });

it("projects metadata without reading point histories, and excludes tick values from its signature", () => {
  const original = { id: "a", value: 35, label: "Alpha", style: "dashed", intervals: [3, 2], glow: true, kind: "derived", valueLabel: "35%" } as SeriesConfig;
  Object.defineProperty(original, "data", { get() { throw new Error("history must stay on UI"); } });
  const snapshot = projectSeriesPresentation([original]);
  expect(snapshot).toEqual([{ ...snapshot[0], id: "a", label: "Alpha", style: "dashed", intervals: [3, 2], glow: true, kind: "derived", valueLabel: "35%", value: 35, data: [] }]);
  const sig = seriesPresentationSignature(snapshot);
  expect(seriesPresentationSignature([{ ...snapshot[0], value: 99, data: [{ time: 2, value: 99 }] }])).toBe(sig);
  for (const change of [{ visible: false }, { label: "New" }, { kind: "outcome" as const }, { valueLabel: "36%" }, { strokeWidth: 3 }]) {
    expect(seriesPresentationSignature([{ ...snapshot[0], ...change }])).not.toBe(sig);
  }
});

it("bootstraps metadata and the largest finite layout sample before an asynchronous publication", async () => {
  const series = feed();
  series.set([...series.get(), { id: "b", value: -120, data: [] }, { id: "placeholder", value: NaN, data: [] }]);
  const { result } = await renderHook(() => useSeriesPresentation(series));
  expect(result.current.snapshot.map(s => s.id)).toEqual(["a", "b", "placeholder"]);
  expect(result.current.snapshot.every(s => s.data.length === 0)).toBe(true);
  expect(result.current.valueLayoutSample).toBe(-120);
  react();
  expect(mockQueue).toHaveLength(0);
});

it("publishes configuration and layout together, while ignoring ordinary live ticks", async () => {
  const series = feed();
  const { result } = await renderHook(() => useSeriesPresentation(series));
  const initial = result.current.snapshot;
  series.set([{ ...series.get()[0], value: 36 }]);
  react();
  expect(mockQueue).toHaveLength(0);
  expect(result.current.snapshot).toBe(initial);
  series.set([{ ...series.get()[0], value: 400, label: "New", visible: false }]);
  react();
  expect(mockQueue).toHaveLength(1);
  await flush();
  expect(result.current.valueLayoutSample).toBe(400);
  expect(result.current.snapshot[0]).toMatchObject({ label: "New", visible: false });
});

it("discards queued publications and stopped mappers when the series source changes", async () => {
  const a = feed(35);
  const b = feed(200);
  b.set([{ ...b.get()[0], id: "b" }]);
  const { result, rerender } = await renderHook<ReturnType<typeof useSeriesPresentation>, { series: SharedValue<SeriesConfig[]> }>(
    ({ series }) => useSeriesPresentation(series), { initialProps: { series: a } },
  );
  a.set([{ ...a.get()[0], label: "Stale" }]);
  react();
  const stoppedPrepare = mockPrepare;
  const stoppedReact = mockReact;
  await rerender({ series: b });
  stoppedReact(stoppedPrepare());
  await flush();
  expect(result.current.snapshot[0].id).toBe("b");
  expect(result.current.valueLayoutSample).toBe(200);
  await rerender({ series: a });
  expect(result.current.snapshot[0].label).toBe("Stale");
});
