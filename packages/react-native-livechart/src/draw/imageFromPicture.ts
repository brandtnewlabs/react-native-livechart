import { Skia, type SkImage, type SkPicture, type SkSize } from "react-native-skia";

/** Build a shared GPU atlas once, without an asynchronous CPU readback. */
export function imageFromPicture(picture: SkPicture, size: SkSize): SkImage | null {
  const surface = Skia.Surface.MakeOffscreen(size.width, size.height);
  if (!surface) return null;
  surface.getCanvas().drawPicture(picture);
  surface.flush();
  const image = surface.makeImageSnapshot();
  surface.dispose();
  return image;
}
