import { Platform } from "react-native";

/**
 * React Native `Text` / navigation title styles: iOS has no generic "monospace"
 * family (unlike web/CSS). Menlo is the system monospace on Apple platforms.
 */
export const MONO_FONT_FAMILY =
  Platform.select({ ios: "Menlo", default: "monospace" }) ?? "monospace";
