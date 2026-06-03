import { Stack } from "expo-router";
import { colors } from "../../demo-lib/theme";

export default function DemoLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
