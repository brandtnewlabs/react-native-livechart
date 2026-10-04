import { render } from "@testing-library/react-native";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { LiveChart } from "../src/components/LiveChart";
import * as tagOverlay from "../src/components/CustomReferenceLineOverlay";
import * as engineHooks from "../src/core/useLiveChartEngine";
import * as dragHooks from "../src/hooks/useReferenceDrag";
import * as groupingHooks from "../src/hooks/useReferenceLineGrouping";
import * as pressHooks from "../src/hooks/useReferenceLinePress";

// Plain SharedValue doubles and derived values computed on read, so the range
// fit's live values can be read back.
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const actual = jest.requireActual("react-native-reanimated");
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useSharedValue: <T,>(initial: T) => {
      const ref = React.useRef({
        value: initial,
        get() {
          return this.value;
        },
        set(next: T) {
          this.value = next;
        },
        addListener() {},
        removeListener() {},
      });
      return ref.current;
    },
    useDerivedValue: <T,>(fn: () => T) => {
      const latest = React.useRef(fn);
      latest.current = fn;
      return React.useMemo(
        () => ({
          get value() {
            return latest.current();
          },
          get() {
            return latest.current();
          },
        }),
        [],
      );
    },
    useFrameCallback: jest.fn(() => ({ setActive: jest.fn() })),
    useAnimatedReaction: jest.fn(),
  };
});

afterEach(() => jest.restoreAllMocks());

describe("draggable reference lines on LiveChart", () => {
  it("draw, group and hit-test at the drag's drawn values; the range fits the dragged values", async () => {
    // Where the drag draws its line (under the finger after the range moved),
    // apart from the value the finger set (`dragValues`, here the prop's 50).
    const drawn = {
      value: [120],
      get() {
        return this.value;
      },
      set() {},
    };
    const useReferenceDrag = dragHooks.useReferenceDrag;
    jest
      .spyOn(dragHooks, "useReferenceDrag")
      .mockImplementation((...args) => ({
        ...useReferenceDrag(...args),
        drawnValues: drawn as never,
      }));
    const engine = jest.spyOn(engineHooks, "useLiveChartEngine");
    const grouping = jest.spyOn(groupingHooks, "useReferenceLineGrouping");
    const press = jest.spyOn(pressHooks, "useReferenceLinePress");
    const tag = jest.spyOn(tagOverlay, "CustomReferenceLineOverlay");
    function Harness() {
      const data = useSharedValue([{ time: 1000, value: 40 }]);
      const value = useSharedValue(40);
      return (
        <LiveChart
          data={data}
          value={value}
          referenceLines={[{ id: "order", value: 50, draggable: true }]}
          renderReferenceLine={() => <View />}
        />
      );
    }
    await render(<Harness />);
    expect(
      grouping.mock.calls[grouping.mock.calls.length - 1][0].dragValues,
    ).toBe(drawn);
    expect(press.mock.calls[press.mock.calls.length - 1][8]).toBe(drawn);
    expect(tag.mock.calls[tag.mock.calls.length - 1][0].dragValues).toBe(drawn);
    const fit =
      engine.mock.calls[engine.mock.calls.length - 1][0].liveReferenceValues!;
    expect(fit.get()).toEqual([50]);
  });
});
