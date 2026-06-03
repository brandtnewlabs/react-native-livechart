import type { ReactNode } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { demoStyles } from "./styles";

/** Guides live in the repo's `docs/` tree; no separate docs site is deployed. */
const DOCS_BASE =
  "https://github.com/brandtnewlabs/react-native-livechart/blob/main/docs/";

type DemoScreenProps = {
  title?: string;
  description?: string;
  /** Path under `docs/` (no extension), e.g. "guides/line-and-area". Renders a guide link. */
  docs?: string;
  chart: ReactNode;
  chartWrapperStyle?: ViewStyle;
  children?: ReactNode;
};

export function DemoScreen({
  title,
  description,
  docs,
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
      {docs ? (
        <Pressable onPress={() => Linking.openURL(`${DOCS_BASE}${docs}.mdx`)}>
          <Text style={demoStyles.demoDocsLink}>Read the guide ↗</Text>
        </Pressable>
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
