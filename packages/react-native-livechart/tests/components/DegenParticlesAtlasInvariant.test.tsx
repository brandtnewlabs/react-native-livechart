import { render } from '@testing-library/react-native';
import type { SkColor, SkRect, SkRSXform } from 'react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

interface AtlasArrays {
  readonly transforms: { get: () => readonly SkRSXform[] };
  readonly sprites: { get: () => readonly SkRect[] };
  readonly colors: { get: () => readonly SkColor[] };
}

let mockAtlasProps: AtlasArrays | null = null;
let mockAdvanceAtlas: (() => void) | null = null;
let mockDerivedCount = 0;
let mockAtlasMounts = 0;
let mockAtlasUnmounts = 0;

function getAtlasProps(): AtlasArrays {
  if (mockAtlasProps === null) throw new Error('Atlas was not rendered');
  return mockAtlasProps;
}

function advanceAtlas(): void {
  if (mockAdvanceAtlas === null) throw new Error('Atlas mapper was not registered');
  mockAdvanceAtlas();
}

jest.mock('react-native-skia', () => ({
  Atlas: (props: AtlasArrays): null => {
    jest.requireActual<typeof import('react')>('react').useEffect(() => {
      mockAtlasMounts += 1;
      return () => {
        mockAtlasUnmounts += 1;
      };
    }, []);
    mockAtlasProps = props;
    return null;
  },
  PaintStyle: { Fill: 0 },
  Skia: {
    Color: (color: string): string => color,
    Paint: () => ({
      setAntiAlias: () => undefined,
      setColor: () => undefined,
      setStyle: () => undefined,
    }),
    PictureRecorder: () => ({
      beginRecording: () => ({ drawCircle: () => undefined }),
      finishRecordingAsPicture: () => ({}),
    }),
    RSXform: (scos: number, ssin: number, tx: number, ty: number) => ({ scos, ssin, tx, ty }),
    XYWHRect: (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    }),
  },
  drawAsImageFromPicture: () => ({}),
}));

jest.mock('react-native-reanimated', () => ({
  useDerivedValue: (calculate: () => unknown) => {
    mockDerivedCount += 1;
    if (mockDerivedCount > 1) return { get: calculate };
    const derived = { value: calculate(), get: () => derived.value };
    mockAdvanceAtlas = (): void => {
      derived.value = calculate();
    };
    return derived;
  },
}));

import { DegenParticlesOverlay } from '../../src/components/DegenParticlesOverlay';
import type { LiveChartPalette } from '../../src/types';

it('keeps Atlas prop lengths equal when Skia reads colors from one frame and transforms from the next', async () => {
  const buffer = new Float64Array(4 * 8);
  const revision = { value: 0, get: () => revision.value };
  mockAtlasProps = null;
  mockAdvanceAtlas = null;
  mockDerivedCount = 0;

  await render(
    <DegenParticlesOverlay
      pack={{ get: () => buffer } as SharedValue<Float64Array<ArrayBuffer>>}
      packRevision={revision as SharedValue<number>}
      particleTimestamp={{ get: () => 0 } as SharedValue<number>}
      palette={{ line: '#ffffff' } as LiveChartPalette}
      particleSlotCount={4}
      particleBurstDurationSec={1}
      particleOpacity={1}
      colors={null}
    />,
  );

  const oldColors = getAtlasProps().colors.get();
  buffer[5] = 1;
  buffer[6] = 8;
  revision.value = 1;
  advanceAtlas();

  const newTransforms = getAtlasProps().transforms.get();
  const newSprites = getAtlasProps().sprites.get();
  expect(newTransforms.length).toBe(oldColors.length);
  expect(newSprites.length).toBe(oldColors.length);
});

it('remounts Atlas when the configured particle slot count changes', async () => {
  const buffer = new Float64Array(8 * 8);
  const revision = { value: 0, get: () => revision.value };
  mockAtlasProps = null;
  mockAdvanceAtlas = null;
  mockDerivedCount = 0;
  mockAtlasMounts = 0;
  mockAtlasUnmounts = 0;
  const props = {
    pack: { get: () => buffer } as SharedValue<Float64Array<ArrayBuffer>>,
    packRevision: revision as SharedValue<number>,
    particleTimestamp: { get: () => 0 } as SharedValue<number>,
    palette: { line: '#ffffff' } as LiveChartPalette,
    particleBurstDurationSec: 1,
    particleOpacity: 1,
    colors: null,
  };

  const screen = await render(<DegenParticlesOverlay {...props} particleSlotCount={4} />);
  const oldColors = getAtlasProps().colors.get();
  expect(oldColors).toHaveLength(4);
  expect(mockAtlasMounts).toBe(1);

  await screen.rerender(<DegenParticlesOverlay {...props} particleSlotCount={8} />);
  expect(mockAtlasUnmounts).toBe(1);
  expect(mockAtlasMounts).toBe(2);
  expect(getAtlasProps().colors.get()).toHaveLength(8);
  expect(getAtlasProps().transforms.get()).toHaveLength(8);
  expect(getAtlasProps().sprites.get()).toHaveLength(8);
  expect(oldColors).toHaveLength(4);
});
