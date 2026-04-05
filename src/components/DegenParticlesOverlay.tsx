import { Circle, Group } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { DEGEN_STRIDE } from "../constants";
import type { LiveChartPalette } from "../types";
import type { SingleEngineState } from "../useLiveChartEngine";

type DegenPack = SharedValue<Float64Array<ArrayBuffer>>;

function DegenSlot({
  index,
  pack,
  packRevision,
  engine,
  particleBurstDurationSec,
  particleOpacity,
  color,
}: {
  index: number;
  pack: DegenPack;
  packRevision: SharedValue<number>;
  engine: SingleEngineState;
  particleBurstDurationSec: number;
  particleOpacity: number;
  color: string;
}) {
  const base = index * DEGEN_STRIDE;

  /* istanbul ignore next -- useDerivedValue worklet runs on UI thread, not in Jest */
  const cx = useDerivedValue(() => {
    const rev = packRevision.value;
    const buf = pack.value;
    const active = buf[base + 5];
    if (!(rev >= 0) || !(active > 0.5)) return -9999;
    return buf[base + 0];
  });

  /* istanbul ignore next -- worklet */
  const cy = useDerivedValue(() => {
    const rev = packRevision.value;
    const buf = pack.value;
    const active = buf[base + 5];
    if (!(rev >= 0) || !(active > 0.5)) return -9999;
    return buf[base + 1];
  });

  /* istanbul ignore next -- worklet */
  const r = useDerivedValue(() => {
    const rev = packRevision.value;
    const buf = pack.value;
    const active = buf[base + 5];
    if (!(rev >= 0) || !(active > 0.5)) return 0;
    const now = engine.timestamp.value;
    const dt = now - buf[base + 4];
    if (dt < 0) return 0;
    const life = Math.max(0, 1 - dt / particleBurstDurationSec);
    const size = buf[base + 6] || 1;
    return size * (0.5 + life * 0.5);
  });

  /* istanbul ignore next -- worklet */
  const opacity = useDerivedValue(() => {
    const rev = packRevision.value;
    const buf = pack.value;
    const active = buf[base + 5];
    if (!(rev >= 0) || !(active > 0.5)) return 0;
    const now = engine.timestamp.value;
    const dt = now - buf[base + 4];
    if (dt < 0) return 0;
    const life = Math.max(0, 1 - dt / particleBurstDurationSec);
    return life * particleOpacity;
  });

  return <Circle cx={cx} cy={cy} r={r} color={color} opacity={opacity} />;
}

export function DegenParticlesOverlay({
  pack,
  packRevision,
  engine,
  palette,
  particleSlotCount,
  particleBurstDurationSec,
  particleOpacity,
  colors,
}: {
  pack: DegenPack;
  packRevision: SharedValue<number>;
  engine: SingleEngineState;
  palette: LiveChartPalette;
  particleSlotCount: number;
  particleBurstDurationSec: number;
  particleOpacity: number;
  colors: string[] | null;
}) {
  /* istanbul ignore next -- branch depends on render-time props */
  const colorList = colors && colors.length > 0 ? colors : [palette.line];
  const slots = [];
  for (let i = 0; i < particleSlotCount; i++) {
    slots.push(
      <DegenSlot
        key={i}
        index={i}
        pack={pack}
        packRevision={packRevision}
        engine={engine}
        particleBurstDurationSec={particleBurstDurationSec}
        particleOpacity={particleOpacity}
        color={colorList[i % colorList.length]}
      />,
    );
  }
  return <Group>{slots}</Group>;
}
