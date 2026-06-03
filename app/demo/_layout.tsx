import { Stack } from "expo-router";
import { APP_FONT_FAMILY_SEMIBOLD } from "../../demo-lib/fonts";
import { colors } from "../../demo-lib/theme";

const headerBg = colors.background;

export default function DemoLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: colors.text,
        headerTitleStyle: {
          color: colors.text,
          fontFamily: APP_FONT_FAMILY_SEMIBOLD,
          fontSize: 15,
        },
        contentStyle: { backgroundColor: headerBg },
      }}
    />
  );
}
