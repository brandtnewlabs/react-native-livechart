import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { MONO_FONT_FAMILY } from "../lib/monoFontFamily";
import type { ResolvedLegendConfig } from "../core/resolveConfig";
import type { LiveChartPalette, SeriesConfig } from "../types";
import { useSeriesPresentation } from "../hooks/useSeriesPresentation";

export interface SeriesToggleChipsProps {
  series: SharedValue<SeriesConfig[]>;
  legend: ResolvedLegendConfig;
  /** Chart palette, used to derive theme-aware default chip colors. */
  palette?: LiveChartPalette;
  onSeriesToggle?: (id: string, visible: boolean) => void;
}

/**
 * Neutral, readable default chip colors derived from the chart background
 * luminance, so the legend stays legible on both light and dark themes. Each is
 * only a fallback — matching `legend.style` overrides win.
 */
function legendColorDefaults(palette: LiveChartPalette | undefined) {
  const bg = palette?.bgRgb;
  const isLight = bg
    ? (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) / 255 > 0.5
    : false;
  return isLight
    ? {
        activeBackground: "rgba(0,0,0,0.06)",
        hiddenBackground: "rgba(0,0,0,0.03)",
        activeColor: "rgba(0,0,0,0.85)",
        hiddenColor: "rgba(0,0,0,0.4)",
      }
    : {
        activeBackground: "rgba(255,255,255,0.12)",
        hiddenBackground: "rgba(255,255,255,0.05)",
        activeColor: "rgba(255,255,255,0.92)",
        hiddenColor: "rgba(255,255,255,0.45)",
      };
}

/** Standalone wrapper; LiveChartSeries shares its controller snapshot instead. */
export function SeriesToggleChips(props: SeriesToggleChipsProps) {
  const { snapshot, refresh } = useSeriesPresentation(props.series);
  return <SeriesToggleChipsView {...props} snapshot={snapshot} onSnapshotChange={refresh} />;
}

export function SeriesToggleChipsView({
  series, legend, palette, onSeriesToggle, snapshot, onSnapshotChange,
}: SeriesToggleChipsProps & {
  snapshot: SeriesConfig[];
  onSnapshotChange: () => void;
}) {
  if (!legend.visible) return null;

  const toggle = (id: string) => {
    const arr = series.get().slice();
    const idx = arr.findIndex((s) => s.id === id);
    /* istanbul ignore next -- defensive; chips only call with known ids */
    if (idx < 0) return;
    const wasVisible = arr[idx].visible !== false;
    const nextVisible = !wasVisible;
    const next = arr.map((s, i) =>
      i === idx ? { ...s, visible: nextVisible } : s,
    );
    series.set(next);
    onSnapshotChange();
    onSeriesToggle?.(id, nextVisible);
  };

  const compact = legend.compact;
  const st = legend.style;
  const fallback = legendColorDefaults(palette);

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {snapshot.map((s) => {
        const on = s.visible !== false;
        const label = s.label ?? s.id;
        const swatchSize = st?.dotSize;
        const chipBg = on
          ? (st?.activeBackground ?? fallback.activeBackground)
          : (st?.hiddenBackground ?? fallback.hiddenBackground);
        const textColor = on
          ? (st?.activeColor ?? fallback.activeColor)
          : (st?.hiddenColor ?? fallback.hiddenColor);
        return (
          <Pressable
            key={s.id}
            onPress={() => toggle(s.id)}
            style={[
              styles.chip,
              compact && styles.chipCompact,
              st?.borderRadius !== undefined && { borderRadius: st.borderRadius },
              { backgroundColor: chipBg },
            ]}
          >
            <View
              style={[
                styles.swatch,
                { backgroundColor: s.color ?? "#888" },
                swatchSize !== undefined && {
                  width: swatchSize,
                  height: swatchSize,
                  borderRadius: swatchSize / 2,
                },
              ]}
            />
            <Text
              style={[
                styles.chipText,
                compact && styles.chipTextCompact,
                s.kind === "derived" && styles.chipTextDerived,
                st?.fontSize !== undefined && { fontSize: st.fontSize },
                { color: textColor },
              ]}
              numberOfLines={1}
            >
              {label}
              {s.valueLabel ? (
                <Text style={styles.chipValue}> {s.valueLabel}</Text>
              ) : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  rowCompact: {
    gap: 4,
    marginBottom: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: "48%",
  },
  chipCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    borderRadius: 6,
    maxWidth: "32%",
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: MONO_FONT_FAMILY,
  },
  chipTextCompact: {
    fontSize: 11,
  },
  chipTextDerived: {
    fontStyle: "italic",
    opacity: 0.85,
  },
  chipValue: {
    fontWeight: "700",
  },
});
