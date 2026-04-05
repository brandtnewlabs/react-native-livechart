import type { ReactNode } from "react";
import { ScrollView, Text, View, type ViewStyle } from "react-native";
import { demoStyles } from "./styles";

type DemoScreenProps = {
  title?: string;
  description?: string;
  chart: ReactNode;
  chartWrapperStyle?: ViewStyle;
  children?: ReactNode;
};

export function DemoScreen({
  title,
  description,
  chart,
  chartWrapperStyle,
  children,
}: DemoScreenProps) {
  return (
    <View style={demoStyles.demoRoot}>
      {title ? <Text style={demoStyles.demoTitle}>{title}</Text> : null}
      {description ? (
        <Text style={demoStyles.demoDesc}>{description}</Text>
      ) : null}
      <View style={[demoStyles.chartContainer, chartWrapperStyle]}>
        {chart}
      </View>
      <ScrollView
        style={demoStyles.controlsScroll}
        contentContainerStyle={demoStyles.controls}
      >
        {children}
      </ScrollView>
    </View>
  );
}
