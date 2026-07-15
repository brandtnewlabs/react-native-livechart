import { useEffect } from "react";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";

import type { SkFont } from "@shopify/react-native-skia";
import { MS_PER_FRAME_60FPS } from "../constants";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { measureFontTextWidth } from "../lib/measureFontTextWidth";
import { niceTimeInterval } from "../math/intervals";
import { lerp } from "../math/lerp";

export interface XAxisEntry {
  x: number;
  label: string;
  alpha: number;
}

const FADE = 0.08;

/**
 * Build a fresh label cache that re-formats every tick's `text` with
 * `formatTime`, preserving each entry's `alpha`. The cache (see {@link useXAxis})
 * formats each tick once for allocation reasons; this refreshes it when the
 * `formatTime` prop changes. Returns a NEW object (and new entry objects) rather
 * than mutating `cache` in place — the cache is also read inside the derived
 * value worklet, and mutating an already-serialized object from the JS thread
 * is unsafe under Reanimated's worklet model. Replacing the SharedValue with a
 * fresh object propagates cleanly to the UI thread.
 */
export function reformatXAxisLabels(
  cache: Record<number, { alpha: number; text: string }>,
  formatTime: (t: number) => string,
): Record<number, { alpha: number; text: string }> {
  const next: Record<number, { alpha: number; text: string }> = {};
  for (const key in cache) {
    next[key] = { alpha: cache[key].alpha, text: formatTime(Number(key) / 100) };
  }
  return next;
}

function xAxisKeyIsTarget(key: number, targetKeys: number[]): boolean {
  "worklet";
  for (let i = 0; i < targetKeys.length; i++) {
    if (targetKeys[i] === key) return true;
  }
  return false;
}

/** Insertion sort — worklet-safe, no callback functions. */
export function insertionSortByX(arr: XAxisEntry[]) {
  "worklet";
  for (let i = 1; i < arr.length; i++) {
    const item = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j].x > item.x) {
      /* istanbul ignore next -- worklet instrumentation under-counts swaps; insertionSort.test.ts covers behaviour */
      arr[j + 1] = arr[j];
      /* istanbul ignore next */
      j--;
    }
    arr[j + 1] = item;
  }
}

export function useXAxis(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  formatTime: (t: number) => string,
  font: SkFont,
) {
  const labelAlphas = useSharedValue<
    Record<number, { alpha: number; text: string }>
  >({});

  // A tick's key encodes its time, so its label is formatted once (below) and
  // never re-formatted per frame — an allocation optimization. That assumes
  // `formatTime` is stable; if the consumer swaps it at runtime, already-cached
  // labels would otherwise keep their old text until they scroll off-window.
  // Rebuild the cache with the new formatter (alphas preserved, so no fade
  // restart) whenever the formatter identity changes.
  useEffect(() => {
    labelAlphas.set(reformatXAxisLabels(labelAlphas.get(), formatTime));
  }, [formatTime, labelAlphas]);

  const xAxisEntries = useDerivedValue(() => {
    const w = engine.canvasWidth.get();
    const h = engine.canvasHeight.get();
    if (w === 0 || h === 0) return [] as XAxisEntry[];

    const now = engine.timestamp.get();
    // `displayWindow` animates toward `timeWindow`; it positions the labels so
    // the zoom slides smoothly. `targetWindow` is the settled destination and
    // decides *which* labels exist — see the note on ChartEngineLayout.timeWindow
    // and issue #126. Reading the animating window for selection makes the tick
    // cadence depend on the prior window (the asymptotic lerp lands just off the
    // `niceTimeInterval` bucket boundary, which the round window values sit on).
    const windowSecs = engine.displayWindow.get();
    const targetWindow = engine.timeWindow.get();
    const winStart = now - windowSecs;
    const targetWinStart = now - targetWindow;

    const chartLeft = padding.left;
    const chartRight = w - padding.right;
    const chartW = chartRight - chartLeft;
    /* istanbul ignore next -- defensive; Reanimated test mock rarely executes this guard with non-zero w/h */
    if (chartW <= 0) return [] as XAxisEntry[];

    const fadeZone = 50;

    // Pick interval from the *target* window duration so the cadence is stable
    // and independent of the window we're animating from.
    const targetPxPerSec = chartW / targetWindow;
    let interval = niceTimeInterval(targetWindow);
    while (interval * targetPxPerSec < 60 && interval < targetWindow) {
      interval *= 2;
    }

    // Generate target label keys (plain array, no Set — worklet-safe). Anchored
    // to the target window so the set is destination-stable; positioning below
    // still uses the animating `winStart`/`windowSecs` for a smooth transition.
    const firstTime =
      Math.ceil((targetWinStart - interval) / interval) * interval;
    const targetKeys: number[] = [];
    for (
      let t = firstTime;
      t <= now + interval && targetKeys.length < 30;
      t += interval
    ) {
      targetKeys.push(Math.round(t * 100));
    }

    // SharedValue payloads may be frozen after crossing the JS/UI boundary.
    // Work on a fresh cache (including fresh entries) so adding/removing keys
    // and updating alpha never mutates the serialized value returned by get().
    const previousAlphas = labelAlphas.get();
    const alphas: Record<number, { alpha: number; text: string }> = {};
    const previousKeys = Object.keys(previousAlphas);
    for (let i = 0; i < previousKeys.length; i++) {
      const key = Number(previousKeys[i]);
      const previous = previousAlphas[key];
      alphas[key] = { alpha: previous.alpha, text: previous.text };
    }
    let cacheChanged = false;

    // Create labels for new keys only. A key encodes its time, so the formatted
    // text never changes — re-formatting every frame would churn strings for
    // the GC. The cache itself is copied below to keep SharedValue payloads
    // immutable after they cross the JS/UI boundary.
    for (let i = 0; i < targetKeys.length; i++) {
      const key = targetKeys[i];
      if (!alphas[key]) {
        alphas[key] = { alpha: 0, text: formatTime(key / 100) };
        cacheChanged = true;
      }
    }

    // Update alphas
    const allKeys = Object.keys(alphas);
    for (let i = 0; i < allKeys.length; i++) {
      const key = Number(allKeys[i]);
      const label = alphas[key];
      const x = chartLeft + ((key / 100 - winStart) / windowSecs) * chartW;

      const fromLeft = x - chartLeft;
      const fromRight = chartRight - x;
      const fromEdge = Math.min(fromLeft, fromRight);
      const edgeAlpha =
        fromEdge >= fadeZone ? 1 : fromEdge <= 0 ? 0 : fromEdge / fadeZone;

      const target = xAxisKeyIsTarget(key, targetKeys) ? edgeAlpha : 0;
      let next = lerp(label.alpha, target, FADE, MS_PER_FRAME_60FPS);
      if (Math.abs(next - target) < 0.02) next = target;

      if (next < 0.01 && target === 0) {
        delete alphas[key];
        cacheChanged = true;
      } else {
        // The entry is already a private copy, so updating alpha cannot mutate
        // the serialized cache held by the SharedValue.
        if (label.alpha !== next) cacheChanged = true;
        label.alpha = next;
      }
    }

    if (cacheChanged) labelAlphas.set(alphas);

    // Collect visible labels
    const raw: XAxisEntry[] = [];
    const visibleKeys = Object.keys(alphas);
    for (let i = 0; i < visibleKeys.length; i++) {
      const key = Number(visibleKeys[i]);
      const label = alphas[key];
      /* istanbul ignore next -- alpha band skip is timing-sensitive under RTL + Reanimated mocks */
      if (label.alpha < 0.02) continue;
      const x = chartLeft + ((key / 100 - winStart) / windowSecs) * chartW;
      /* istanbul ignore next -- horizontal clip; x stays in-band for consistent time keys */
      if (x < chartLeft - 20 || x > chartRight) continue;
      raw.push({ x, label: label.text, alpha: label.alpha });
    }

    // Worklet-safe sort (no callback)
    insertionSortByX(raw);

    // Overlap resolution: keep higher-alpha label when two collide
    const drawn: XAxisEntry[] = [];
    for (let i = 0; i < raw.length; i++) {
      const entry = raw[i];
      const textW = measureFontTextWidth(font, entry.label);
      const left = entry.x - textW / 2;
      if (drawn.length > 0) {
        const prev = drawn[drawn.length - 1];
        const prevW = measureFontTextWidth(font, prev.label);
        const prevRight = prev.x + prevW / 2;
        if (left < prevRight + 8) {
          if (entry.alpha > prev.alpha) {
            drawn[drawn.length - 1] = entry;
          }
          continue;
        }
      }
      drawn.push(entry);
    }

    return drawn;
  });

  return { xAxisEntries, font };
}
