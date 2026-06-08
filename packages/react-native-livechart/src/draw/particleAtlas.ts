import {
  Skia,
  PaintStyle,
  drawAsImageFromPicture,
  type SkImage,
} from "@shopify/react-native-skia";
import { DEGEN_STRIDE } from "../constants";

/** Reference radius of the rasterized white circle sprite (px). */
const SPRITE_RADIUS = 16;
/** Anti-alias breathing room baked around the circle so it never clips. */
const SPRITE_MARGIN = 2;

/** A rasterized white-circle sprite + its geometry. */
export interface ParticleSprite {
  image: SkImage | null;
  /** Side length of the square sprite box (px). */
  size: number;
  /** Radius of the white circle inside the box (px). */
  radius: number;
}

/**
 * Rasterize ONE anti-aliased **white** filled circle into a square sprite, once
 * (NOT per frame). Drawing it white lets each particle's per-sprite color
 * modulate (multiply) the texture to its own tint + alpha via `drawAtlas`.
 *
 * Mirrors the PictureRecorder pattern in `markerAtlas.ts`.
 */
export function buildParticleSprite(): ParticleSprite {
  const R = SPRITE_RADIUS;
  const S = 2 * (R + SPRITE_MARGIN);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color("#ffffff"));
  paint.setStyle(PaintStyle.Fill);

  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, S, S));
  canvas.drawCircle(S / 2, S / 2, R, paint);
  const picture = recorder.finishRecordingAsPicture();
  const image = drawAsImageFromPicture(picture, { width: S, height: S });
  return { image, size: S, radius: R };
}

/** One particle ready to blit: world position + per-sprite scale/alpha/color. */
export interface ParticleInstance {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  colorIndex: number;
}

/**
 * Pure, worklet-safe projection of the packed particle ring buffer into render
 * instances. No Skia — plain numbers only — so it's directly unit-testable.
 *
 * Preserves the exact size/opacity formulas the old per-slot `<Circle>` used:
 *   life  = max(0, 1 - (now - t0) / burstDur)   (skip if dt = now - t0 < 0)
 *   r     = size * (0.5 + life * 0.5),  size = buf[base+6] || 1
 *   scale = r / spriteRadius
 *   alpha = life * particleOpacity
 * Inactive (active <= 0.5), pre-spawn (dt < 0) and fully-faded (life <= 0)
 * slots are skipped.
 */
export function buildParticleInstances(
  buf: Float64Array,
  slots: number,
  now: number,
  burstDur: number,
  particleOpacity: number,
  spriteRadius: number,
): ParticleInstance[] {
  "worklet";
  const out: ParticleInstance[] = [];
  for (let i = 0; i < slots; i++) {
    const base = i * DEGEN_STRIDE;
    if (!(buf[base + 5] > 0.5)) continue;
    const dt = now - buf[base + 4];
    if (dt < 0) continue;
    const life = Math.max(0, 1 - dt / burstDur);
    if (life <= 0) continue;
    const size = buf[base + 6] || 1;
    const r = size * (0.5 + life * 0.5);
    out.push({
      x: buf[base + 0],
      y: buf[base + 1],
      scale: r / spriteRadius,
      alpha: life * particleOpacity,
      colorIndex: Math.max(0, Math.floor(buf[base + 7])),
    });
  }
  return out;
}
