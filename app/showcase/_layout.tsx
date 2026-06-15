import { Stack } from "expo-router";

import { colors } from "../../demo-lib/theme";

/**
 * Showcase screens are full-screen recreations of real apps, pushed from the
 * "Examples" tab. They sit at the root stack level (siblings of `(tabs)`), so a
 * push covers the whole screen — including the glass tab bar — for an immersive,
 * chrome-free presentation. Each screen owns its own status-bar / safe-area
 * treatment and its own "back to Examples" affordance.
 */
export default function ShowcaseLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
