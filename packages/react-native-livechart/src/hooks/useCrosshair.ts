import { type SkFont } from "@shopify/react-native-skia";
import { Platform } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { BADGE_METRICS_DEFAULTS, X_AXIS_LABEL_OFFSET_Y } from "../constants";
import type { ResolvedScrubActionConfig } from "../core/resolveConfig";
import type { SingleEngineState } from "../core/useLiveChartEngine";
import { type ChartPadding } from "../draw/line";
import { interpolateAtTime } from "../math/interpolate";
import { pickCandleAtTime } from "../math/pickCandle";
import type {
  BadgeMetrics,
  CandlePoint,
  LiveChartPalette,
  ScrubActionPoint,
  ScrubPoint,
} from "../types";
import {
  computeActionBadgeLayout,
  computeCandleTooltipLayout,
  computeCrosshairOpacity,
  computeScrubDotY,
  computeScrubTime,
  computeTimeBadgeLayout,
  computeValueAtY,
  deriveCrosshairTooltipSingle,
  HIDDEN_ACTION_BADGE,
  HIDDEN_TIME_BADGE,
  pointInRect,
  snapPrice,
  type CrosshairState,
} from "./crosshairShared";

const ACTION_HIT_SLOP = 6;
const RETICLE_HIT = 14;

/**
 * Movement (px) a scrub-action *tap* (place / press / dismiss) may travel before
 * it's treated as a drag — the Tap's `maxDistance`. ~Touch slop, so a finger that
 * jitters a few px still registers as a tap rather than failing.
 */
const SCRUB_ACTION_TAP_SLOP = 10;

/**
 * Default press-hold (ms) before the live scrub / lock-adjust pan activates in
 * scrub-action ("order ticket") mode. A quick tap places or acts on the reticle;
 * the scrub crosshair only appears on a deliberate hold, so a tap never flashes
 * it. Overridden by an explicit `scrub.panGestureDelay`.
 */
const SCRUB_ACTION_PRESS_HOLD_MS = 200;

/** Clamp an X pixel to the plot's horizontal bounds. */
/* istanbul ignore next -- worklet, called only from UI-thread gesture handlers */
function clampPlotX(
  x: number,
  padLeft: number,
  canvasWidth: number,
  padRight: number,
): number {
  "worklet";
  return Math.min(canvasWidth - padRight, Math.max(padLeft, x));
}

/** Clamp a Y pixel to the plot's vertical bounds. */
/* istanbul ignore next -- worklet, called only from UI-thread gesture handlers */
function clampPlotY(
  y: number,
  padTop: number,
  canvasHeight: number,
  padBottom: number,
): number {
  "worklet";
  return Math.min(canvasHeight - padBottom, Math.max(padTop, y));
}

export type { CrosshairState, TooltipLayout } from "./crosshairShared";
export type { ScrubPoint };

  export {
    computeCandleTooltipLayout,
    computeCrosshairOpacity,
    computeScrubTime,
    computeTooltipLayout,
    computeTooltipLayoutMulti,
    deriveCrosshairTooltipSingle,
    deriveScrubValueSingle,
    HIDDEN_TOOLTIP
  } from "./crosshairShared";

export interface CrosshairCandleOpts {
  mode: "line" | "candle";
  candles?: SharedValue<CandlePoint[]>;
  liveCandle?: SharedValue<CandlePoint | null>;
  candleWidthSecs: number;
}

/**
 * Single-series crosshair + scrub. Use `useCrosshairSeries` for `LiveChartSeries`.
 */
export function useCrosshair(
  engine: SingleEngineState,
  padding: ChartPadding,
  _palette: LiveChartPalette,
  formatValue: (v: number) => string,
  formatTime: (t: number) => string,
  font: SkFont,
  enabled: boolean,
  onScrub?: (point: ScrubPoint | null) => void,
  candleOpts?: CrosshairCandleOpts,
  /** Press-and-hold delay (ms) before scrubbing activates. 0 = immediate. */
  panGestureDelay = 0,
  onGestureStart?: () => void,
  onGestureEnd?: () => void,
  /** Scrub-action ("order ticket") config; `null`/omitted disables lock mode. */
  scrubAction?: ResolvedScrubActionConfig | null,
  onScrubAction?: (point: ScrubActionPoint) => void,
  /** Badge geometry (gutter margins / pad) for the action pill. */
  badgeMetrics: BadgeMetrics = BADGE_METRICS_DEFAULTS,
  /**
   * Worklet predicate: true when a tap at (x, y) lands on another interactive
   * overlay (a marker, or a pressable reference-line badge). The scrub-action tap
   * defers to it (no reticle placed) so that overlay's tap handler can act.
   * Omitted when nothing coexists.
   */
  deferTapHit?: (x: number, y: number) => boolean,
  /** Where the tooltip pill sits relative to the scrub line. Default `"side"`. */
  tooltipPlacement: "side" | "top" | "bottom" | "point" = "side",
  /** Render the value row in the default tooltip. Default `true`. */
  tooltipShowValue = true,
  /** Render the time row in the default tooltip. Default `true`. */
  tooltipShowTime = true,
  /** Gap (px) between the tooltip and the plot edge it's pinned to. Default `8`. */
  tooltipMargin = 8,
  /**
   * Height (px) of a bottom band to exclude from scrub recognition — the
   * axis-drag "grab the time ruler" strip, so a drag there scrolls instead of
   * scrubbing (and a vertical drag falls through to the parent). `0` = no
   * exclusion (the default; scrub covers the whole plot).
   */
  scrubBottomExclude = 0,
): CrosshairState {
  const scrubX = useSharedValue(-1);
  const scrubActive = useSharedValue(false);
  // Tracks whether the active scrub phase actually began, so a tap that never
  // activates doesn't emit a spurious onGestureEnd.
  const gestureStarted = useSharedValue(false);
  // Where the crosshair line should start (canvas Y) so it stops at a top-pinned
  // custom tooltip instead of running through it. -1 = no top tooltip → the line
  // starts at padding.top. Written by CustomTooltipOverlay, read by CrosshairOverlay.
  const tooltipLineTop = useSharedValue(-1);

  // Scrub-action lock state. Created unconditionally (hooks must be), but the
  // lock gestures are only wired by the controller when `scrubAction` is set.
  const lockActive = useSharedValue(false);
  const lockX = useSharedValue(-1);
  // The chosen PRICE is the source of truth (frozen on place/drag); the reticle's
  // screen Y is re-derived from it each frame (see `lockY` below) so the level
  // tracks the price as the axis rescales instead of drifting under a fixed pixel.
  const lockPriceValue = useSharedValue<number | null>(null);
  const hasScrubAction = scrubAction != null;
  const hasOnScrubAction = onScrubAction != null;
  const dismissOnTapOutside = scrubAction?.dismissOnTapOutside ?? false;
  const snapIncrement = scrubAction?.snap;
  const actionIcon = scrubAction?.icon ?? "+";
  const actionShowText = scrubAction?.text ?? true;
  const hasTimeBadge = scrubAction?.timeBadge ?? false;

  const scrubTime = useDerivedValue(() =>
    computeScrubTime(
      scrubActive.get(),
      scrubX.get(),
      padding,
      engine.canvasWidth.get(),
      engine.timestamp.get(),
      engine.displayWindow.get(),
    ),
  );

  const isCandleMode = candleOpts?.mode === "candle";
  const candlesSV = candleOpts?.candles;
  const liveCandleSV = candleOpts?.liveCandle;
  const candleWidthSecs = candleOpts?.candleWidthSecs ?? 60;

  /* istanbul ignore next -- worklet */
  const scrubCandle = useDerivedValue(() => {
    if (
      !isCandleMode ||
      !candlesSV ||
      !scrubActive.get() ||
      scrubTime.get() < 0
    )
      return null;
    return pickCandleAtTime(
      candlesSV.get(),
      liveCandleSV?.get() ?? null,
      scrubTime.get(),
      candleWidthSecs,
    );
  });

  /* istanbul ignore next -- worklet */
  const scrubValue = useDerivedValue(() => {
    if (!scrubActive.get() || scrubTime.get() < 0) return null;
    if (isCandleMode) {
      return scrubCandle.get()?.close ?? null;
    }
    return interpolateAtTime(engine.data.get(), scrubTime.get());
  });

  const crosshairOpacity = useDerivedValue(() =>
    computeCrosshairOpacity(
      scrubActive.get(),
      scrubX.get(),
      engine.canvasWidth.get(),
      padding.right,
    ),
  );

  // Y pixel of the scrub intersection — used by the selection dot. -1 when
  // there's no value to mark.
  const scrubDotY = useDerivedValue(() =>
    computeScrubDotY(
      scrubValue.get(),
      engine.displayMin.get(),
      engine.displayMax.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    ),
  );

  // Monospace advance width, measured once per render (not per scrub frame) so
  // the tooltip layout worklet can size text by character count instead of a
  // per-frame Skia measureText.
  const monoCharWidth = font.measureText("0").width;

  const tooltipLayout = useDerivedValue(() => {
    if (isCandleMode) {
      return computeCandleTooltipLayout(
        scrubActive.get(),
        scrubX.get(),
        scrubCandle.get(),
        scrubTime.get(),
        padding,
        engine.canvasWidth.get(),
        formatValue,
        formatTime,
        font,
        monoCharWidth,
      );
    }
    return deriveCrosshairTooltipSingle(
      scrubActive.get(),
      scrubX.get(),
      scrubTime.get(),
      scrubValue.get(),
      padding,
      engine.canvasWidth.get(),
      formatValue,
      formatTime,
      font,
      monoCharWidth,
      tooltipPlacement,
      tooltipShowValue,
      tooltipShowTime,
      engine.canvasHeight.get(),
      tooltipMargin,
      scrubDotY.get(),
    );
  });

  // ── Scrub-action lock derivations ──────────────────────────────────────────
  // Reported price = the frozen chosen price, optionally snapped. Independent of
  // the display range (the point of freezing it), so the badge readout and the
  // onScrubAction payload stay stable while the chart auto-rescales. Null until a
  // reticle is placed.
  /* istanbul ignore next -- worklet (locked branch only runs on the UI thread) */
  const lockPrice = useDerivedValue(() => {
    if (!lockActive.get()) return null;
    const p = lockPriceValue.get();
    return p === null ? null : snapPrice(p, snapIncrement);
  });

  // Screen Y of the locked level, DERIVED from the frozen price each frame so the
  // line + badge track the chosen price as displayMin/Max move (rather than the
  // price drifting under a pixel-fixed reticle). Pins to the plot edge when the
  // price scrolls out of the visible range; -1 until placed / laid out.
  /* istanbul ignore next -- worklet (locked branch only runs on the UI thread) */
  const lockY = useDerivedValue(() => {
    const p = lockPriceValue.get();
    const ch = engine.canvasHeight.get();
    if (p === null || ch - padding.top - padding.bottom <= 0) return -1;
    const y = computeScrubDotY(
      p,
      engine.displayMin.get(),
      engine.displayMax.get(),
      ch,
      padding.top,
      padding.bottom,
    );
    return clampPlotY(y, padding.top, ch, padding.bottom);
  });

  const lockTime = useDerivedValue(() =>
    computeScrubTime(
      lockActive.get(),
      lockX.get(),
      padding,
      engine.canvasWidth.get(),
      engine.timestamp.get(),
      engine.displayWindow.get(),
    ),
  );

  /* istanbul ignore next -- worklet */
  const lockCandle = useDerivedValue(() => {
    if (!isCandleMode || !candlesSV || !lockActive.get() || lockTime.get() < 0)
      return null;
    return pickCandleAtTime(
      candlesSV.get(),
      liveCandleSV?.get() ?? null,
      lockTime.get(),
      candleWidthSecs,
    );
  });

  // Right-gutter action-badge layout — also the tap hit rect. Hidden when not locked.
  /* istanbul ignore next -- worklet (locked branch only runs on the UI thread) */
  const actionBadge = useDerivedValue(() => {
    const price = lockPrice.get();
    if (price === null) return HIDDEN_ACTION_BADGE;
    return computeActionBadgeLayout(
      lockActive.get(),
      lockY.get(),
      actionShowText ? formatValue(price) : "",
      actionIcon,
      engine.canvasWidth.get(),
      engine.canvasWidth.get() - padding.right,
      font,
      badgeMetrics.marginEdge,
      badgeMetrics.padX,
      badgeMetrics.padY,
    );
  });

  // X-axis time badge at the reticle (opt-in). Hidden unless enabled + locked.
  /* istanbul ignore next -- worklet (locked branch only runs on the UI thread) */
  const timeBadge = useDerivedValue(() => {
    if (!hasTimeBadge || !lockActive.get()) return HIDDEN_TIME_BADGE;
    const t = lockTime.get();
    if (t < 0) return HIDDEN_TIME_BADGE;
    return computeTimeBadgeLayout(
      lockActive.get(),
      lockX.get(),
      formatTime(t),
      engine.canvasWidth.get(),
      engine.canvasHeight.get() - padding.bottom + X_AXIS_LABEL_OFFSET_Y,
      font,
      badgeMetrics.padX,
      badgeMetrics.padY,
      badgeMetrics.marginEdge,
    );
  });

  /* istanbul ignore next -- invoked only via scheduleOnRN from UI-thread gesture */
  function handleScrubAction(
    price: number,
    time: number,
    x: number,
    y: number,
    candleJson: string | null,
  ) {
    const candle: CandlePoint | undefined = candleJson
      ? (JSON.parse(candleJson) as CandlePoint)
      : undefined;
    onScrubAction?.({ price, time, x, y, candle });
  }

  /* istanbul ignore next -- invoked only via scheduleOnRN from UI-thread gesture */
  function handleScrub(
    x: number,
    y: number,
    time: number,
    value: number,
    candleJson: string | null,
  ) {
    const candle: CandlePoint | undefined = candleJson
      ? (JSON.parse(candleJson) as CandlePoint)
      : undefined;
    onScrub?.({ time, value, x, y, candle });
  }

  /* istanbul ignore next */
  function handleScrubEnd() {
    onScrub?.(null);
  }

  /* istanbul ignore next */
  function handleGestureStart() {
    onGestureStart?.();
  }

  /* istanbul ignore next */
  function handleGestureEnd() {
    onGestureEnd?.();
  }

  const hasOnScrub = onScrub != null;
  const hasOnGestureStart = onGestureStart != null;
  const hasOnGestureEnd = onGestureEnd != null;

  useAnimatedReaction(
    () => {
      "worklet";
      if (!hasOnScrub) return "__idle__";
      if (!scrubActive.get()) return "__inactive__";
      const time = scrubTime.get();
      const val = scrubValue.get();
      const x = scrubX.get();
      if (val === null || time < 0) return "__pending__";
      const chartW = engine.canvasWidth.get() - padding.left - padding.right;
      if (chartW <= 0) return "__pending__";
      const dotY = computeScrubDotY(
        val,
        engine.displayMin.get(),
        engine.displayMax.get(),
        engine.canvasHeight.get(),
        padding.top,
        padding.bottom,
      );
      let candleJson: string | null = null;
      if (isCandleMode) {
        const c = scrubCandle.get();
        if (c) candleJson = JSON.stringify(c);
      }
      return JSON.stringify([time, val, x, dotY, candleJson]);
    },
    (curr, prev) => {
      "worklet";
      if (!hasOnScrub) return;
      if (
        curr === "__idle__" ||
        curr === "__inactive__" ||
        curr === "__pending__"
      ) {
        return;
      }
      if (curr === prev) return;
      const row = JSON.parse(curr) as [
        number,
        number,
        number,
        number,
        string | null,
      ];
      scheduleOnRN(handleScrub, row[2], row[3], row[0], row[1], row[4]);
    },
  );

  // In scrub-action mode the live scrub / lock-adjust requires a deliberate
  // press-hold: a quick tap (even a sloppy one that travels a few px) places or
  // acts on the reticle, and must never flash the crosshair. The press-hold is
  // what gates activation — and because movement during the hold *fails* the pan
  // (RNGH), a tap can't trip the scrub by moving. Honor an explicit
  // `scrub.panGestureDelay`, else default to the hold. Outside scrub-action the
  // pan keeps its normal (no-hold) activation unless a delay was set.
  const longPressMs =
    hasScrubAction && panGestureDelay <= 0
      ? SCRUB_ACTION_PRESS_HOLD_MS
      : panGestureDelay;

  let gesture = Gesture.Pan()
    // Scrub-action: minDistance 0 — the press-hold above is the sole activator
    // (movement during the hold fails the pan), so the crosshair never appears
    // from a tap's travel. The Tap (maxDistance SCRUB_ACTION_TAP_SLOP) owns quick
    // gestures; only a held press becomes a scrub/adjust drag.
    .minDistance(!hasScrubAction && Platform.OS === "android" ? 10 : 0)
    .activateAfterLongPress(longPressMs)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    // Start scrubbing on ACTIVE (onStart), not on touch-down (onBegin):
    // `activateAfterLongPress` only delays activation, so onBegin still fires
    // immediately — using it would scrub instantly and ignore panGestureDelay,
    // and leave scrubActive stuck for taps that never reach the long-press.
    .onStart(
      /* istanbul ignore next */ (e) => {
        "worklet";
        if (!enabled) return;
        // Scrub-action: once a reticle is placed, drag adjusts it (2D — the Y is
        // the price). The ephemeral live-scrub never engages, so scrubActive
        // stays false and the live crosshair hides itself.
        if (hasScrubAction && lockActive.get()) {
          lockX.set(
            clampPlotX(e.x, padding.left, engine.canvasWidth.get(), padding.right),
          );
          // Freeze the chosen price (value at the pointer Y); the line's Y is
          // re-derived from it so the level stays put in PRICE as the axis rescales.
          {
            const p = computeValueAtY(
              e.y,
              engine.displayMin.get(),
              engine.displayMax.get(),
              engine.canvasHeight.get(),
              padding.top,
              padding.bottom,
            );
            if (p !== null) lockPriceValue.set(p);
          }
          return;
        }
        scrubX.set(e.x);
        scrubActive.set(true);
        gestureStarted.set(true);
        if (hasOnGestureStart) scheduleOnRN(handleGestureStart);
      },
    )
    .onUpdate(
      /* istanbul ignore next */ (e) => {
        "worklet";
        if (!enabled) return;
        if (hasScrubAction && lockActive.get()) {
          lockX.set(
            clampPlotX(e.x, padding.left, engine.canvasWidth.get(), padding.right),
          );
          // Freeze the chosen price (value at the pointer Y); the line's Y is
          // re-derived from it so the level stays put in PRICE as the axis rescales.
          {
            const p = computeValueAtY(
              e.y,
              engine.displayMin.get(),
              engine.displayMax.get(),
              engine.canvasHeight.get(),
              padding.top,
              padding.bottom,
            );
            if (p !== null) lockPriceValue.set(p);
          }
          return;
        }
        scrubX.set(e.x);
      },
    )
    .onFinalize(
      /* istanbul ignore next */ () => {
        "worklet";
        // A lock-adjust drag leaves the reticle in place (scrubActive was never
        // set); a live-scrub clears its crosshair. Always clear scrubActive so a
        // stray scrub can never linger behind a placed reticle.
        if (scrubActive.get()) {
          scrubActive.set(false);
          if (hasOnScrub) scheduleOnRN(handleScrubEnd);
        }
        if (gestureStarted.get()) {
          gestureStarted.set(false);
          if (hasOnGestureEnd) scheduleOnRN(handleGestureEnd);
        }
      },
    );

  /* istanbul ignore next -- Android-only gesture axis config */
  if (Platform.OS === "android" && !hasScrubAction) {
    // Lock mode needs free vertical drag (Y = price), so the failOffsetY clamp —
    // which would kill a vertical adjust — is applied only outside scrub-action.
    gesture = gesture.activeOffsetX([-25, 25]).failOffsetY([-25, 25]);
  }

  // Axis-drag time-scroll: carve the bottom "time ruler" band out of the scrub's
  // hit area so a drag starting there scrolls (the pan-scroll gesture owns it)
  // and never trips the crosshair. `shouldCancelWhenOutside(false)` above keeps a
  // scrub that *started* in the plot tracking on into the band.
  if (scrubBottomExclude > 0) {
    gesture = gesture.hitSlop({ bottom: -scrubBottomExclude });
  }

  // Tap: place/move the reticle, press the action badge, or dismiss the lock.
  // Composed ahead of the pan by the controller, so a tap is never swallowed.
  // Built only in scrub-action mode (the plain-scrub path never constructs a Tap).
  /* istanbul ignore next -- gesture worklet runs on the UI thread, not in Jest */
  const handleActionTap = (e: { x: number; y: number }, success: boolean) => {
    "worklet";
    if (!enabled || !hasScrubAction || !success) return;
    if (lockActive.get()) {
      // 1. Action-badge press → fire onScrubAction with the chosen price.
      const rect = actionBadge.get();
      if (rect.visible && pointInRect(e.x, e.y, rect, ACTION_HIT_SLOP)) {
        const price = lockPrice.get();
        if (price !== null) {
          let candleJson: string | null = null;
          if (isCandleMode) {
            const c = lockCandle.get();
            if (c) candleJson = JSON.stringify(c);
          }
          if (hasOnScrubAction)
            scheduleOnRN(
              handleScrubAction,
              price,
              lockTime.get(),
              lockX.get(),
              lockY.get(),
              candleJson,
            );
        }
        return;
      }
      // 2. Dismiss: tap the reticle itself, or any empty tap when configured.
      const onReticle =
        Math.abs(e.x - lockX.get()) <= RETICLE_HIT &&
        Math.abs(e.y - lockY.get()) <= RETICLE_HIT;
      if (onReticle || dismissOnTapOutside) {
        lockActive.set(false);
        return;
      }
    }
    // 2.5. Defer to a marker / reference-line badge under the tap: when one
    //      coexists, the tap fires both this handler and that overlay's tap
    //      (Simultaneous) — yield so it acts instead of dropping a reticle on top.
    if (deferTapHit !== undefined && deferTapHit(e.x, e.y)) return;
    // 3. Place / move the reticle. Clear any in-progress live-scrub so its
    //    crosshair never shows behind the placed reticle.
    scrubActive.set(false);
    lockX.set(
      clampPlotX(e.x, padding.left, engine.canvasWidth.get(), padding.right),
    );
    // Freeze the chosen price at the tap Y; the line's Y derives from it (see
    // `lockY`). No-op until the canvas is laid out (price === null).
    const placedPrice = computeValueAtY(
      e.y,
      engine.displayMin.get(),
      engine.displayMax.get(),
      engine.canvasHeight.get(),
      padding.top,
      padding.bottom,
    );
    if (placedPrice === null) return;
    lockPriceValue.set(placedPrice);
    lockActive.set(true);
  };

  let tapGesture = hasScrubAction
    ? Gesture.Tap()
        .maxDuration(250)
        .maxDistance(SCRUB_ACTION_TAP_SLOP)
        .onEnd(handleActionTap)
    : undefined;
  // Keep the axis-drag band scroll-only for taps too — a tap there shouldn't
  // drop an order-ticket reticle.
  if (tapGesture && scrubBottomExclude > 0) {
    tapGesture = tapGesture.hitSlop({ bottom: -scrubBottomExclude });
  }

  return {
    scrubX,
    scrubActive,
    scrubTime,
    scrubValue,
    scrubCandle,
    crosshairOpacity,
    tooltipLayout,
    scrubDotY,
    tooltipLineTop,
    gesture,
    lockActive,
    lockX,
    lockY,
    lockPrice,
    actionBadge,
    timeBadge,
    tapGesture,
  };
}
