import { stackedTagAt, type ReferenceTagStack } from "../math/referenceTagStack";
import { useCallback, useMemo } from "react";
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
  referenceDragOwnsTouch,
  referenceValueOut,
  resolveDragIntent,
} from "../math/referenceDrag";
import { referenceLineForm } from "../math/referenceLines";
import type { ReferenceLine } from "../types";
import {
  computeValueAtY,
  pinnedPlotY,
  snapPriceOutward,
  snapPriceWithin,
} from "./crosshairShared";

import { useLatestCallback } from "./useLatestCallback";

/** Vertical reach (px) around a line within which a touch grabs it. */
const GRAB_SLOP = 14;
/** Travel (px) past which a grabbed line starts dragging (in either axis). */
const DRAG_ACTIVATE_PX = 4;

/** Stable empty array so the handle / out-state worklets stay referentially stable
 *  (and the onDragIn/Out reaction never fires) when the feature is unused. */
const EMPTY: never[] = [];

/**
 * The value a drag at canvas `y` gives `line` against the current range: the
 * price at that Y, snapped to `line.snap` and clamped to `line.bounds`. Null
 * before the canvas is laid out. `atFinger`: the value the finger sets (what the
 * range fits and `onChange` reports) — the nearest increment, rounded outward
 * once the finger is past the plot's edge so even a coarse `snap` can widen the
 * range. Otherwise the value the line is drawn and committed at — rounded inward
 * at the edges, so the line stays on the plot.
 */
function dragValueAtY(
  line: ReferenceLine,
  y: number,
  displayMin: number,
  displayMax: number,
  canvasHeight: number,
  padTop: number,
  padBottom: number,
  atFinger: boolean,
): number | null {
  "worklet";
  const raw = computeValueAtY(
    y,
    displayMin,
    displayMax,
    canvasHeight,
    padTop,
    padBottom,
  );
  if (raw === null) return null;
  const snapped = atFinger
    ? snapPriceOutward(
        raw,
        line.snap,
        y < padTop ? 1 : y > canvasHeight - padBottom ? -1 : 0,
      )
    : snapPriceWithin(raw, line.snap, displayMin, displayMax);
  return clampToBounds(snapped, line.bounds);
}

/**
 * Builds the per-line **drag** gesture for draggable Form-A reference lines: grab a
 * line near its value-Y and drag vertically to set a new value, with optional
 * `snap` + `bounds` clamp. Mirrors the order-ticket reticle in {@link useCrosshair}
 * (value↔Y via `computeValueAtY` / `pinnedPlotY`, frozen value re-projected
 * each frame) but per line, writing the value the finger sets into the shared
 * `dragValues` array (what the range fit reads). The overlays read `drawnValues`.
 *
 * The pan uses `manualActivation`: it grabs only when a touch starts within
 * {@link GRAB_SLOP} of a draggable line (and inside its `grabRange`, when it has
 * one), then **owns** that touch — any drag past
 * {@link DRAG_ACTIVATE_PX} (in either axis) drags the line. A touch off every line
 * fails fast so the chart's other gestures (scrub / scroll) run everywhere else
 * (compose this ahead of them via `Gesture.Exclusive`). Crucially it no longer
 * falls through to scrub on a horizontal start, so a drag begun on a line always
 * wins the race rather than dropping a scrub crosshair (#163).
 *
 * The dragged line stays under the finger: `drawnValues` re-maps it from the
 * finger's last Y whenever the range changes, or the plot is resized, while the
 * finger rests. `dragValues` keeps the value the finger last set. If another line
 * takes the dragged line's index mid-drag (lines added or removed before it, told
 * apart by `id`), the drag lets go: it moves and commits nothing, and
 * gives that line back its own value immediately. This touch stays cancelled if
 * the original line later returns to the grabbed index.
 *
 * Also fires the per-line drag callbacks: `onChange` (as the finger moves the
 * line, de-duped to value changes, and once more on release if the line was
 * drawn elsewhere), `onCommit` (on release, with the value under the finger),
 * and `onDragIn` / `onDragOut` (drawn value crossing the visible
 * range or a `bounds`, from a drag or the axis rescaling — edge-detected each frame).
 */
export function useReferenceDrag(
  engine: ChartEngineLayout,
  padding: ChartPadding,
  lines: ReferenceLine[],
  dragValues: SharedValue<number[]>,
  dragActive: SharedValue<boolean[]>,
  enabled: boolean,
  tagStack?: SharedValue<ReferenceTagStack>,
): {
  gesture: ReturnType<typeof Gesture.Pan>;
  /** True when a touch at (x,y) would grab a draggable line — lets the scrub
   *  gesture decline that press so it never drops a crosshair on a line (#163). */
  hitTest: (x: number, y: number) => boolean;
  /** `dragValues` with the line being dragged kept under the finger, re-mapped
   *  against the current range. What the lines' overlays, grouping and press
   *  hit-test read; the range fit reads `dragValues`. */
  drawnValues: SharedValue<number[]>;
} {
  const anyDraggable =
    enabled &&
    lines.some((l) => l.draggable && referenceLineForm(l) === "line");
  const anyDragInOut = lines.some(
    (l) =>
      referenceLineForm(l) === "line" &&
      (l.onDragIn != null || l.onDragOut != null),
  );

  // The gesture retains this container while committed line props change.
  // Reanimated updates it on the UI thread without rebuilding the recognizer.
  const linesSV = useDerivedValue(() => lines);

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
    if (bottom <= top) return EMPTY;
    const out: number[] = [];
    for (let i = 0; i < linesSV.get().length; i++) {
      const l = linesSV.get()[i];
      if (
        !l.draggable ||
        referenceLineForm(l) !== "line" ||
        l.value === undefined
      ) {
        out.push(-1);
        continue;
      }
      const v = dragValues.get()[i] ?? l.value;
      out.push(pinnedPlotY(v, dMin, dMax, ch, top, padding.bottom));
    }
    return out;
  });

  // Per-line grab x-ranges (`ReferenceLine.grabRange`), index-aligned with
  // `lines`; null = anywhere along the line. Read by the gesture worklets below,
  // through shared values so line updates do not rebuild the recognizer.
  const grabRanges = useDerivedValue(() => {
    const ranges: (ReferenceLine["grabRange"] | null)[] = [];
    for (const line of linesSV.get()) ranges.push(line.grabRange ?? null);
    return ranges;
  });

  const dragIndex = useSharedValue(-1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pointerOffsetY = useSharedValue(0);
  const activated = useSharedValue(false);
  const lastChange = useSharedValue(0);
  // The finger's latest Y during a drag, and the grabbed line's `id`: lines are
  // index-aligned, so a line added or removed before it mid-drag hands its index
  // to another line, and the drag must not move that one.
  const lastY = useSharedValue(0);
  const grabbedId = useSharedValue<string | undefined>(undefined);
  const { displayMin, displayMax, canvasHeight } = engine;

  // The dragged line under the finger. The range (live data, a range animation)
  // can move, or the plot be resized, while the finger rests, and the gesture maps
  // the finger only when it moves, so re-map from its last Y here. Being a
  // derived value, everything that reads it is ordered after it and draws this
  // frame's value. `dragValues` keeps the value the finger last set: the range
  // fits that one (fitting this one would let a line held near the plot edge push
  // the range out every frame) and `onChange` reports it.
  const drawnValues = useDerivedValue<number[]>(() => {
    const values = dragValues.get();
    const i = dragIndex.get();
    if (i < 0 || !activated.get()) return values;
    const l = linesSV.get()[i];
    if (l === undefined || l.id !== grabbedId.get()) return values;
    const v = dragValueAtY(
      l,
      lastY.get(),
      displayMin.get(),
      displayMax.get(),
      canvasHeight.get(),
      padding.top,
      padding.bottom,
      false,
    );
    if (v === null || v === values[i]) return values;
    const out = values.slice();
    out[i] = v;
    return out;
  });

  // Once the grabbed identity is lost, this touch cannot resume a drag if that
  // line later returns. Restore a replacement's own value and clear ownership.
  const clearDrag = useCallback(() => {
    "worklet";
    const i = dragIndex.get();
    const l = linesSV.get()[i];
    if (i >= 0 && activated.get()) {
      if (l !== undefined && l.id !== grabbedId.get()) {
        const own = l.value ?? 0;
        const values = dragValues.get();
        if (i < values.length && values[i] !== own) {
          const restored = values.slice();
          restored[i] = own;
          dragValues.set(restored);
        }
      }
      const active = dragActive.get();
      if (i < active.length && active[i]) {
        const next = active.slice();
        next[i] = false;
        dragActive.set(next);
      }
    }
    dragIndex.set(-1);
    activated.set(false);
  }, [
    activated,
    dragActive,
    dragIndex,
    dragValues,
    grabbedId,
    linesSV,
  ]);

  // Reordering/removal must also cancel while the finger is resting. Derived
  // drawing alone cannot reset the gesture state or the range-fit override.
  useAnimatedReaction(
    () => {
      const i = dragIndex.get();
      const l = linesSV.get()[i];
      return i >= 0 && (l === undefined || l.id !== grabbedId.get());
    },
    (invalid) => {
      if (invalid) clearDrag();
    },
  );

  // JS dispatchers always use the latest committed callback, and reject an
  // event queued for a line that has since been replaced.
  /* istanbul ignore next -- runs via scheduleOnRN from the UI-thread gesture */
  const emitChange = useLatestCallback((i: number, id: string | undefined, v: number) => {
    const line = lines[i];
    if (line && line.id === id) line.onChange?.(v);
  });
  /* istanbul ignore next -- runs via scheduleOnRN from the UI-thread gesture */
  const emitCommit = useLatestCallback((i: number, id: string | undefined, v: number) => {
    const line = lines[i];
    if (line && line.id === id) line.onCommit?.(v);
  });
  /* istanbul ignore next -- runs via scheduleOnRN from the UI-thread reaction */
  const emitDragOut = useLatestCallback((i: number, id: string | undefined, v: number) => {
    const line = lines[i];
    if (line && line.id === id) line.onDragOut?.(v);
  });
  /* istanbul ignore next -- runs via scheduleOnRN from the UI-thread reaction */
  const emitDragIn = useLatestCallback((i: number, id: string | undefined, v: number) => {
    const line = lines[i];
    if (line && line.id === id) line.onDragIn?.(v);
  });

  // onDragIn / onDragOut — edge-detect each line's "out of the watched interval"
  // state (from a drag or the axis rescaling under a fixed value).
  useAnimatedReaction(
    /* istanbul ignore next -- worklet runs on the UI thread, not in Jest */
    () => {
      if (!anyDragInOut) return EMPTY as boolean[];
      const dMin = engine.displayMin.get();
      const dMax = engine.displayMax.get();
      const out: boolean[] = [];
      for (let i = 0; i < linesSV.get().length; i++) {
        const l = linesSV.get()[i];
        if (
          referenceLineForm(l) !== "line" ||
          l.value === undefined ||
          (l.onDragIn == null && l.onDragOut == null)
        ) {
          out.push(false);
          continue;
        }
        const v = drawnValues.get()[i] ?? l.value;
        out.push(referenceValueOut(v, dMin, dMax, l.bounds));
      }
      return out;
    },
    /* istanbul ignore next -- worklet runs on the UI thread, not in Jest */
    (curr, prev) => {
      if (!prev || curr === prev) return;
      for (let i = 0; i < curr.length; i++) {
        if (prev[i] === undefined || curr[i] === prev[i]) continue;
        const l = linesSV.get()[i];
        const v = drawnValues.get()[i] ?? l.value ?? 0;
        if (curr[i]) scheduleOnRN(emitDragOut, i, l.id, v);
        else scheduleOnRN(emitDragIn, i, l.id, v);
      }
    },
  );

  const { gesture, hitTest } = useMemo(() => {
    const canDragTag = (index: number, x: number) => {
      "worklet";
      if (!linesSV.get()[index]?.draggable) return false;
      const range = grabRanges.get()[index];
      return !range || (x >= range[0] && x <= range[1]);
    };
    // ── Gesture callbacks (UI-thread worklets — excluded from Jest coverage) ──────
    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    const onTouchesDown = (
      e: { changedTouches: { x: number; y: number }[] },
      manager: { fail: () => void },
    ) => {
      "worklet";
      const t = e.changedTouches[0];
      if (!t) return;
      const tag = stackedTagAt(tagStack?.get().tags ?? [], t.x, t.y);
      const i = tag ? (linesSV.get()[tag.index]?.id === tag.lineId && canDragTag(tag.index, t.x) ? tag.index : -1) : nearestDraggableIndex(handleYs.get(), t.y, GRAB_SLOP, {
        x: t.x,
        ranges: grabRanges.get(),
      });
      const l = linesSV.get()[i];
      if (l === undefined) {
        manager.fail();
        return;
      }
      pointerOffsetY.set(tag ? t.y - tag.lineY : 0);
      dragIndex.set(i);
      grabbedId.set(l.id);
      startX.set(t.x);
      startY.set(t.y);
    };

    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    const onTouchesMove = (
      e: { allTouches: { x: number; y: number }[] },
      manager: { activate: () => void },
    ) => {
      "worklet";
      if (dragIndex.get() < 0) return;
      const t = e.allTouches[0];
      if (!t) return;
      // A line is grabbed → it owns the touch: any drag past the threshold drags it.
      // We don't fail on horizontal intent (which used to hand the touch to scrub) —
      // that let the scrub crosshair win the race even on a vertical drag started on
      // the line (#163). Scrub / scroll still run off a line's grab band.
      const intent = resolveDragIntent(
        t.x - startX.get(),
        t.y - startY.get(),
        DRAG_ACTIVATE_PX,
      );
      if (intent === "activate") manager.activate();
    };

    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    const onStart = (e: { y: number }) => {
      "worklet";
      const i = dragIndex.get();
      const l = linesSV.get()[i];
      // The line may be gone, or another have taken its index, since the grab.
      if (l === undefined || l.id !== grabbedId.get()) {
        clearDrag();
        return;
      }
      lastY.set(e.y - pointerOffsetY.get());
      activated.set(true);
      const arr = dragActive.get().slice();
      arr[i] = true;
      dragActive.set(arr);
      lastChange.set(dragValues.get()[i] ?? l.value ?? 0);
    };

    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    const onUpdate = (e: { y: number }) => {
      "worklet";
      const i = dragIndex.get();
      // Not after an `onStart` that let go (the line gone or replaced by then).
      if (i < 0 || !activated.get()) return;
      lastY.set(e.y - pointerOffsetY.get());
      const l = linesSV.get()[i];
      if (l === undefined || l.id !== grabbedId.get()) {
        clearDrag();
        return;
      }
      const v = dragValueAtY(
        l,
        e.y - pointerOffsetY.get(),
        displayMin.get(),
        displayMax.get(),
        canvasHeight.get(),
        padding.top,
        padding.bottom,
        true,
      );
      if (v === null) return;
      const arr = dragValues.get().slice();
      arr[i] = v;
      dragValues.set(arr);
      if (v !== lastChange.get()) {
        lastChange.set(v);
        if (l.onChange) scheduleOnRN(emitChange, i, l.id, v);
      }
    };

    /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
    const onFinalize = () => {
      "worklet";
      const i = dragIndex.get();
      const l = linesSV.get()[i];
      if (i >= 0 && activated.get() && l !== undefined) {
        if (l.id === grabbedId.get()) {
          // Commit what is drawn: the range may have moved under a still finger
          // since its last move. It stays there once released.
          const v =
            dragValueAtY(
              l,
              lastY.get(),
              displayMin.get(),
              displayMax.get(),
              canvasHeight.get(),
              padding.top,
              padding.bottom,
              false,
            ) ??
            dragValues.get()[i] ??
            l.value ??
            0;
          if (dragValues.get()[i] !== v) {
            const values = dragValues.get().slice();
            values[i] = v;
            dragValues.set(values);
          }
          // An `onChange`-only consumer ends where the line is drawn.
          if (v !== lastChange.get() && l.onChange) {
            scheduleOnRN(emitChange, i, l.id, v);
          }
          if (l.onCommit) scheduleOnRN(emitCommit, i, l.id, v);
        }
      }
      clearDrag();
    };

    // Hit-test shared with the scrub gesture: does this drag own the touch? The
    // scrub's `onStart` consults it to bail, so it never drops a crosshair on a
    // line even though it activates independently of this manual-activation pan
    // (the `Exclusive` priority alone doesn't hold scrub back — not while this
    // gesture is merely pressed, and not while it is dragging either). Once a line
    // is grabbed the answer is yes regardless of position: the scrub asks with its
    // touch-DOWN point, which a longer drag has carried the line away from, so the
    // geometric test alone said "no line here" and a crosshair opened mid-drag.
    // Otherwise it is the y-reach around the handles, along the whole line — or,
    // for a line with a `grabRange`, only inside it.
    /* istanbul ignore next -- worklet, runs on the UI thread */
    const hitTest = (x: number, y: number): boolean => {
      "worklet";
      if (!anyDraggable) return false;
      if (dragIndex.get() >= 0) return true;
      const tag = stackedTagAt(tagStack?.get().tags ?? [], x, y);
      if (tag) return linesSV.get()[tag.index]?.id === tag.lineId && canDragTag(tag.index, x);
      return referenceDragOwnsTouch(
        dragIndex.get(),
        handleYs.get(),
        y,
        GRAB_SLOP,
        {
          x,
          ranges: grabRanges.get(),
        },
      );
    };

    const gesture = Gesture.Pan()
      .enabled(anyDraggable)
      .maxPointers(1)
      .manualActivation(true)
      .onTouchesDown(onTouchesDown)
      .onTouchesMove(onTouchesMove)
      .onStart(onStart)
      .onUpdate(onUpdate)
      .onFinalize(onFinalize);

    return { gesture, hitTest };
  }, [
    activated,
    anyDraggable,
    canvasHeight,
    clearDrag,
    displayMax,
    displayMin,
    dragActive,
    dragIndex,
    dragValues,
    emitChange,
    emitCommit,
    grabRanges,
    grabbedId,
    handleYs,
    lastChange,
    lastY,
    linesSV,
    padding.bottom,
    padding.top,
    startX,
    startY,
    pointerOffsetY,
    tagStack,
  ]);

  return { gesture, hitTest, drawnValues };
}
