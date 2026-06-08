import {
  Atlas,
  Skia,
  type SkColor,
  type SkRSXform,
  type SkRect,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import {
  buildParticleInstances,
  buildParticleSprite,
} from "../draw/particleAtlas";
import { parseColorRgb } from "../theme";
import type { LiveChartPalette } from "../types";
import type { ChartEngineLayout } from "../core/useLiveChartEngine";

type DegenPack = SharedValue<Float64Array<ArrayBuffer>>;

/**
 * Renders the degen particle burst with a single `drawAtlas` call.
 *
 * Every active particle shares one pre-rasterized white-circle sprite and
 * differs only in position, scale, color, and opacity — the ideal `drawAtlas`
 * case. A single per-frame worklet projects the packed ring buffer (layout:
 * `[x, y, vx, vy, t0, active, size, colorIndex]`, stride = DEGEN_STRIDE = 8;
 * see `math/degenTick.ts`) into transforms + per-sprite colors, replacing the
 * old O(slots × 4 derived values + 1 `<Circle>` each) fan-out with O(1) mappers
 * and one draw.
 *
 * Per-particle color/opacity is baked into the sprite color (`rgba(r,g,b,a)`)
 * and applied with the `"modulate"` blend mode, which multiplies the white
 * sprite by each color — so a white AA circle becomes a soft, correctly-tinted,
 * correctly-faded particle, visually equivalent to the old `<Circle color
 * opacity>`.
 */
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
  engine: ChartEngineLayout;
  palette: LiveChartPalette;
  particleSlotCount: number;
  particleBurstDurationSec: number;
  particleOpacity: number;
  colors: string[] | null;
}) {
  /* istanbul ignore next -- branch depends on render-time props */
  const colorList = colors && colors.length > 0 ? colors : [palette.line];

  // White-circle sprite has no per-render inputs; React Compiler memoizes it.
  const sprite = buildParticleSprite();

  // Pre-parse the color list to [r,g,b] tuples so the per-frame worklet never
  // parses arbitrary color strings (only formats `rgba(...)`). React Compiler
  // memoizes this on `colorList`.
  const colorRgb = colorList.map((c) => parseColorRgb(c));

  // Single per-frame worklet. Reads `packRevision` so it re-runs each frame
  // while a burst is alive (the pack buffer is mutated in place, so its
  // reference is stable and wouldn't otherwise re-notify).
  const atlasData = useDerivedValue(() => {
    const rev = packRevision.get();
    const transforms: SkRSXform[] = [];
    const sprites: SkRect[] = [];
    const colorsOut: SkColor[] = [];
    if (rev >= 0) {
      const instances = buildParticleInstances(
        pack.get(),
        particleSlotCount,
        engine.timestamp.get(),
        particleBurstDurationSec,
        particleOpacity,
        sprite.radius,
      );
      const half = sprite.size / 2;
      for (let i = 0; i < instances.length; i++) {
        const inst = instances[i];
        // Center the scaled sprite on (x, y); RSXform has no rotation.
        transforms.push(
          Skia.RSXform(
            inst.scale,
            0,
            inst.x - inst.scale * half,
            inst.y - inst.scale * half,
          ),
        );
        sprites.push(Skia.XYWHRect(0, 0, sprite.size, sprite.size));
        const [r, g, b] = colorRgb[inst.colorIndex % colorRgb.length];
        colorsOut.push(Skia.Color(`rgba(${r}, ${g}, ${b}, ${inst.alpha})`));
      }
    }
    return { transforms, sprites, colors: colorsOut };
  }, [
    pack,
    packRevision,
    engine,
    particleSlotCount,
    particleBurstDurationSec,
    particleOpacity,
    sprite,
    colorRgb,
  ]);

  const transforms = useDerivedValue(() => atlasData.get().transforms, [atlasData]);
  const sprites = useDerivedValue(() => atlasData.get().sprites, [atlasData]);
  const atlasColors = useDerivedValue(() => atlasData.get().colors, [atlasData]);

  return (
    <Atlas
      image={sprite.image}
      sprites={sprites}
      transforms={transforms}
      colors={atlasColors}
      colorBlendMode="modulate"
    />
  );
}
