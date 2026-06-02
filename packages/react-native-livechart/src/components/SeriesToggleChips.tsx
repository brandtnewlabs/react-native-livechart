import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAnimatedReaction, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { MONO_FONT_FAMILY } from "../lib/monoFontFamily";
import type { ResolvedLegendConfig } from "../core/resolveConfig";
import type { SeriesConfig } from "../types";

export interface SeriesToggleChipsProps {
  series: SharedValue<SeriesConfig[]>;
  legend: ResolvedLegendConfig;
  onSeriesToggle?: (id: string, visible: boolean) => void;
}

/** Exported for tests — mirrors chip labels without subscribing to every data tick. */
export function seriesMetaSig(s: SeriesConfig[]): string {
  "worklet";
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0) out += "\x1e";
    const x = s[i];
    out += `${x.id}\x1f${x.label ?? ""}\x1f${x.color ?? ""}\x1f${x.visible === false ? 0 : 1}`;
  }
  return out;
}

/**
 * Mirrors `series` into React state when id/label/color/visibility changes (not on every data tick).
 */
export function SeriesToggleChips({
  series,
  legend,
  onSeriesToggle,
}: SeriesToggleChipsProps) {
  // Seed from the current series at mount; the reaction below keeps it in sync.
  const [snapshot, setSnapshot] = useState<SeriesConfig[]>(() =>
    series.value.slice(),
  );

  const pullSnapshot = useCallback((sv: SharedValue<SeriesConfig[]>) => {
    setSnapshot(sv.value.slice());
  }, []);

  useAnimatedReaction(
    () => seriesMetaSig(series.value),
    /* istanbul ignore next -- Reanimated reaction; snapshot seeded at mount, pulled here on change */
    (sig, prev) => {
      if (sig !== prev) {
        scheduleOnRN(pullSnapshot, series);
      }
    },
    [series, pullSnapshot],
  );

  if (!legend.visible) return null;

  const toggle = (id: string) => {
    const arr = series.value.slice();
    const idx = arr.findIndex((s) => s.id === id);
    /* istanbul ignore next -- defensive; chips only call with known ids */
    if (idx < 0) return;
    const wasVisible = arr[idx].visible !== false;
    const nextVisible = !wasVisible;
    const next = arr.map((s, i) =>
      i === idx ? { ...s, visible: nextVisible } : s,
    );
    series.value = next;
    setSnapshot(next);
    onSeriesToggle?.(id, nextVisible);
  };

  const compact = legend.compact;
  const st = legend.style;

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {snapshot.map((s) => {
        const on = s.visible !== false;
        const label = s.label ?? s.id;
        const swatchSize = st?.dotSize;
        const chipBg = on ? st?.activeBackground : st?.hiddenBackground;
        const textColor = on ? st?.activeColor : st?.hiddenColor;
        return (
          <Pressable
            key={s.id}
            onPress={() => toggle(s.id)}
            style={[
              styles.chip,
              compact && styles.chipCompact,
              on && styles.chipOn,
              st?.borderRadius !== undefined && { borderRadius: st.borderRadius },
              chipBg !== undefined && { backgroundColor: chipBg },
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
                on && styles.chipTextOn,
                s.kind === "derived" && styles.chipTextDerived,
                st?.fontSize !== undefined && { fontSize: st.fontSize },
                textColor !== undefined && { color: textColor },
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
    backgroundColor: "rgba(255,255,255,0.06)",
    maxWidth: "48%",
  },
  chipCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    borderRadius: 6,
    maxWidth: "32%",
  },
  chipOn: {
    backgroundColor: "rgba(59,130,246,0.25)",
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    flexShrink: 1,
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontFamily: MONO_FONT_FAMILY,
  },
  chipTextCompact: {
    fontSize: 11,
  },
  chipTextOn: {
    color: "rgba(255,255,255,0.9)",
  },
  chipTextDerived: {
    fontStyle: "italic",
    opacity: 0.85,
  },
  chipValue: {
    fontWeight: "700",
  },
});
