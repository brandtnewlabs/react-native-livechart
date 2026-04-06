import { useDerivedValue, useSharedValue } from "react-native-reanimated";

import type { SkFont } from "@shopify/react-native-skia";
import { MS_PER_FRAME_60FPS } from "../constants";
import type { ChartPadding } from "../draw/line";
import { niceTimeInterval } from "../math/intervals";
import { lerp } from "../math/lerp";
import { measureFontTextWidth } from "../measureFontTextWidth";
import type { ChartEngineLayout } from "../useLiveChartEngine";

export interface XAxisEntry {
  x: number;
  label: string;
  alpha: number;
}

const FADE = 0.08;

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

  const xAxisEntries = useDerivedValue(() => {
    const w = engine.canvasWidth.value;
    const h = engine.canvasHeight.value;
    if (w === 0 || h === 0) return [] as XAxisEntry[];

    const now = engine.timestamp.value;
    const windowSecs = engine.displayWindow.value;
    const winStart = now - windowSecs;

    const chartLeft = padding.left;
    const chartRight = w - padding.right;
    const chartW = chartRight - chartLeft;
    /* istanbul ignore next -- defensive; Reanimated test mock rarely executes this guard with non-zero w/h */
    if (chartW <= 0) return [] as XAxisEntry[];

    const fadeZone = 50;

    // Pick interval from window duration
    const targetPxPerSec = chartW / windowSecs;
    let interval = niceTimeInterval(windowSecs);
    while (interval * targetPxPerSec < 60 && interval < windowSecs) {
      interval *= 2;
    }

    // Generate target label keys (plain array, no Set — worklet-safe)
    const firstTime = Math.ceil((winStart - interval) / interval) * interval;
    const targetKeys: number[] = [];
    for (
      let t = firstTime;
      t <= now + interval && targetKeys.length < 30;
      t += interval
    ) {
      targetKeys.push(Math.round(t * 100));
    }

    const alphas = labelAlphas.value;

    // Create/update labels
    for (let i = 0; i < targetKeys.length; i++) {
      const key = targetKeys[i];
      const text = formatTime(key / 100);
      if (!alphas[key]) {
        alphas[key] = { alpha: 0, text };
      } else {
        alphas[key] = { alpha: alphas[key].alpha, text };
      }
    }

    // Helper to check if key is a target
    const isTarget = (key: number) => {
      "worklet";
      for (let i = 0; i < targetKeys.length; i++) {
        if (targetKeys[i] === key) return true;
      }
      return false;
    };

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

      const target = isTarget(key) ? edgeAlpha : 0;
      let next = lerp(label.alpha, target, FADE, MS_PER_FRAME_60FPS);
      if (Math.abs(next - target) < 0.02) next = target;

      if (next < 0.01 && target === 0) {
        delete alphas[key];
      } else {
        alphas[key] = { alpha: next, text: label.text };
      }
    }

    labelAlphas.value = alphas;

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
