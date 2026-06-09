import {
  DashPathEffect,
  Group,
  Path,
  Text as SkiaText,
  type SkFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ResolvedSegment } from "../core/resolveSegment";
import type { ChartPadding } from "../draw/line";
import { usePathBuilder } from "../hooks/usePathBuilder";
import { useSegmentBand } from "../hooks/useSegmentBand";

/**
 * Renders one chart segment: a translucent background band over its time range,
 * an optional dashed divider at the leading edge, and an optional label that
 * captions that divider (so the label shows only when the divider does). The band
 * fill color/opacity switch to the segment's highlight values while it's
 * highlighted (scrub-hover or `active`). Self-contained so callers can `.map()`
 * over a variable-length `segments` array, mirroring `ReferenceLineOverlay`.
 */
export function SegmentBandOverlay({
  engine,
  padding,
  segment,
  scrubX,
  scrubActive,
  font,
}: {
  engine: ChartEngineLayout;
  padding: ChartPadding;
  segment: ResolvedSegment;
  scrubX: SharedValue<number>;
  scrubActive: SharedValue<boolean>;
  font: SkFont;
}) {
  const layout = useSegmentBand(
    engine,
    padding,
    segment,
    scrubX,
    scrubActive,
    font,
  );

  const bandBuilder = usePathBuilder();
  const dividerBuilder = usePathBuilder();

  const bandPath = useDerivedValue(() => {
    const b = bandBuilder.value;
    const l = layout.value;
    if (l.visible) {
      b.moveTo(l.x1, l.yTop);
      b.lineTo(l.x2, l.yTop);
      b.lineTo(l.x2, l.yBottom);
      b.lineTo(l.x1, l.yBottom);
      b.close();
    }
    return b.detach();
  });

  const dividerPath = useDerivedValue(() => {
    const b = dividerBuilder.value;
    const l = layout.value;
    if (l.visible && segment.divider) {
      b.moveTo(l.x1, l.yTop);
      b.lineTo(l.x1, l.yBottom);
    }
    return b.detach();
  });

  // Highlight switches the band's fill color + opacity (scrub-hover or `active`).
  const bandOpacity = useDerivedValue(() => {
    const l = layout.value;
    if (!l.visible) return 0;
    return l.highlighted ? segment.highlightOpacity : segment.opacity;
  });
  const bandColor = useDerivedValue(() =>
    layout.value.highlighted ? segment.highlightColor : segment.color,
  );

  const dividerOpacity = useDerivedValue(() => (layout.value.visible ? 1 : 0));
  const labelOpacity = useDerivedValue(() => (layout.value.visible ? 1 : 0));
  const labelX = useDerivedValue(() => layout.value.labelX);
  const labelY = useDerivedValue(() => layout.value.labelY);
  const labelText = useDerivedValue(() => layout.value.label);

  return (
    <Group>
      <Group opacity={bandOpacity}>
        <Path path={bandPath} style="fill" color={bandColor} />
      </Group>

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
