import { Skia } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

/** A `Skia.PathBuilder` instance (typed without depending on a named export). */
export type ReanimatedPathBuilder = ReturnType<typeof Skia.PathBuilder.Make>;

/**
 * A `Skia.PathBuilder` made accessible inside Reanimated worklets.
 *
 * Unlike `SkPath`, an `SkPathBuilder` is **not** a Reanimated-shareable host
 * object: stashing one in a `useRef` and reading it from a `useDerivedValue`
 * worklet yields `undefined`. Wrapping it in a `SharedValue` is the supported
 * way to cross the JS→UI boundary, so the builder is created once on the JS
 * thread and reused every frame on the UI thread.
 *
 * Per-frame usage in a worklet:
 *
 *   const b = builder.value;
 *   b.moveTo(x, y); b.lineTo(...);   // emit verbs
 *   return b.detach();               // fresh immutable SkPath; resets the builder
 *
 * `detach()` returns a new `SkPath` and resets the builder for the next frame,
 * so the returned reference changes every frame and Reanimated notifies
 * subscribers without the two-path ping-pong the mutable-`SkPath` pool needs.
 */
export function usePathBuilder(): SharedValue<ReanimatedPathBuilder> {
  const builder = useMemo(() => Skia.PathBuilder.Make(), []);
  return useSharedValue(builder);
}

/** Like {@link usePathBuilder} but a fixed-length array of builders (e.g. one per series). */
export function usePathBuilders(
  count: number,
): SharedValue<ReanimatedPathBuilder[]> {
  const builders = useMemo(() => {
    const arr: ReanimatedPathBuilder[] = [];
    for (let i = 0; i < count; i++) arr.push(Skia.PathBuilder.Make());
    return arr;
  }, [count]);
  return useSharedValue(builders);
}
