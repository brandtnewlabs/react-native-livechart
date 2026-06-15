import { NativeTabs } from "expo-router/unstable-native-tabs";

/** Native bottom tabs — system defaults (iOS Liquid Glass, Android Material). */
export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Demos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="examples">
        <NativeTabs.Trigger.Label>Examples</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
