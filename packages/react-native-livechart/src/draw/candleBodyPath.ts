import type { SkPathBuilder } from "@shopify/react-native-skia";
import type { CandleRect } from "./candle";

/**
 * Build one color's body batch. Skia copies addRect's coordinates synchronously,
 * so one plain rectangle can serve every sharp body in this rebuild. Keep it
 * local to the worklet invocation: derived initializers also run on React's
 * runtime, where mutating a previously serialized scratch object is unsafe.
 */
export function buildCandleBodyPath(
  builder: SkPathBuilder,
  bodies: CandleRect[],
  up: boolean,
  radius: number,
) {
  "worklet";
  const rect = { x: 0, y: 0, width: 0, height: 0 };
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (body.up !== up) continue;
    const rr = radius > 0 ? Math.min(radius, body.w / 2, body.h / 2) : 0;
    if (rr > 0) {
      builder.addRRect({
        rect: { x: body.x, y: body.y, width: body.w, height: body.h },
        rx: rr,
        ry: rr,
      });
    } else {
      rect.x = body.x;
      rect.y = body.y;
      rect.width = body.w;
      rect.height = body.h;
      builder.addRect(rect);
    }
  }
  // A fresh immutable path both resets the builder and notifies subscribers.
  return builder.detach();
}
