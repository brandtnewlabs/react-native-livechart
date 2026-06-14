import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";

/** Native bottom tabs — system defaults (iOS Liquid Glass, Android Material). */
export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Label>Demos</Label>
        <Icon sf="chart.line.uptrend.xyaxis" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="examples">
        <Label>Examples</Label>
        <Icon sf="square.grid.2x2" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
