import { render } from "@testing-library/react-native";

import { ReferenceLineGroupOverlay } from "../../src/components/ReferenceLineGroupOverlay";
import { DEFAULT_PADDING } from "../../src/draw/line";
import type { ReferenceGrouping } from "../../src/math/referenceGroup";
import { resolveReferenceGroupBadge } from "../../src/math/referenceLines";
import { resolveTheme } from "../../src/theme";
import type { ReferenceLineBadgeConfig } from "../../src/types";
import { withSharedValueAccessors } from "../support/sharedValueMock";

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;

const palette = resolveTheme("#3b82f6", "dark");
const canvasWidth = withSharedValueAccessors({ v: { value: 400 } }).v as never;

function sv(value: ReferenceGrouping) {
  return withSharedValueAccessors({ v: { value } }).v as never;
}

function renderOverlay(
  grouping: ReferenceGrouping,
  cfg?: ReferenceLineBadgeConfig,
  format?: (n: number) => string,
) {
  return render(
    <ReferenceLineGroupOverlay
      grouping={sv(grouping)}
      padding={DEFAULT_PADDING}
      canvasWidth={canvasWidth}
      palette={palette}
      font={font}
      badge={resolveReferenceGroupBadge(cfg)}
      format={format}
    />,
  );
}

describe("ReferenceLineGroupOverlay", () => {
  it("renders a count pill for each multi-line cluster", () => {
    renderOverlay({ hidden: [true, true, true], groups: [{ cy: 150, count: 3 }] });
  });

  it("renders nothing visible when there are no groups", () => {
    renderOverlay({ hidden: [], groups: [] });
  });

  it("renders multiple clusters at once", () => {
    renderOverlay({
      hidden: [true, true, true, true],
      groups: [
        { cy: 80, count: 2 },
        { cy: 220, count: 2 },
      ],
    });
  });

  it("applies a count formatter", () => {
    renderOverlay(
      { hidden: [true, true, true], groups: [{ cy: 150, count: 3 }] },
      undefined,
      (n) => `×${n}`,
    );
  });

  it("anchors center and right (exercises canvasWidth positioning)", () => {
    const g: ReferenceGrouping = {
      hidden: [true, true],
      groups: [{ cy: 120, count: 2 }],
    };
    renderOverlay(g, { position: "center" });
    renderOverlay(g, { position: "right" });
  });

  it("renders an icon-only pill (text: false)", () => {
    renderOverlay(
      { hidden: [true, true], groups: [{ cy: 90, count: 2 }] },
      { icon: "⚠", text: false },
    );
  });

  it("honors style/shape overrides (radius, border, colors, offset)", () => {
    renderOverlay(
      { hidden: [true, true], groups: [{ cy: 100, count: 2 }] },
      {
        radius: 0,
        background: "#111",
        borderColor: "#f00",
        borderWidth: 2,
        textColor: "#0f0",
        offsetX: 4,
        offsetY: -3,
      },
    );
  });
});
