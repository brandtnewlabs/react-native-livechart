/**
 * Default font for the example app's own UI chrome (titles, labels, chips).
 * Loaded once in `app/_layout.tsx` via @expo-google-fonts/plus-jakarta-sans.
 *
 * This is deliberately separate from the library's `MONO_FONT_FAMILY`: the
 * chart still renders its numeric axis/badge labels in the mono face (see the
 * `font` prop in app/demo/theming.tsx) — only the playground's own text
 * defaults to Plus Jakarta Sans.
 *
 * Each weight is its own family name: @expo-google-fonts registers weights as
 * separate fonts, and React Native won't synthesize a heavier weight from a
 * single file. So reach for APP_FONT_FAMILY_SEMIBOLD instead of pairing
 * APP_FONT_FAMILY with `fontWeight: "600"`.
 */
export const APP_FONT_FAMILY = "PlusJakartaSans_400Regular";
export const APP_FONT_FAMILY_MEDIUM = "PlusJakartaSans_500Medium";
export const APP_FONT_FAMILY_SEMIBOLD = "PlusJakartaSans_600SemiBold";
