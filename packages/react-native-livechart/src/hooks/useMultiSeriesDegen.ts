import { useEffect, useRef } from "react";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type DerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";
import { DEGEN_STRIDE } from "../constants";
import type { ResolvedDegenConfig } from "../core/resolveConfig";
import type { MultiEngineState } from "../core/useLiveChartEngine";
import type { ChartPadding } from "../draw/line";
import { computeShake, spawnBurst, tickParticles } from "../math/degenTick";
import { detectMomentum } from "../math/momentum";
import type { DegenShakePayload } from "../types";

/**
 * Multi-series degen: **every** visible series sparks a burst off its own
 * endpoint dot on an up-momentum swing — in that series' color (its particles
 * carry the series index as their `colorIndex`) — plus one shared chart shake
 * re-armed from the strongest swing each frame. Reuses the single-series
 * particle/shake math (`math/degenTick`).
 */
export function useMultiSeriesDegen(
  engine: MultiEngineState,
  padding: ChartPadding,
  cfg: ResolvedDegenConfig | null,
  onShake?: (payload: DegenShakePayload) => void,
): {
  pack: SharedValue<Float64Array<ArrayBuffer>>;
  packRevision: SharedValue<number>;
  shakeTransform: DerivedValue<
    [{ translateX: number }, { translateY: number }]
  >;
} {
  const MAX_SLOTS = 80;
  const pack = useSharedValue(new Float64Array(MAX_SLOTS * DEGEN_STRIDE));
  const packRevision = useSharedValue(0);
  // Per-series previous momentum (0 = flat, 1 = up, 2 = down), index-aligned to series.
  const prevMoms = useSharedValue<number[]>([]);
  const writeRot = useSharedValue(0);
  const enabledSV = useSharedValue(0);
  const scaleSV = useSharedValue(1);
  const downSV = useSharedValue(0);
  const shakeEnabledSV = useSharedValue(0);
  const shakeIntensitySV = useSharedValue(1);
  const shakeDurationSecSV = useSharedValue(0.45);
  const slotCountSV = useSharedValue(60);
  const burstParticleCountSV = useSharedValue(20);
  const particleBurstDurationSecSV = useSharedValue(1.0);
  const dragSV = useSharedValue(0.95);
  const sizeMinSV = useSharedValue(1);
  const sizeMaxSV = useSharedValue(2.2);
  const spreadAngleSV = useSharedValue(Math.PI * 1.2);
  const jitterXSV = useSharedValue(24);
  const jitterYSV = useSharedValue(8);
  const speedMinSV = useSharedValue(60);
  const speedMaxSV = useSharedValue(160);
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  const shakeStart = useSharedValue(0);
  const prevTimestamp = useSharedValue(0);
  const prevActiveCount = useSharedValue(0);
  const hasOnShakeListenerSV = useSharedValue(0);

  const onShakeRef = useRef(onShake);
  useEffect(() => {
    onShakeRef.current = onShake;
  });
  const emitShake =
    /* istanbul ignore next -- invoked only from the UI-thread frame worklet */
    (direction: "up" | "down") => {
      onShakeRef.current?.({ direction });
    };

  const degenOff = cfg === null;

  useEffect(() => {
    // Mirror the resolved config into SharedValues for the UI-thread worklet.
    // Everything is set unconditionally — no prop-derived `if` branch — so this
    // is a plain external-store sync, not a disguised event handler. When degen
    // is off, enabledSV is 0 and the frame worklet early-returns (zeroing the
    // particle buffer and shake itself), so the remaining values are inert; the
    // `?? default` fallbacks stand in for the null-config case.
    enabledSV.set(degenOff ? 0 : 1);
    shakeEnabledSV.set(cfg?.shake ? 1 : 0);
    hasOnShakeListenerSV.set(!degenOff && onShake != null ? 1 : 0);
    scaleSV.set(cfg?.scale ?? 1);
    downSV.set(cfg?.downMomentum ? 1 : 0);
    shakeIntensitySV.set(cfg?.shakeIntensity ?? 1);
    shakeDurationSecSV.set(cfg?.shakeDurationSec ?? 0.45);
    slotCountSV.set(cfg?.particleSlotCount ?? 60);
    burstParticleCountSV.set(cfg?.burstParticleCount ?? 20);
    particleBurstDurationSecSV.set(cfg?.particleBurstDurationSec ?? 1.0);
    dragSV.set(cfg?.drag ?? 0.95);
    sizeMinSV.set(cfg?.particleSizeMin ?? 1);
    sizeMaxSV.set(cfg?.particleSizeMax ?? 2.2);
    spreadAngleSV.set(cfg?.spreadAngle ?? Math.PI * 1.2);
    jitterXSV.set(cfg?.positionJitterX ?? 24);
    jitterYSV.set(cfg?.positionJitterY ?? 8);
    speedMinSV.set(cfg?.speedMin ?? 60);
    speedMaxSV.set(cfg?.speedMax ?? 160);
  }, [
    degenOff,
    onShake,
    cfg,
    // SharedValue refs are stable (useSharedValue), so listing them satisfies
    // exhaustive-deps without ever re-running the effect.
    enabledSV,
    shakeEnabledSV,
    hasOnShakeListenerSV,
    shakeStart,
    shakeX,
    shakeY,
    scaleSV,
    downSV,
    shakeIntensitySV,
    shakeDurationSecSV,
    slotCountSV,
    burstParticleCountSV,
    particleBurstDurationSecSV,
    dragSV,
    sizeMinSV,
    sizeMaxSV,
    spreadAngleSV,
    jitterXSV,
    jitterYSV,
    speedMinSV,
    speedMaxSV,
  ]);

  useFrameCallback(
    /* istanbul ignore next -- worklet runs on UI thread, not in Jest */ () => {
      "worklet";
      const now = engine.timestamp.get();
      const buf = pack.get();
      const slots = slotCountSV.get();

      const dtSec = prevTimestamp.get() > 0 ? now - prevTimestamp.get() : 0.016;
      prevTimestamp.set(now);

      const moms = prevMoms.get();

      if (enabledSV.get() < 0.5) {
        for (let i = 0; i < slots; i++) buf[i * DEGEN_STRIDE + 5] = 0;
        moms.length = 0;
        prevActiveCount.set(0);
        shakeStart.set(0);
        shakeX.set(0);
        shakeY.set(0);
        return;
      }

      const s = engine.series.get();
      const displays = engine.displaySeriesValues.get();
      const ops = engine.seriesOpacities.get();
      const n = s.length;
      while (moms.length < n) moms.push(0);
      if (moms.length > n) moms.length = n;

      const cw = engine.canvasWidth.get();
      const ch = engine.canvasHeight.get();
      const canSpawn = cw >= 1 && ch >= 1;
      const dMin = engine.displayMin.get();
      const dMax = engine.displayMax.get();
      const valRange = dMax - dMin;
      const chartH = ch - padding.top - padding.bottom;
      const ox = cw - padding.right;
      const allowDown = downSV.get() > 0.5;

      // Each visible series fires a burst off its own dot on a fresh swing.
      let firedDir = 0; // 0 none, 1 up, 2 down
      for (let i = 0; i < n; i++) {
        const visible = (ops[i] ?? 0) >= 0.5;
        const m = visible ? detectMomentum(s[i].data) : "flat";
        const code = m === "up" ? 1 : m === "down" ? 2 : 0;
        const prev = moms[i];
        moms[i] = code;
        if (!canSpawn || code === 0 || code === prev) continue;
        const isUp = code === 1;
        if (!isUp && !allowDown) continue;
        const v = displays[i] ?? s[i].value;
        const oy =
          valRange === 0
            ? padding.top + chartH / 2
            : padding.top + ((dMax - v) / valRange) * chartH;
        writeRot.set(
          spawnBurst(buf, {
            ox,
            oy,
            sc: scaleSV.get(),
            burst: burstParticleCountSV.get(),
            baseAngle: isUp ? -Math.PI / 2 : Math.PI / 2,
            spread: spreadAngleSV.get(),
            jx: jitterXSV.get(),
            jy: jitterYSV.get(),
            sMin: speedMinSV.get(),
            sMax: speedMaxSV.get(),
            szMin: sizeMinSV.get(),
            szMax: sizeMaxSV.get(),
            now,
            baseRot: writeRot.get(),
            slots,
            colorIndex: i, // color this burst with series i's color
          }),
        );
        // Up swings win the shared shake; otherwise a down swing arms it.
        if (firedDir !== 1) firedDir = isUp ? 1 : 2;
      }

      if (firedDir !== 0 && shakeEnabledSV.get() > 0.5) {
        shakeStart.set(now);
        if (hasOnShakeListenerSV.get() > 0.5) {
          runOnJS(emitShake)(firedDir === 1 ? "up" : "down");
        }
      }

      if (shakeStart.get() > 0 && shakeEnabledSV.get() > 0.5) {
        const r = computeShake(
          now - shakeStart.get(),
          shakeDurationSecSV.get(),
          scaleSV.get(),
          shakeIntensitySV.get(),
        );
        shakeX.set(r.x);
        shakeY.set(r.y);
        if (!r.active) shakeStart.set(0);
      } else if (shakeEnabledSV.get() < 0.5) {
        shakeStart.set(0);
        shakeX.set(0);
        shakeY.set(0);
      }

      const activeCount = tickParticles(
        buf,
        slots,
        now,
        particleBurstDurationSecSV.get(),
        dragSV.get(),
        dtSec,
      );

      if (activeCount > 0 || prevActiveCount.get() > 0) {
        packRevision.set(packRevision.get() + 1);
      }
      prevActiveCount.set(activeCount);
    },
  );

  const shakeTransform = useDerivedValue(() => {
    "worklet";
    return [{ translateX: shakeX.get() }, { translateY: shakeY.get() }] as [
      { translateX: number },
      { translateY: number },
    ];
  });

  return { pack, packRevision, shakeTransform };
}
