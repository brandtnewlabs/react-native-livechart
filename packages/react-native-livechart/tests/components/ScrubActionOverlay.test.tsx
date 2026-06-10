import { render } from "@testing-library/react-native";
import React from "react";

import { ScrubActionOverlay } from "../../src/components/ScrubActionOverlay";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { DEFAULT_PADDING } from "../../src/draw/line";
import {
  computeActionBadgeLayout,
  computeTimeBadgeLayout,
  HIDDEN_ACTION_BADGE,
  type ActionBadgeLayout,
} from "../../src/hooks/crosshairShared";
import { resolveTheme } from "../../src/theme";

const palette = resolveTheme("#3b82f6", "dark");

const font = {
  getSize: () => 12,
  measureText: (s: string) => ({ x: 0, y: 0, width: s.length * 7, height: 12 }),
  getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
} as never;

function engine(): ChartEngineLayout {
  return {
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: 130 },
  } as unknown as ChartEngineLayout;
}

function Fixture({
  active,
  badge,
}: {
  active: boolean;
  badge: ActionBadgeLayout;
}) {
  return (
    <ScrubActionOverlay
      lockActive={{ value: active } as never}
      lockX={{ value: 200 } as never}
      lockY={{ value: 150 } as never}
      actionBadge={{ value: badge } as never}
      engine={engine()}
      padding={DEFAULT_PADDING}
      palette={palette}
      font={font}
      icon="+"
    />
  );
}

describe("ScrubActionOverlay", () => {
  // The Skia text mock renders SkiaText as a View (text passed as a prop, not
  // queryable), so these exercise the render branches without asserting on text;
  // the badge geometry/text is covered by the crosshairShared
  // `computeActionBadgeLayout` tests.
  it("renders the icon + price pill when a reticle is locked", () => {
    const badge = computeActionBadgeLayout(
      true,
      150,
      "64.20",
      "+",
      400,
      360,
      font,
      4,
      10,
      3,
      7,
    );
    render(<Fixture active badge={badge} />);
  });

  it("renders the icon-less branch when icon is empty", () => {
    const badge = computeActionBadgeLayout(true, 150, "64.20", "", 400, 360, font, 4, 10, 3, 7);
    render(
      <ScrubActionOverlay
        lockActive={{ value: true } as never}
        lockX={{ value: 200 } as never}
        lockY={{ value: 150 } as never}
        actionBadge={{ value: badge } as never}
        engine={engine()}
        padding={DEFAULT_PADDING}
        palette={palette}
        font={font}
        icon=""
      />,
    );
  });

  it("renders (hidden) without throwing when not locked", () => {
    render(<Fixture active={false} badge={HIDDEN_ACTION_BADGE} />);
  });

  it("renders the optional x-axis time badge when provided", () => {
    const badge = computeActionBadgeLayout(true, 150, "64.20", "+", 400, 360, font, 4, 10, 3, 7);
    const time = computeTimeBadgeLayout(true, 200, "13:00", 400, 291, font, 10, 3, 4);
    render(
      <ScrubActionOverlay
        lockActive={{ value: true } as never}
        lockX={{ value: 200 } as never}
        lockY={{ value: 150 } as never}
        actionBadge={{ value: badge } as never}
        timeBadge={{ value: time } as never}
        engine={engine()}
        padding={DEFAULT_PADDING}
        palette={palette}
        font={font}
        icon="+"
      />,
    );
  });

  it("honors color overrides", () => {
    const badge = computeActionBadgeLayout(true, 150, "64.20", "+", 400, 360, font, 4, 10, 3, 7);
    render(
      <ScrubActionOverlay
        lockActive={{ value: true } as never}
        lockX={{ value: 200 } as never}
        lockY={{ value: 150 } as never}
        actionBadge={{ value: badge } as never}
        engine={engine()}
        padding={DEFAULT_PADDING}
        palette={palette}
        font={font}
        icon="+"
        lineColor="#999999"
        background="#16a34a"
        iconColor="#ffffff"
      />,
    );
  });
});
