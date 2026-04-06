import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  runOnJS,
  useAnimatedReaction,
  type SharedValue,
} from "react-native-reanimated";
import type { LivelineSeries } from "../types";

export interface SeriesToggleChipsProps {
  series: SharedValue<LivelineSeries[]>;
  compact?: boolean;
  onSeriesToggle?: (id: string, visible: boolean) => void;
}

/** Exported for tests — mirrors chip labels without subscribing to every data tick. */
export function seriesMetaSig(s: LivelineSeries[]): string {
  "worklet";
  return s
    .map(
      (x) =>
        `${x.id}\x1f${x.label ?? ""}\x1f${x.color ?? ""}\x1f${x.visible === false ? 0 : 1}`,
    )
    .join("\x1e");
}

/**
 * Mirrors `series` into React state when id/label/color/visibility changes (not on every data tick).
 */
export function SeriesToggleChips({
  series,
  compact,
  onSeriesToggle,
}: SeriesToggleChipsProps) {
  const [snapshot, setSnapshot] = useState<LivelineSeries[]>([]);

  const pullSnapshot = useCallback((sv: SharedValue<LivelineSeries[]>) => {
    setSnapshot(sv.value.slice());
  }, []);

  useAnimatedReaction(
    () => seriesMetaSig(series.value),
    /* istanbul ignore next -- Reanimated reaction; snapshot pulled in useEffect */
    (sig, prev) => {
      if (sig !== prev) {
        runOnJS(pullSnapshot)(series);
      }
    },
    [series, pullSnapshot],
  );

  useEffect(() => {
    setSnapshot(series.value.slice());
  }, [series]);

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

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {snapshot.map((s) => {
        const on = s.visible !== false;
        const label = s.label ?? s.id;
        return (
          <Pressable
            key={s.id}
            onPress={() => toggle(s.id)}
            style={[
              styles.chip,
              compact && styles.chipCompact,
              on && styles.chipOn,
            ]}
          >
            <View
              style={[styles.swatch, { backgroundColor: s.color ?? "#888" }]}
            />
            <Text
              style={[
                styles.chipText,
                compact && styles.chipTextCompact,
                on && styles.chipTextOn,
              ]}
              numberOfLines={1}
            >
              {label}
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
    fontFamily: "monospace",
  },
  chipTextCompact: {
    fontSize: 11,
  },
  chipTextOn: {
    color: "rgba(255,255,255,0.9)",
  },
});
