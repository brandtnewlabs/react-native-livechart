import { Stack } from "expo-router";

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
          fontFamily: "monospace",
          fontSize: 15,
        },
        contentStyle: { backgroundColor: headerBg },
      }}
    />
  );
}
