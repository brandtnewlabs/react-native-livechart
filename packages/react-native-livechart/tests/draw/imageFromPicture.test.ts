import { Skia, type SkPicture } from "react-native-skia";
import { imageFromPicture } from "../../src/draw/imageFromPicture";

describe("GPU atlas snapshots", () => {
  it("returns the snapshot without a CPU readback", () => {
    const picture = {} as SkPicture;
    const image = {};
    const canvas = { drawPicture: jest.fn() };
    const surface = {
      getCanvas: () => canvas,
      flush: jest.fn(),
      makeImageSnapshot: jest.fn(() => image),
      dispose: jest.fn(),
    };
    const make = jest.mocked(Skia.Surface.MakeOffscreen);
    make.mockReturnValueOnce(surface as never);
    expect(imageFromPicture(picture, { width: 36, height: 36 })).toBe(image);
    expect(canvas.drawPicture).toHaveBeenCalledWith(picture);
    expect(surface.flush).toHaveBeenCalled();
    expect(surface.dispose).toHaveBeenCalled();
  });

  it("allows overlays to skip drawing if the GPU surface is unavailable", () => {
    jest.mocked(Skia.Surface.MakeOffscreen).mockReturnValueOnce(null);
    expect(imageFromPicture({} as SkPicture, { width: 36, height: 36 })).toBeNull();
  });
});
