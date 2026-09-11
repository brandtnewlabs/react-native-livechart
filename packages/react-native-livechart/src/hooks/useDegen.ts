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
import type { SingleEngineState } from "../core/useLiveChartEngine";
import { computeShake, spawnBurst, tickParticles } from "../math/degenTick";
import type { DegenShakePayload, Momentum } from "../types";

function resolveDegenSettings(
  config: ResolvedDegenConfig | null,
  hasShakeListener: boolean,
) {
  return {
    off: config === null,
    scale: config?.scale ?? 1,
    down: config?.downMomentum ?? false,
    shake: config?.shake ?? true,
    shakeIntensity: config?.shakeIntensity ?? 1,
    shakeDurationSec: config?.shakeDurationSec ?? 0.45,
    slotCount: config?.particleSlotCount ?? 60,
    burstParticleCount: config?.burstParticleCount ?? 20,
    particleBurstDurationSec: config?.particleBurstDurationSec ?? 1,
    drag: config?.drag ?? 0.95,
    sizeMin: config?.particleSizeMin ?? 1,
    sizeMax: config?.particleSizeMax ?? 2.2,
    spreadAngle: config?.spreadAngle ?? Math.PI * 1.2,
    jitterX: config?.positionJitterX ?? 24,
    jitterY: config?.positionJitterY ?? 8,
    speedMin: config?.speedMin ?? 60,
    speedMax: config?.speedMax ?? 160,
    hasShakeListener,
  };
}

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
  useEffect(() => {
    onShakeRef.current = onShake;
  });

  const emitShake = (direction: "up" | "down") => {
    onShakeRef.current?.({ direction });
  };

  const {
    off,
    scale,
    down,
    shake,
    shakeIntensity,
    shakeDurationSec,
    slotCount,
    burstParticleCount,
    particleBurstDurationSec,
    drag,
    sizeMin,
    sizeMax,
    spreadAngle,
    jitterX,
    jitterY,
    speedMin,
    speedMax,
    hasShakeListener,
  } = resolveDegenSettings(cfg, onShake != null);

  useEffect(() => {
    // Mirror the resolved config into SharedValues for the UI-thread worklet.
    // Everything is set unconditionally — no prop-derived `if` branch — so this
    // is a plain external-store sync, not a disguised event handler. When degen
    // is off, enabledSV is 0 and the frame worklet early-returns (zeroing the
    // particle buffer and shake itself), so the remaining values are inert; the
    // resolved* defaults already stand in for the null-config case.
    enabledSV.set(off ? 0 : 1);
    shakeEnabledSV.set(!off && shake ? 1 : 0);
    hasOnShakeListenerSV.set(!off && hasShakeListener ? 1 : 0);
    scaleSV.set(scale);
    downSV.set(down ? 1 : 0);
    shakeIntensitySV.set(shakeIntensity);
    shakeDurationSecSV.set(shakeDurationSec);
    slotCountSV.set(slotCount);
    burstParticleCountSV.set(burstParticleCount);
    particleBurstDurationSecSV.set(particleBurstDurationSec);
    dragSV.set(drag);
    sizeMinSV.set(sizeMin);
    sizeMaxSV.set(sizeMax);
    spreadAngleSV.set(spreadAngle);
    jitterXSV.set(jitterX);
    jitterYSV.set(jitterY);
    speedMinSV.set(speedMin);
    speedMaxSV.set(speedMax);
  }, [
    off,
    scale,
    down,
    shake,
    shakeIntensity,
    shakeDurationSec,
    slotCount,
    burstParticleCount,
    particleBurstDurationSec,
    drag,
    sizeMin,
    sizeMax,
    spreadAngle,
    jitterX,
    jitterY,
    speedMin,
    speedMax,
    hasShakeListener,
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

  // ChartWithDegen only mounts while the resolved effect is enabled; static
  // charts force that config to null and unmount this callback entirely.
  useFrameCallback(
    /* istanbul ignore next -- worklet runs on UI thread, not in Jest */ () => {
      "worklet";
      const now = engine.timestamp.get();
      const buf = pack.get();
      const slots = slotCountSV.get();

      const dtSec = prevTimestamp.get() > 0 ? now - prevTimestamp.get() : 0.016;
      prevTimestamp.set(now);

      if (enabledSV.get() < 0.5) {
        for (let i = 0; i < slots; i++) buf[i * DEGEN_STRIDE + 5] = 0;
        prevM.set(momentumSV.get());
        prevActiveCount.set(0);
        shakeStart.set(0);
        shakeX.set(0);
        shakeY.set(0);
        return;
      }

      const m = momentumSV.get();
      const prev = prevM.get();

      if (m !== prev && m !== "flat") {
        const allowDown = downSV.get() > 0.5;
        const ok = m === "up" || (m === "down" && allowDown);
        if (ok) {
          const cw = engine.canvasWidth.get();
          const ch = engine.canvasHeight.get();
          if (cw >= 1 && ch >= 1) {
            const isUp = m === "up";
            writeRot.set(
              spawnBurst(buf, {
                ox: dotX.get(),
                oy: dotY.get(),
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
                colorIndex: -1, // cycle the color list per particle
              }),
            );
            if (shakeEnabledSV.get() > 0.5) {
              shakeStart.set(now);
              if (hasOnShakeListenerSV.get() > 0.5) {
                runOnJS(emitShake)(isUp ? "up" : "down");
              }
            }
          }
        }
      }
      prevM.set(m);

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

      // Repaint only while particles are alive (or on the frame they all expire,
      // so the overlay clears). When the field is empty the 4 derived values per
      // slot stay subscribed to `packRevision` alone and freeze — no per-frame
      // worklet churn for an idle particle system.
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
