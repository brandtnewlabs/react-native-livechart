import { Gesture } from "react-native-gesture-handler";
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { ChartEngineLayout } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import {
  clampToBounds,
  nearestDraggableIndex,
  referenceValueOut,
} from "../math/referenceDrag";
import { referenceLineForm } from "../math/referenceLines";
import type { ReferenceLine } from "../types";
import {
  computeScrubDotY,
  computeValueAtY,
  snapPrice,
} from "./crosshairShared";

/** Vertical reach (px) around a line within which a touch grabs it. */
const GRAB_SLOP = 14;
/** Travel (px) that resolves drag (vertical) vs. fall-through (horizontal) intent. */
const DRAG_ACTIVATE_PX = 4;

/** Stable empty array so the handle / out-state worklets stay referentially stable
 *  (and the onDragIn/Out reaction never fires) when the feature is unused. */
const EMPTY: never[] = [];

/**
 * Builds the per-line **drag** gesture for draggable Form-A reference lines: grab a
 * line near its value-Y and drag vertically to set a new value, with optional
 * `snap` + `bounds` clamp. Mirrors the order-ticket reticle in {@link useCrosshair}
 * (value↔Y via `computeValueAtY` / `computeScrubDotY`, frozen value re-projected
 * each frame) but per line, writing into the shared `dragValues` array the layout
 * and overlays read.
 *
 * The pan uses `manualActivation`: it grabs only when a touch starts within
 * {@link GRAB_SLOP} of a draggable line **and** the motion is vertical — a
 * horizontal drag (scrub) or a touch off every line fails fast so the chart's other
 * gestures run (compose this ahead of them via `Gesture.Exclusive`).
 *
 * Also fires the per-line drag callbacks: `onChange` (de-duped during drag),
 * `onCommit` (on release), and `onDragIn` / `onDragOut` (value crossing the visible
 * range or a `bounds`, from a drag or the axis rescaling — edge-detected each frame).
 */
export function useReferenceDrag(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  lines: ReferenceLine[],
  dragValues: SharedValue<number[]>,
  dragActive: SharedValue<boolean[]>,
  enabled: boolean,
): ReturnType<typeof Gesture.Pan> {
  const anyDraggable =
    enabled &&
    lines.some((l) => l.draggable && referenceLineForm(l) === "line");
  const anyDragInOut = lines.some(
    (l) =>
      referenceLineForm(l) === "line" &&
      (l.onDragIn != null || l.onDragOut != null),
  );

  // Per-line handle Y (canvas px), index-aligned with `lines`; -1 when the line
  // isn't draggable or the canvas isn't laid out. Off-screen lines pin to the
  // nearest plot edge so they stay grabbable. Recomputed each frame (UI thread).
  /* istanbul ignore next -- worklet runs on the UI thread, not in Jest */
  const handleYs = useDerivedValue<number[]>(() => {
    if (!anyDraggable) return EMPTY;
    const ch = engine.canvasHeight.get();
    const dMin = engine.displayMin.get();
    const dMax = engine.displayMax.get();
    const top = padding.top;
    const bottom = ch - padding.bottom;
    const out: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (
        !l.draggable ||
        referenceLineForm(l) !== "line" ||
        l.value === undefined
      ) {
        out.push(-1);
        continue;
      }
      const v = dragValues.get()[i] ?? l.value;
      const y = computeScrubDotY(v, dMin, dMax, ch, top, padding.bottom);
      out.push(y < 0 ? -1 : Math.min(bottom, Math.max(top, y)));
    }
    return out;
  });

  const dragIndex = useSharedValue(-1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const activated = useSharedValue(false);
  const lastChange = useSharedValue(0);

  // JS-thread callback dispatch — closes over the latest `lines` each render.
  /* istanbul ignore next -- runs via scheduleOnRN from the UI-thread gesture */
  function emitChange(i: number, v: number) {
    lines[i]?.onChange?.(v);
  }
  /* istanbul ignore next -- runs via scheduleOnRN from the UI-thread gesture */
  function emitCommit(i: number, v: number) {
    lines[i]?.onCommit?.(v);
  }
  /* istanbul ignore next -- runs via scheduleOnRN from the UI-thread reaction */
  function emitDragOut(i: number, v: number) {
    lines[i]?.onDragOut?.(v);
  }
  /* istanbul ignore next -- runs via scheduleOnRN from the UI-thread reaction */
  function emitDragIn(i: number, v: number) {
    lines[i]?.onDragIn?.(v);
  }

  // onDragIn / onDragOut — edge-detect each line's "out of the watched interval"
  // state (from a drag or the axis rescaling under a fixed value).
  useAnimatedReaction(
    /* istanbul ignore next -- worklet runs on the UI thread, not in Jest */
    () => {
      if (!anyDragInOut) return EMPTY as boolean[];
      const dMin = engine.displayMin.get();
      const dMax = engine.displayMax.get();
      const out: boolean[] = [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (
          referenceLineForm(l) !== "line" ||
          l.value === undefined ||
          (l.onDragIn == null && l.onDragOut == null)
        ) {
          out.push(false);
          continue;
        }
        const v = dragValues.get()[i] ?? l.value;
        out.push(referenceValueOut(v, dMin, dMax, l.bounds));
      }
      return out;
    },
    /* istanbul ignore next -- worklet runs on the UI thread, not in Jest */
    (curr, prev) => {
      if (!prev || curr === prev) return;
      for (let i = 0; i < curr.length; i++) {
        if (prev[i] === undefined || curr[i] === prev[i]) continue;
        const l = lines[i];
        const v = dragValues.get()[i] ?? l.value ?? 0;
        if (curr[i]) scheduleOnRN(emitDragOut, i, v);
        else scheduleOnRN(emitDragIn, i, v);
      }
    },
    [lines, anyDragInOut],
  );

  // ── Gesture callbacks (UI-thread worklets — excluded from Jest coverage) ──────
  /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
  const onTouchesDown = (
    e: { changedTouches: { x: number; y: number }[] },
    manager: { fail: () => void },
  ) => {
    "worklet";
    const t = e.changedTouches[0];
    if (!t) return;
    const i = nearestDraggableIndex(handleYs.get(), t.y, GRAB_SLOP);
    if (i < 0) {
      manager.fail();
      return;
    }
    dragIndex.set(i);
    startX.set(t.x);
    startY.set(t.y);
  };

  /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
  const onTouchesMove = (
    e: { allTouches: { x: number; y: number }[] },
    manager: { activate: () => void; fail: () => void },
  ) => {
    "worklet";
    if (dragIndex.get() < 0) return;
    const t = e.allTouches[0];
    if (!t) return;
    const dx = Math.abs(t.x - startX.get());
    const dy = Math.abs(t.y - startY.get());
    if (dy > DRAG_ACTIVATE_PX && dy >= dx) manager.activate();
    else if (dx > DRAG_ACTIVATE_PX) manager.fail();
  };

  /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
  const onStart = () => {
    "worklet";
    const i = dragIndex.get();
    if (i < 0) return;
    activated.set(true);
    const arr = dragActive.get().slice();
    arr[i] = true;
    dragActive.set(arr);
    lastChange.set(dragValues.get()[i] ?? lines[i].value ?? 0);
  };

  /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
  const onUpdate = (e: { y: number }) => {
    "worklet";
    const i = dragIndex.get();
    if (i < 0) return;
    const l = lines[i];
    const raw = computeValueAtY(
      e.y,
      engine.displayMin.get(),
      engine.displayMax.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    );
    if (raw === null) return;
    const v = clampToBounds(snapPrice(raw, l.snap), l.bounds);
    const arr = dragValues.get().slice();
    arr[i] = v;
    dragValues.set(arr);
    if (v !== lastChange.get()) {
      lastChange.set(v);
      if (l.onChange) scheduleOnRN(emitChange, i, v);
    }
  };

  /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
  const onFinalize = () => {
    "worklet";
    const i = dragIndex.get();
    if (i >= 0 && activated.get()) {
      const v = dragValues.get()[i] ?? lines[i].value ?? 0;
      const arr = dragActive.get().slice();
      arr[i] = false;
      dragActive.set(arr);
      if (lines[i].onCommit) scheduleOnRN(emitCommit, i, v);
    }
    dragIndex.set(-1);
    activated.set(false);
  };

  return Gesture.Pan()
    .enabled(anyDraggable)
    .maxPointers(1)
    .manualActivation(true)
    .onTouchesDown(onTouchesDown)
    .onTouchesMove(onTouchesMove)
    .onStart(onStart)
    .onUpdate(onUpdate)
    .onFinalize(onFinalize);
}
