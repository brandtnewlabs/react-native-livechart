import { StyleSheet } from "react-native";
import {
  APP_FONT_FAMILY,
  APP_FONT_FAMILY_MEDIUM,
  APP_FONT_FAMILY_SEMIBOLD,
} from "./fonts";
import { colors } from "./theme";

export const demoStyles = StyleSheet.create({
  demoRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  demoHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginBottom: 2,
  },
  backChevron: {
    color: colors.link,
    fontSize: 22,
    lineHeight: 22,
    marginRight: 2,
    marginTop: -2,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
  },
  backText: {
    color: colors.link,
    fontSize: 15,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
  },
  demoHeading: {
    color: colors.text,
    fontSize: 22,
    fontFamily: APP_FONT_FAMILY_SEMIBOLD,
    marginBottom: 4,
  },
  demoDesc: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: APP_FONT_FAMILY,
    marginBottom: 8,
    lineHeight: 18,
  },
  demoDocsLink: {
    color: colors.link,
    fontSize: 13,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
    marginBottom: 8,
  },
  chartContainer: {
    height: 300,
    marginHorizontal: 12,
  },
  chartContainerFlex: {
    flex: 1,
    marginHorizontal: 12,
    minHeight: 120,
  },
  controlsScroll: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: APP_FONT_FAMILY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 14,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.chipBackground,
  },
  chipActive: {
    backgroundColor: "#3323E6",
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    color: colors.chipText,
    fontSize: 13,
    fontFamily: APP_FONT_FAMILY,
  },
  chipTextActive: {
    color: colors.chipTextActive,
  },
  scrubReadout: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY,
    paddingHorizontal: 16,
    marginBottom: 8,
    // Tabular figures so the scrub value/time readout doesn't jitter as it updates.
    fontVariant: ["tabular-nums"],
  },
});
