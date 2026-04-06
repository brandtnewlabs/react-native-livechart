import { StyleSheet } from "react-native";
import { MONO_FONT_FAMILY } from "react-native-livechart";

export const demoStyles = StyleSheet.create({
  demoRoot: {
    flex: 1,
    backgroundColor: "rgb(10, 10, 10)",
  },
  demoTitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: MONO_FONT_FAMILY,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 4,
  },
  demoDesc: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontFamily: MONO_FONT_FAMILY,
    paddingHorizontal: 16,
    marginBottom: 8,
    lineHeight: 16,
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
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: MONO_FONT_FAMILY,
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
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chipActive: {
    backgroundColor: "#3b82f6",
  },
  chipText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontFamily: MONO_FONT_FAMILY,
  },
  chipTextActive: {
    color: "#fff",
  },
  scrubReadout: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: MONO_FONT_FAMILY,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
});
