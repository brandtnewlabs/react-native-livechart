import {
  Skia,
  PaintStyle,
  StrokeCap,
  StrokeJoin,
  drawAsImageFromPicture,
  type SkCanvas,
  type SkFont,
  type SkImage,
  type SkPaint,
  type SkRect,
} from "@shopify/react-native-skia";
import type { LiveChartPalette, Marker, MarkerKind } from "../types";

/** Default icon box (px) when `marker.size` is unset. */
export const DEFAULT_ICON_SIZE = 16;
/** Circular badge padding around the icon glyph + background ring width. */
const PILL_PAD = 2;
const PILL_BORDER = 2;
const PILL_TEXT_COLOR = "#ffffff";
/** Anti-alias breathing room baked around every cell so sprites don't clip. */
const CELL_MARGIN = 2;

/** Default glyph color per kind when `marker.color` is unset. */
export function defaultMarkerColor(
  kind: MarkerKind,
  palette: LiveChartPalette,
): string {
  switch (kind) {
    case "trade":
      return palette.line;
    case "boost":
      return palette.refLine;
    case "graduation":
      return palette.dotUp;
    case "winner":
      return palette.dotUp;
    case "clawback":
      return palette.refLabel;
  }
}

/**
 * Axis-anchored kinds whose geometry depends on the chart's baseline (a
 * variable-length stem, or a box pinned to the axis) and therefore cannot be a
 * fixed-size sprite. These fall back to a self-projecting glyph component.
 *
 * Only applies when the marker has no `icon`/`image` override — those take
 * precedence and render as ordinary centered stamps via the atlas.
 */
export function isConnectorMarker(m: Marker): boolean {
  "worklet";
  return (
    !m.image &&
    !m.icon &&
    (m.kind === "graduation" || m.kind === "clawback")
  );
}

/**
 * Stable key for a marker's *visual appearance* (excludes position/anchor).
 * Two markers with the same signature share one atlas cell. Called both on the
 * JS thread (to build the atlas) and inside the per-frame worklet (to look a
 * marker's cell up), so it must stay worklet-safe and primitive-only.
 */
export function markerAppearanceSig(m: Marker): string {
  "worklet";
  if (m.image) return `img\x1f${m.id}\x1f${m.size ?? DEFAULT_ICON_SIZE}`;
  const size = m.size ?? "";
  if (m.icon)
    return `ic\x1f${m.icon}\x1f${m.pill ? 1 : 0}\x1f${m.color ?? ""}\x1f${size}`;
  return `k\x1f${m.kind}\x1f${m.color ?? ""}\x1f${size}`;
}

/** One packed glyph in the atlas image: its source rect + box size. */
export interface AtlasCell {
  rect: SkRect;
  w: number;
  h: number;
}

export interface MarkerAtlas {
  /** Packed glyph texture, or null when there are no atlas-rendered markers. */
  image: SkImage | null;
  /** appearance-signature → cell. */
  cells: Record<string, AtlasCell>;
}

const EMPTY_ATLAS: MarkerAtlas = { image: null, cells: {} };

function fillPaint(color: string): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  p.setStyle(PaintStyle.Fill);
  return p;
}

function strokePaint(color: string, width: number, round = false): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  if (round) {
    p.setStrokeCap(StrokeCap.Round);
    p.setStrokeJoin(StrokeJoin.Round);
  }
  return p;
}

interface CellSpec {
  w: number;
  h: number;
  /** Draw the glyph centered at (cx, cy) in the recording canvas. */
  draw: (canvas: SkCanvas, cx: number, cy: number) => void;
}

/**
 * Geometry + draw routine for one marker appearance. Mirrors the per-glyph
 * rendering the old `MarkerGlyph` did inline, so the atlas is pixel-equivalent.
 */
function cellSpec(m: Marker, palette: LiveChartPalette, font: SkFont): CellSpec {
  const color = m.color ?? defaultMarkerColor(m.kind, palette);
  const m2 = CELL_MARGIN * 2;

  if (m.image) {
    const img = m.image;
    const size = m.size ?? DEFAULT_ICON_SIZE;
    const imgPaint = Skia.Paint();
    imgPaint.setAntiAlias(true);
    return {
      w: size + m2,
      h: size + m2,
      draw: (canvas, cx, cy) => {
        const iw = img.width();
        const ih = img.height();
        // `contain` fit: scale to fit the box without distorting aspect.
        const scale = iw > 0 && ih > 0 ? Math.min(size / iw, size / ih) : 1;
        const dw = iw * scale;
        const dh = ih * scale;
        canvas.drawImageRect(
          img,
          Skia.XYWHRect(0, 0, iw, ih),
          Skia.XYWHRect(cx - dw / 2, cy - dh / 2, dw, dh),
          imgPaint,
        );
      },
    };
  }

  if (m.icon) {
    const icon = m.icon;
    const b = font.measureText(icon);
    // Center the glyph on its measured bounds (tighter than ascent/descent).
    const iconDX = b.x + b.width / 2;
    const iconDY = b.y + b.height / 2;

    if (m.pill) {
      const bgColor = `rgb(${palette.bgRgb[0]}, ${palette.bgRgb[1]}, ${palette.bgRgb[2]})`;
      const pillR = Math.max(b.width, b.height) / 2 + PILL_PAD;
      const ringR = pillR + PILL_BORDER;
      const box = Math.ceil(2 * ringR) + m2;
      return {
        w: box,
        h: box,
        draw: (canvas, cx, cy) => {
          canvas.drawCircle(cx, cy, ringR, fillPaint(bgColor));
          canvas.drawCircle(cx, cy, pillR, fillPaint(color));
          canvas.drawText(
            icon,
            cx - iconDX,
            cy - iconDY,
            fillPaint(PILL_TEXT_COLOR),
            font,
          );
        },
      };
    }

    return {
      w: Math.ceil(Math.max(b.width, 1)) + m2,
      h: Math.ceil(Math.max(b.height, 1)) + m2,
      draw: (canvas, cx, cy) => {
        canvas.drawText(icon, cx - iconDX, cy - iconDY, fillPaint(color), font);
      },
    };
  }

  if (m.kind === "trade") {
    const box = 2 * (5 + 1) + m2; // ring r=5 stroked w=2
    return {
      w: box,
      h: box,
      draw: (canvas, cx, cy) => {
        canvas.drawCircle(cx, cy, 5, strokePaint(color, 2));
        canvas.drawCircle(cx, cy, 2, fillPaint(color));
      },
    };
  }

  if (m.kind === "winner") {
    const outer = 7;
    const inner = 3;
    const box = 2 * outer + m2;
    return {
      w: box,
      h: box,
      draw: (canvas, cx, cy) => {
        const pb = Skia.PathBuilder.Make();
        for (let k = 0; k < 10; k++) {
          const ang = -Math.PI / 2 + (k * Math.PI) / 5;
          const rad = k % 2 === 0 ? outer : inner;
          const px = cx + rad * Math.cos(ang);
          const py = cy + rad * Math.sin(ang);
          if (k === 0) pb.moveTo(px, py);
          else pb.lineTo(px, py);
        }
        pb.close();
        canvas.drawPath(pb.detach(), fillPaint(color));
      },
    };
  }

  if (m.kind === "boost") {
    const L = 6;
    const box = 2 * L + m2;
    return {
      w: box,
      h: box,
      draw: (canvas, cx, cy) => {
        const pb = Skia.PathBuilder.Make();
        for (let k = 0; k < 4; k++) {
          const ang = (k * Math.PI) / 4;
          const dx = L * Math.cos(ang);
          const dy = L * Math.sin(ang);
          pb.moveTo(cx - dx, cy - dy);
          pb.lineTo(cx + dx, cy + dy);
        }
        canvas.drawPath(pb.detach(), strokePaint(color, 1.5, true));
      },
    };
  }

  // Connector kinds are handled outside the atlas; this is a defensive dot.
  const box = 6 + m2;
  return {
    w: box,
    h: box,
    draw: (canvas, cx, cy) => canvas.drawCircle(cx, cy, 3, fillPaint(color)),
  };
}

/**
 * Rasterize every distinct marker appearance into a single packed atlas image,
 * once per appearance-set change (NOT per frame). The per-frame worklet then
 * blits these cells via one `drawAtlas` call.
 *
 * Connector kinds (see `isConnectorMarker`) are skipped — they render via a
 * self-projecting fallback component.
 */
export function buildMarkerAtlas(
  markers: Marker[],
  palette: LiveChartPalette,
  font: SkFont,
): MarkerAtlas {
  const seen = new Set<string>();
  const specs: { sig: string; spec: CellSpec }[] = [];
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    if (isConnectorMarker(m)) continue;
    const sig = markerAppearanceSig(m);
    if (seen.has(sig)) continue;
    seen.add(sig);
    specs.push({ sig, spec: cellSpec(m, palette, font) });
  }
  if (specs.length === 0) return EMPTY_ATLAS;

  let totalW = 0;
  let maxH = 0;
  for (let i = 0; i < specs.length; i++) {
    totalW += specs[i].spec.w;
    if (specs[i].spec.h > maxH) maxH = specs[i].spec.h;
  }
  const W = Math.max(1, Math.ceil(totalW));
  const H = Math.max(1, Math.ceil(maxH));

  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, W, H));
  const cells: Record<string, AtlasCell> = {};
  let x = 0;
  for (let i = 0; i < specs.length; i++) {
    const { sig, spec } = specs[i];
    canvas.save();
    canvas.translate(x, 0);
    spec.draw(canvas, spec.w / 2, H / 2);
    canvas.restore();
    cells[sig] = { rect: Skia.XYWHRect(x, 0, spec.w, H), w: spec.w, h: H };
    x += spec.w;
  }
  const picture = recorder.finishRecordingAsPicture();
  const image = drawAsImageFromPicture(picture, { width: W, height: H });
  return { image, cells };
}
