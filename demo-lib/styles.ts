import { StyleSheet } from "react-native";
import { APP_FONT_FAMILY, APP_FONT_FAMILY_MEDIUM } from "./fonts";
import { colors } from "./theme";

export const demoStyles = StyleSheet.create({
  demoRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  demoTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 4,
  },
  demoDesc: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: APP_FONT_FAMILY,
    paddingHorizontal: 16,
    marginBottom: 8,
    lineHeight: 16,
  },
  demoDocsLink: {
    color: colors.link,
    fontSize: 12,
    fontFamily: APP_FONT_FAMILY_MEDIUM,
    paddingHorizontal: 16,
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
  },
});
