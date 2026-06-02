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
import type { SingleEngineState } from "../core/useLiveChartEngine";
import { computeShake, spawnBurst, tickParticles } from "../math/degenTick";
import type { DegenShakePayload, Momentum } from "../types";

export function useDegen(
  engine: SingleEngineState,
  dotX: SharedValue<number>,
  dotY: SharedValue<number>,
  momentumSV: SharedValue<Momentum>,
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
  const prevM = useSharedValue<Momentum>("flat");
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
  onShakeRef.current = onShake;

  const emitShake = useCallback((direction: "up" | "down") => {
    onShakeRef.current?.({ direction });
  }, []);

  const degenOff = cfg === null;
  const resolvedScale = cfg?.scale ?? 1;
  const resolvedDown = cfg?.downMomentum ?? false;
  const resolvedShake = cfg?.shake ?? true;
  const resolvedShakeIntensity = cfg?.shakeIntensity ?? 1;
  const resolvedShakeDurationSec = cfg?.shakeDurationSec ?? 0.45;
  const resolvedSlotCount = cfg?.particleSlotCount ?? 60;
  const resolvedBurstParticleCount = cfg?.burstParticleCount ?? 20;
  const resolvedParticleBurstDurationSec = cfg?.particleBurstDurationSec ?? 1.0;
  const resolvedDrag = cfg?.drag ?? 0.95;
  const resolvedSizeMin = cfg?.particleSizeMin ?? 1;
  const resolvedSizeMax = cfg?.particleSizeMax ?? 2.2;
  const resolvedSpreadAngle = cfg?.spreadAngle ?? Math.PI * 1.2;
  const resolvedJitterX = cfg?.positionJitterX ?? 24;
  const resolvedJitterY = cfg?.positionJitterY ?? 8;
  const resolvedSpeedMin = cfg?.speedMin ?? 60;
  const resolvedSpeedMax = cfg?.speedMax ?? 160;

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
    scaleSV.value = resolvedScale;
    downSV.value = resolvedDown ? 1 : 0;
    shakeEnabledSV.value = resolvedShake ? 1 : 0;
    shakeIntensitySV.value = resolvedShakeIntensity;
    shakeDurationSecSV.value = resolvedShakeDurationSec;
    slotCountSV.value = resolvedSlotCount;
    burstParticleCountSV.value = resolvedBurstParticleCount;
    particleBurstDurationSecSV.value = resolvedParticleBurstDurationSec;
    dragSV.value = resolvedDrag;
    sizeMinSV.value = resolvedSizeMin;
    sizeMaxSV.value = resolvedSizeMax;
    spreadAngleSV.value = resolvedSpreadAngle;
    jitterXSV.value = resolvedJitterX;
    jitterYSV.value = resolvedJitterY;
    speedMinSV.value = resolvedSpeedMin;
    speedMaxSV.value = resolvedSpeedMax;
    if (!resolvedShake) {
      shakeStart.value = 0;
      shakeX.value = 0;
      shakeY.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared value refs are stable; react only to cfg primitives
  }, [
    degenOff,
    onShake,
    resolvedScale,
    resolvedDown,
    resolvedShake,
    resolvedShakeIntensity,
    resolvedShakeDurationSec,
    resolvedSlotCount,
    resolvedBurstParticleCount,
    resolvedParticleBurstDurationSec,
    resolvedDrag,
    resolvedSizeMin,
    resolvedSizeMax,
    resolvedSpreadAngle,
    resolvedJitterX,
    resolvedJitterY,
    resolvedSpeedMin,
    resolvedSpeedMax,
  ]);

  useFrameCallback(
    /* istanbul ignore next -- worklet runs on UI thread, not in Jest */ () => {
      "worklet";
      const now = engine.timestamp.value;
      const buf = pack.value;
      const slots = slotCountSV.value;

      const dtSec = prevTimestamp.value > 0 ? now - prevTimestamp.value : 0.016;
      prevTimestamp.value = now;

      if (enabledSV.value < 0.5) {
        for (let i = 0; i < slots; i++) buf[i * DEGEN_STRIDE + 5] = 0;
        prevM.value = momentumSV.value;
        prevActiveCount.value = 0;
        shakeStart.value = 0;
        shakeX.value = 0;
        shakeY.value = 0;
        return;
      }

      const m = momentumSV.value;
      const prev = prevM.value;

      if (m !== prev && m !== "flat") {
        const allowDown = downSV.value > 0.5;
        const ok = m === "up" || (m === "down" && allowDown);
        if (ok) {
          const cw = engine.canvasWidth.value;
          const ch = engine.canvasHeight.value;
          if (cw >= 1 && ch >= 1) {
            const isUp = m === "up";
            writeRot.value = spawnBurst(buf, {
              ox: dotX.value,
              oy: dotY.value,
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
              colorIndex: -1, // cycle the color list per particle
            });
            if (shakeEnabledSV.value > 0.5) {
              shakeStart.value = now;
              if (hasOnShakeListenerSV.value > 0.5) {
                runOnJS(emitShake)(isUp ? "up" : "down");
              }
            }
          }
        }
      }
      prevM.value = m;

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

      // Repaint only while particles are alive (or on the frame they all expire,
      // so the overlay clears). When the field is empty the 4 derived values per
      // slot stay subscribed to `packRevision` alone and freeze — no per-frame
      // worklet churn for an idle particle system.
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
