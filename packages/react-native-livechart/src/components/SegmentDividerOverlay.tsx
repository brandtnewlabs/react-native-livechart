import {
  DashPathEffect,
  Group,
  Path,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ResolvedSegment } from "../core/resolveSegment";
import type { ChartPadding } from "../draw/line";
import { usePathBuilder } from "../hooks/usePathBuilder";
import { useSegmentDivider } from "../hooks/useSegmentDivider";

/**
 * Renders one segment's edge markers: an optional dashed vertical divider at its
 * leading (`from`) edge and an optional label captioning that divider (so the
 * label shows only when the divider does). The scrub-focus emphasis is carried by
 * the line stroke itself (see `useSegmentLineGradient`), so this overlay draws no
 * fill. Self-contained so callers can `.map()` over a variable-length `segments`
 * array, mirroring `ReferenceLineOverlay`.
 */
export function SegmentDividerOverlay({
  engine,
  padding,
  segment,
  font,
}: {
  engine: ChartEngineLayout;
  padding: ChartPadding;
  segment: ResolvedSegment;
  font: SkFont;
}) {
  const layout = useSegmentDivider(engine, padding, segment, font);

  const dividerBuilder = usePathBuilder();

  const dividerPath = useDerivedValue(() => {
    const b = dividerBuilder.value;
    const l = layout.value;
    if (l.visible && segment.divider) {
      b.moveTo(l.x1, l.yTop);
      b.lineTo(l.x1, l.yBottom);
    }
    return b.detach();
  });

  const dividerOpacity = useDerivedValue(() => (layout.value.visible ? 1 : 0));
  const labelOpacity = useDerivedValue(() => (layout.value.visible ? 1 : 0));
  const labelX = useDerivedValue(() => layout.value.labelX);
  const labelY = useDerivedValue(() => layout.value.labelY);
  const labelText = useDerivedValue(() => layout.value.label);

  return (
    <Group>
      {segment.divider && (
        <Group opacity={dividerOpacity}>
          <Path
            path={dividerPath}
            style="stroke"
            strokeWidth={1}
            color={segment.dividerColor}
          >
            <DashPathEffect intervals={[4, 4]} />
          </Path>
        </Group>
      )}

      {/* The label captions the divider, so it only shows when the divider does. */}
      {segment.label && segment.divider ? (
        <Group opacity={labelOpacity}>
          <SkiaText
            x={labelX}
            y={labelY}
            text={labelText}
            font={font}
            color={segment.color}
          />
        </Group>
      ) : null}
    </Group>
  );
}
