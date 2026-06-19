import { render } from "@testing-library/react-native";

import { ReferenceLineGroupOverlay } from "../../src/components/ReferenceLineGroupOverlay";
import { DEFAULT_PADDING } from "../../src/draw/line";
import type { ReferenceGrouping } from "../../src/math/referenceGroup";
import { resolveTheme } from "../../src/theme";
import { withSharedValueAccessors } from "../support/sharedValueMock";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;

const palette = resolveTheme("#3b82f6", "dark");

function sv(value: ReferenceGrouping) {
  return withSharedValueAccessors({ v: { value } }).v as never;
}

describe("ReferenceLineGroupOverlay", () => {
  it("renders a count pill for each multi-line cluster", () => {
    const grouping = sv({
      hidden: [true, true, true],
      groups: [{ cy: 150, count: 3 }],
    });
    render(
      <ReferenceLineGroupOverlay
        grouping={grouping}
        padding={DEFAULT_PADDING}
        palette={palette}
        font={font}
      />,
    );
  });

  it("renders nothing visible when there are no groups", () => {
    const grouping = sv({ hidden: [], groups: [] });
    render(
      <ReferenceLineGroupOverlay
        grouping={grouping}
        padding={DEFAULT_PADDING}
        palette={palette}
        font={font}
      />,
    );
  });

  it("renders multiple clusters at once", () => {
    const grouping = sv({
      hidden: [true, true, true, true],
      groups: [
        { cy: 80, count: 2 },
        { cy: 220, count: 2 },
      ],
    });
    render(
      <ReferenceLineGroupOverlay
        grouping={grouping}
        padding={DEFAULT_PADDING}
        palette={palette}
        font={font}
      />,
    );
  });
});
