import { useEffect, useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import { LiveChart, type LiveChartPoint } from "react-native-livechart";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";

export const options = { title: "Threshold split" };

const CENTER = 100;

type ThresholdType = "benchmark" | "series";

type EntryLevel = "start" | "high" | "low";
const ENTRY_LEVELS: Record<EntryLevel, number> = {
  start: CENTER,
  high: CENTER * 1.03,
  low: CENTER * 0.97,
};

/**
 * Smooth, bounded, quasi-random price as a function of time (seconds): a few
 * incommensurate sines around CENTER. Continuous → no per-tick jumps (the choppy
 * part of a coarse random walk) and bounded → no drift away from the threshold.
 * Phases are randomized per mount so it doesn't read as canned.
 */
function makePriceFn(): (t: number) => number {
  const p1 = Math.random() * Math.PI * 2;
  const p2 = Math.random() * Math.PI * 2;
  const p3 = Math.random() * Math.PI * 2;
  return (t) =>
    CENTER +
    2.1 * Math.sin(t * 0.45 + p1) +
    1.1 * Math.sin(t * 0.29 + p2) +
    0.45 * Math.sin(t * 1.6 + p3) +
    0.2 * Math.sin(t * 3.1);
}

/**
 * A LIVE price feed that oscillates around CENTER (so the threshold stays relevant
 * and the line clearly weaves above/below it). The live `value` is refreshed
 * ~30×/s from the continuous price so the tip flows smoothly; data points are
 * committed ~10×/s. Self-contained for the demo — a real app feeds `data` /
 * `value` from its own source.
 */
function useSmoothPriceFeed() {
  const data = useSharedValue<LiveChartPoint[]>([]);
  const value = useSharedValue(CENTER);
  useEffect(() => {
    const priceAt = makePriceFn();
    const now0 = Date.now() / 1000;
    const seed: LiveChartPoint[] = [];
    for (let k = -400; k <= 0; k++) {
      const t = now0 + k * 0.1; // 10Hz history
      seed.push({ time: t, value: priceAt(t) });
    }
    data.set(seed);
    value.set(priceAt(now0));
    const id = setInterval(() => {
      const now = Date.now() / 1000;
      const v = priceAt(now);
      const point: LiveChartPoint = { time: now, value: v };
      // Append IN PLACE on the UI thread (only `point` crosses the bridge) — never
      // re-clone the growing array JS→UI, matching the sim's hot path so the line
      // stays fluid (a full `data.set(...)` each tick is what made it stutter).
      data.modify((arr) => {
        "worklet";
        arr.push(point);
        if (arr.length > 1000) arr.shift();
        return arr;
      });
      value.set(v);
    }, 33);
    return () => clearInterval(id);
  }, [data, value]);
  return { data, value };
}

/** Initial stepped break-even near CENTER (two points per step → clean risers). */
function seedBreakEven(now: number): LiveChartPoint[] {
  const levels = [CENTER - 1.4, CENTER - 0.3, CENTER + 0.8, CENTER - 0.4];
  const pts: LiveChartPoint[] = [];
  for (let i = 0; i < levels.length; i++) {
    const t0 = now - (levels.length - i) * 8;
    pts.push({ time: t0, value: levels[i] });
    pts.push({ time: t0 + 8, value: levels[i] });
  }
  return pts;
}

/** Append one gentle break-even step near CENTER (a fresh "averaged-in" buy). */
function stepBreakEven(prev: LiveChartPoint[], now: number): LiveChartPoint[] {
  const last = prev[prev.length - 1]?.value ?? CENTER;
  const nv = last + (CENTER - last) * 0.4 + (Math.random() - 0.5) * 1.6;
  const next = [...prev, { time: now, value: last }, { time: now, value: nv }];
  const cutoff = now - 90;
  return next.filter((p, i) => p.time >= cutoff || i >= next.length - 12);
}

export default function ThresholdScreen() {
  const [thresholdType, setThresholdType] =
    useState<ThresholdType>("benchmark");
  const [fill, setFill] = useState(true);
  const [markerLine, setMarkerLine] = useState(true);
  const [label, setLabel] = useState(true);
  const [showValue, setShowValue] = useState(true);
  const [labelSide, setLabelSide] = useState<"left" | "right">("left");
  const [colorMode, setColorMode] = useState<"default" | "custom">("default");
  const [entry, setEntry] = useState<EntryLevel>("start");

  const { data, value } = useSmoothPriceFeed();

  // BENCHMARK form: a single live split value. Updating it with `.set()` moves the
  // split live on the UI thread with no re-render (a real app points it at average
  // cost, VWAP, or the previous close).
  const breakEven = useSharedValue(CENTER);
  const setEntryLevel = (next: EntryLevel) => {
    setEntry(next);
    breakEven.set(ENTRY_LEVELS[next]);
  };

  const isSeries = thresholdType === "series";

  // SERIES form: a LIVE time-varying `LiveChartPoint[]` threshold. It scrolls in
  // lockstep with the price (same timeline) and gains a fresh step every few
  // seconds. Appending (not regenerating) keeps existing points put, so the
  // staircase never jumps.
  const [series, setSeries] = useState<LiveChartPoint[]>(() =>
    seedBreakEven(Date.now() / 1000),
  );
  useEffect(() => {
    if (!isSeries) return;
    const id = setInterval(() => {
      setSeries((prev) => stepBreakEven(prev, Date.now() / 1000));
    }, 6000);
    return () => clearInterval(id);
  }, [isSeries]);

  const customColors =
    colorMode === "custom"
      ? { aboveColor: "#14b8a6", belowColor: "#f97316" }
      : {};

  return (
    <DemoScreen
      title="Threshold split"
      docs="guides/threshold"
      description="threshold — green above / red below a break-even (a live value or a time-varying series), with a P/L fill band + marker line"
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          gradient={false}
          threshold={{
            value: isSeries ? series : breakEven,
            ...customColors,
            fill,
            // `true` → dashed line only (no text/badge); object → labelled badge.
            line: markerLine
              ? label
                ? { label: "Break-even", showValue, labelPosition: labelSide }
                : true
              : false,
          }}
          scrub={false}
        />
      }
    >
      <ChipRow
        label="Threshold value"
        options={[
          { value: "benchmark", label: "Live value" },
          { value: "series", label: "Series (live history)" },
        ]}
        value={thresholdType}
        onChange={setThresholdType}
      />

      <ControlRow label="Threshold">
        <ToggleChip label="Fill band" value={fill} onChange={setFill} />
        <ToggleChip
          label="Marker line"
          value={markerLine}
          onChange={setMarkerLine}
        />
        <ToggleChip label="Label" value={label} onChange={setLabel} />
        <ToggleChip
          label="Show value"
          value={showValue}
          onChange={setShowValue}
        />
      </ControlRow>

      <ChipRow
        label="Label side"
        options={[
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ]}
        value={labelSide}
        onChange={setLabelSide}
      />

      <ChipRow
        label="Colors"
        options={[
          { value: "default", label: "Green / Red" },
          { value: "custom", label: "Teal / Orange" },
        ]}
        value={colorMode}
        onChange={setColorMode}
      />

      {!isSeries && (
        <ChipRow
          label="Break-even level"
          options={[
            { value: "start", label: "At start" },
            { value: "high", label: "+3%" },
            { value: "low", label: "−3%" },
          ]}
          value={entry}
          onChange={setEntryLevel}
        />
      )}
    </DemoScreen>
  );
}
