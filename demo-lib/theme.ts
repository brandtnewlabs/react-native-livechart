import type { ThemeMode } from "react-native-livechart";
import { ACCENT } from "./shared";

/**
 * Default appearance for the example app.
 *
 * This is the single switch for the whole playground: every demo chart reads
 * `APP_THEME`, and the UI chrome below reads `colors`. Flip this to "dark" (and
 * the chrome values along with it) to flip the entire app.
 */
export const APP_THEME: ThemeMode = "light";

/**
 * UI-chrome colors for the example app, kept in sync with APP_THEME. The chart
 * itself derives its own palette from `theme` + `accentColor`; these only cover
 * the surrounding screens (backgrounds, labels, chips, inputs).
 */
export const colors = {
  background: "#ffffff",
  text: "#0a0a0a",
  textMuted: "rgba(0,0,0,0.55)",
  textFaint: "rgba(0,0,0,0.4)",
  border: "rgba(0,0,0,0.1)",
  chipBackground: "rgba(0,0,0,0.05)",
  chipText: "rgba(0,0,0,0.6)",
  chipTextActive: "#ffffff",
  inputBorder: "rgba(0,0,0,0.15)",
  placeholder: "rgba(0,0,0,0.35)",
  link: ACCENT,
} as const;
