import type { ReactElement } from "react";
import { StyleSheet, View } from "react-native";

import type { ChartOverlayContext } from "../types";

/**
 * React Native overlay (NOT Skia) that floats a consumer's `renderOverlay` element
 * tree over the Skia canvas — the same escape-hatch model as
 * {@link CustomMarkerOverlay} / {@link CustomTooltipOverlay}. The consumer is
 * handed the {@link ChartOverlayContext} (worklet price↔pixel / time↔pixel
 * mappings + the live plot rect) and positions its own pieces on the UI thread.
 *
 * The element is wrapped full-bleed with `pointerEvents="box-none"` so empty areas
 * fall through to the chart's scrub gesture while an interactive leaf inside the
 * overlay can still receive touches. `render` is called on the JS thread per React
 * render; the returned tree then tracks the axis via the context's SharedValues.
 */
export function ChartOverlayLayer({
  render,
  context,
}: {
  render: (ctx: ChartOverlayContext) => ReactElement | null | undefined;
  context: ChartOverlayContext;
}) {
  const element = render(context);
  if (element == null) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {element}
    </View>
  );
}
