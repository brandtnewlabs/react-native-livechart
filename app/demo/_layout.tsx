import { Stack } from "expo-router";
import { MONO_FONT_FAMILY } from "react-native-livechart";

const headerBg = "rgb(10, 10, 10)";

export default function DemoLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: "#fff",
        headerTitleStyle: {
          color: "#fff",
          fontFamily: MONO_FONT_FAMILY,
          fontSize: 15,
        },
        contentStyle: { backgroundColor: headerBg },
      }}
    />
  );
}
