import { Link } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EXAMPLES, type ExampleEntry } from "../../demo-lib/examples";
import {
  APP_FONT_FAMILY,
  APP_FONT_FAMILY_MEDIUM,
  APP_FONT_FAMILY_SEMIBOLD,
} from "../../demo-lib/fonts";
import { colors } from "../../demo-lib/theme";

/** Leading badge: the app's first initial on a brand-tinted tile. */
function ExampleBadge({ entry }: { entry: ExampleEntry }) {
  const tint = entry.status === "soon" ? colors.textFaint : entry.accent;
  return (
    <View style={[styles.badge, { backgroundColor: `${tint}1A` }]}>
      <Text style={[styles.badgeText, { color: tint }]}>
        {entry.title.charAt(0)}
      </Text>
    </View>
  );
}

function CardBody({ entry }: { entry: ExampleEntry }) {
  return (
    <>
      <ExampleBadge entry={entry} />
      <View style={styles.cardText}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{entry.title}</Text>
          {entry.status === "soon" ? (
            <Text style={styles.soonPill}>Soon</Text>
          ) : null}
        </View>
        <Text style={styles.cardTagline}>{entry.tagline}</Text>
      </View>
      {entry.status === "ready" ? (
        <Text style={styles.chevron}>›</Text>
      ) : null}
    </>
  );
}

function ExampleCard({ entry }: { entry: ExampleEntry }) {
  if (entry.status === "ready" && entry.href) {
    return (
      <Link href={entry.href} asChild>
        <Pressable style={styles.card}>
          <CardBody entry={entry} />
        </Pressable>
      </Link>
    );
  }
  return (
    <View style={[styles.card, styles.cardDisabled]}>
      <CardBody entry={entry} />
    </View>
  );
}

export default function Examples() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Examples</Text>
      <Text style={styles.subtitle}>
        LiveChart dropped into recreations of real finance & crypto apps.
      </Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        {EXAMPLES.map((entry) => (
          <ExampleCard key={entry.id} entry={entry} />
        ))}
        <Text style={styles.footnote}>More apps coming soon.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    paddingHorizontal: 20,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: APP_FONT_FAMILY,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 8,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.chipBackground,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 20,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
  },
  cardText: { flex: 1 },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
  },
  soonPill: {
    color: colors.textFaint,
    fontSize: 10,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: "hidden",
  },
  cardTagline: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY,
    lineHeight: 17,
    marginTop: 3,
  },
  chevron: {
    color: colors.textFaint,
    fontSize: 24,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
  },
  footnote: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY,
    textAlign: "center",
    marginTop: 24,
  },
});
