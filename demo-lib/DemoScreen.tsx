import type { ReactNode } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { demoStyles } from "./styles";

/** Guides are served from the hosted docs site; `docs=` is the page path under it. */
const DOCS_BASE = "https://react-native-livechart.brandtnewlabs.com/";

type DemoScreenProps = {
  /** Screen heading, e.g. "Line & area". Shown as the page title. */
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
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[demoStyles.demoRoot, { paddingTop: insets.top }]}>
      <View style={demoStyles.demoHeader}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={demoStyles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to demos"
        >
          <Text style={demoStyles.backChevron}>‹</Text>
          <Text style={demoStyles.backText}>Demos</Text>
        </Pressable>
        {title ? <Text style={demoStyles.demoHeading}>{title}</Text> : null}
        {description ? (
          <Text style={demoStyles.demoDesc}>{description}</Text>
        ) : null}
        {docs ? (
          <Pressable onPress={() => Linking.openURL(`${DOCS_BASE}${docs}`)}>
            <Text style={demoStyles.demoDocsLink}>Read the guide ↗</Text>
          </Pressable>
        ) : null}
      </View>
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
