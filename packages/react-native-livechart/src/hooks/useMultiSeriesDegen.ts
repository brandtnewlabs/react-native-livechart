import { useCallback, useEffect, useRef } from "react";
import {
  runOnJS,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type DerivedValue,
  type SharedValue,
} from "react-native-reanimated";
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
  const emitShake = useCallback(
    /* istanbul ignore next -- invoked only from the UI-thread frame worklet */
    (direction: "up" | "down") => {
      onShakeRef.current?.({ direction });
    },
    [],
  );

  const degenOff = cfg === null;

  useEffect(() => {
    if (degenOff) {
      enabledSV.value = 0;
      shakeEnabledSV.value = 0;
      hasOnShakeListenerSV.value = 0;
      shakeStart.value = 0;
      shakeX.value = 0;
      shakeY.value = 0;
      return;
    }
    hasOnShakeListenerSV.value = onShake != null ? 1 : 0;
    enabledSV.value = 1;
    scaleSV.value = cfg.scale;
    downSV.value = cfg.downMomentum ? 1 : 0;
    shakeEnabledSV.value = cfg.shake ? 1 : 0;
    shakeIntensitySV.value = cfg.shakeIntensity;
    shakeDurationSecSV.value = cfg.shakeDurationSec;
    slotCountSV.value = cfg.particleSlotCount;
    burstParticleCountSV.value = cfg.burstParticleCount;
    particleBurstDurationSecSV.value = cfg.particleBurstDurationSec;
    dragSV.value = cfg.drag;
    sizeMinSV.value = cfg.particleSizeMin;
    sizeMaxSV.value = cfg.particleSizeMax;
    spreadAngleSV.value = cfg.spreadAngle;
    jitterXSV.value = cfg.positionJitterX;
    jitterYSV.value = cfg.positionJitterY;
    speedMinSV.value = cfg.speedMin;
    speedMaxSV.value = cfg.speedMax;
    if (!cfg.shake) {
      shakeStart.value = 0;
      shakeX.value = 0;
      shakeY.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared value refs are stable; react to cfg only
  }, [degenOff, onShake, cfg]);

  useFrameCallback(
    /* istanbul ignore next -- worklet runs on UI thread, not in Jest */ () => {
      "worklet";
      const now = engine.timestamp.value;
      const buf = pack.value;
      const slots = slotCountSV.value;

      const dtSec = prevTimestamp.value > 0 ? now - prevTimestamp.value : 0.016;
      prevTimestamp.value = now;

      const moms = prevMoms.value;

      if (enabledSV.value < 0.5) {
        for (let i = 0; i < slots; i++) buf[i * DEGEN_STRIDE + 5] = 0;
        moms.length = 0;
        prevActiveCount.value = 0;
        shakeStart.value = 0;
        shakeX.value = 0;
        shakeY.value = 0;
        return;
      }

      const s = engine.series.value;
      const displays = engine.displaySeriesValues.value;
      const ops = engine.seriesOpacities.value;
      const n = s.length;
      while (moms.length < n) moms.push(0);
      if (moms.length > n) moms.length = n;

      const cw = engine.canvasWidth.value;
      const ch = engine.canvasHeight.value;
      const canSpawn = cw >= 1 && ch >= 1;
      const dMin = engine.displayMin.value;
      const dMax = engine.displayMax.value;
      const valRange = dMax - dMin;
      const chartH = ch - padding.top - padding.bottom;
      const ox = cw - padding.right;
      const allowDown = downSV.value > 0.5;

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
        writeRot.value = spawnBurst(buf, {
          ox,
          oy,
          sc: scaleSV.value,
          burst: burstParticleCountSV.value,
          baseAngle: isUp ? -Math.PI / 2 : Math.PI / 2,
          spread: spreadAngleSV.value,
          jx: jitterXSV.value,
          jy: jitterYSV.value,
          sMin: speedMinSV.value,
          sMax: speedMaxSV.value,
          szMin: sizeMinSV.value,
          szMax: sizeMaxSV.value,
          now,
          baseRot: writeRot.value,
          slots,
          colorIndex: i, // color this burst with series i's color
        });
        // Up swings win the shared shake; otherwise a down swing arms it.
        if (firedDir !== 1) firedDir = isUp ? 1 : 2;
      }

      if (firedDir !== 0 && shakeEnabledSV.value > 0.5) {
        shakeStart.value = now;
        if (hasOnShakeListenerSV.value > 0.5) {
          runOnJS(emitShake)(firedDir === 1 ? "up" : "down");
        }
      }

      if (shakeStart.value > 0 && shakeEnabledSV.value > 0.5) {
        const r = computeShake(
          now - shakeStart.value,
          shakeDurationSecSV.value,
          scaleSV.value,
          shakeIntensitySV.value,
        );
        shakeX.value = r.x;
        shakeY.value = r.y;
        if (!r.active) shakeStart.value = 0;
      } else if (shakeEnabledSV.value < 0.5) {
        shakeStart.value = 0;
        shakeX.value = 0;
        shakeY.value = 0;
      }

      const activeCount = tickParticles(
        buf,
        slots,
        now,
        particleBurstDurationSecSV.value,
        dragSV.value,
        dtSec,
      );

      if (activeCount > 0 || prevActiveCount.value > 0) {
        packRevision.value = packRevision.value + 1;
      }
      prevActiveCount.value = activeCount;
    },
  );

  const shakeTransform = useDerivedValue(() => {
    "worklet";
    return [{ translateX: shakeX.value }, { translateY: shakeY.value }] as [
      { translateX: number },
      { translateY: number },
    ];
  });

  return { pack, packRevision, shakeTransform };
}
