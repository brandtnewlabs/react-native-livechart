import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useAnimatedReaction, useSharedValue, type SharedValue } from "react-native-reanimated";
import { executeOnUIRuntimeSync, scheduleOnRN } from "react-native-worklets";
import { lineColorsSignatureFromArray, lineStyleSignatureFromArray } from "../core/multiSeriesLayout";
import type { SeriesConfig } from "../types";
import { shouldResampleLayoutValue } from "./resolveChartLayout";

/** React only needs presentation fields; point histories stay on the UI runtime. */
export function seriesPresentationSignature(series: SeriesConfig[]): string {
  "worklet";
  let signature = lineColorsSignatureFromArray(series) + "\x1d" + lineStyleSignatureFromArray(series);
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    signature += `\x1d${s.label ?? s.id}\x1f${s.visible === false ? 0 : 1}\x1f${s.kind ?? ""}\x1f${s.valueLabel ?? ""}`;
  }
  return signature;
}

export function seriesPresentationValue(series: SeriesConfig[]): number {
  "worklet";
  let sample = 0;
  for (let i = 0; i < series.length; i++) {
    const value = series[i].value;
    if (Number.isFinite(value) && Math.abs(value) > Math.abs(sample)) sample = value;
  }
  return sample;
}

export function projectSeriesPresentation(series: SeriesConfig[]): SeriesConfig[] {
  "worklet";
  const snapshot: SeriesConfig[] = [];
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    snapshot.push({
      id: s.id, label: s.label, color: s.color, visible: s.visible,
      style: s.style, intervals: s.intervals, strokeWidth: s.strokeWidth,
      glow: s.glow, kind: s.kind, valueLabel: s.valueLabel,
      value: s.value, data: [],
    });
  }
  return snapshot;
}

interface Presentation {
  epoch: number;
  revision: number;
  signature: string;
  series: SeriesConfig[];
  sample: number | undefined;
}

/** Bootstrap before paint, then publish config/layout changes together. */
export function useSeriesPresentation(series: SharedValue<SeriesConfig[]>) {
  const [presentation, setPresentation] = useState<Presentation>({
    epoch: 0, revision: 0, signature: "", series: [], sample: undefined,
  });
  const currentSource = useRef<SharedValue<SeriesConfig[]> | null>(null);
  const epochCounter = useRef(0);
  const acceptedRevision = useRef(0);
  const activeEpoch = useSharedValue(0);
  const revision = useSharedValue(0);
  const published = useSharedValue({ signature: "", sample: 0 });
  const apply = useCallback((next: Presentation) => {
    if (currentSource.current !== series || next.epoch !== epochCounter.current ||
      next.revision <= acceptedRevision.current) return;
    acceptedRevision.current = next.revision;
    setPresentation(previous => previous.epoch === next.epoch &&
      previous.signature === next.signature && previous.sample === next.sample ? previous : next);
  }, [series]);

  const refresh = useCallback(() => {
    const epoch = epochCounter.current;
    const read = () => {
      "worklet";
      const arr = series.get();
      const signature = seriesPresentationSignature(arr);
      const value = seriesPresentationValue(arr);
      activeEpoch.set(epoch);
      revision.set(revision.get() + 1);
      published.set({ signature, sample: value });
      return {
        epoch, revision: revision.get(), signature,
        series: projectSeriesPresentation(arr), sample: value !== 0 ? value : undefined,
      };
    };
    // Web has one runtime and does not support executeOnUIRuntimeSync.
    apply(Platform.OS === "web" ? read() : executeOnUIRuntimeSync(read)());
  }, [series, activeEpoch, revision, published, apply]);

  useLayoutEffect(() => {
    currentSource.current = series;
    epochCounter.current += 1;
    refresh();
    return () => { currentSource.current = null; };
  }, [series, refresh]);

  const epoch = presentation.epoch;
  useAnimatedReaction(
    () => {
      const arr = series.get();
      return { signature: seriesPresentationSignature(arr), value: seriesPresentationValue(arr) };
    },
    (current) => {
      // Old mappers can finish after a prop change; neither their sample nor
      // an already queued JS publication may overwrite the new source.
      if (epoch !== activeEpoch.get()) return;
      const previous = published.get();
      const resample = shouldResampleLayoutValue(current.value, previous.sample);
      if (current.signature === previous.signature && !resample) return;
      const sample = resample ? current.value : previous.sample;
      published.set({ signature: current.signature, sample });
      revision.set(revision.get() + 1);
      scheduleOnRN(apply, {
        epoch, revision: revision.get(), signature: current.signature,
        series: projectSeriesPresentation(series.get()), sample: sample !== 0 ? sample : undefined,
      });
    },
    [series, epoch, activeEpoch, revision, published, apply],
  );
  return { snapshot: presentation.series, valueLayoutSample: presentation.sample, refresh };
}
