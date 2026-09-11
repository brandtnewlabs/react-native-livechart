import { useState } from "react";
import {
  LiveChart,
  type CandlePoint,
  type LiveChartPoint,
  type ReferenceLine,
} from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import {
  useSimulatedChartData,
  type HistoryRange,
} from "../../sim/useSimulatedChartData";

/**
 * Candle timeframes. Each pairs a visible window with a candle width AND a
 * `seedRange` whose ideal sampling interval is far finer than `candleWidthSecs`,
 * so every OHLC bucket aggregates many sub-candle ticks. That density is what
 * gives each candle a real body + wick — a bucket holding a single point
 * collapses to a flat horizontal line. (`seedRange` only sets the seed's point
 * spacing; `historySpanSeconds` sets the actual span = visible window.)
 */
const TIMEFRAMES = [
  { label: "5m · 15s", windowSecs: 300, candleWidthSecs: 15, seedRange: "1m" },
  { label: "15m · 1m", windowSecs: 900, candleWidthSecs: 60, seedRange: "5m" },
  { label: "1h · 5m", windowSecs: 3600, candleWidthSecs: 300, seedRange: "1h" },
] as const satisfies readonly {
  label: string;
  windowSecs: number;
  candleWidthSecs: number;
  seedRange: HistoryRange;
}[];

type TimeframeLabel = (typeof TIMEFRAMES)[number]["label"];

const TIMEFRAME_OPTIONS = TIMEFRAMES.map((t) => ({
  value: t.label,
  label: t.label,
}));

/** Distinct from the default green/red so the palette override reads as a candle feature. */
const CUSTOM_CANDLE_PALETTE = {
  candleUp: "#14b8a6",
  candleDown: "#f97316",
  wickUp: "#0d9488",
  wickDown: "#ea580c",
};

const ROUNDING_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Sharp" },
  { value: 3, label: "3px" },
  { value: 6, label: "6px" },
];

const WICK_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1px" },
  { value: 2, label: "2px" },
  { value: 3, label: "3px" },
];

const VOLUME_HEIGHT_OPTIONS: { value: number; label: string }[] = [
  { value: 32, label: "32px" },
  { value: 48, label: "48px" },
  { value: 72, label: "72px" },
];

const VOLUME_ROUND_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Sharp" },
  { value: 2, label: "2px" },
  { value: 6, label: "6px" },
];

/** Distinct violet bars so the volume color override reads as a feature. */
const CUSTOM_VOLUME_COLORS = { upColor: "#8b5cf6", downColor: "#4c1d95" };

/**
 * Historical average-cost changes from a realistic averaging-in flow. Adjacent
 * points around each fill make the cost basis step at that timestamp instead of
 * drifting diagonally between fills.
 */
function buildAverageCostSeries(anchor: number): LiveChartPoint[] {
  return [
    { time: anchor - 3_600, value: 100.8 },
    { time: anchor - 780.01, value: 100.8 },
    { time: anchor - 780, value: 99.6 },
    { time: anchor - 360.01, value: 99.6 },
    { time: anchor - 360, value: 101.2 },
    { time: anchor - 90.01, value: 101.2 },
    { time: anchor - 90, value: 100.4 },
    { time: anchor - 30, value: 100.4 },
  ];
}

export default function CandlestickScreen() {
  const [tfLabel, setTfLabel] = useState<TimeframeLabel>("15m · 1m");
  const [stripCandles, setStripCandles] = useState(false);
  const [customColors, setCustomColors] = useState(false);
  const [rounding, setRounding] = useState(3);
  const [wickWidth, setWickWidth] = useState(1);
  const [volume, setVolume] = useState(true);
  const [volumeHeight, setVolumeHeight] = useState(48);
  const [volumeRound, setVolumeRound] = useState(2);
  const [customVolumeColors, setCustomVolumeColors] = useState(false);
  const [snapToCandles, setSnapToCandles] = useState(false);
  const [averageCost, setAverageCost] = useState(true);
  const [extendAverageCost, setExtendAverageCost] = useState(true);
  const [referenceAnchor] = useState(() => Date.now() / 1000);

  const tf = TIMEFRAMES.find((t) => t.label === tfLabel) ?? TIMEFRAMES[1];
  const candleWidthSecs = tf.candleWidthSecs;

  const emptyCandles = useSharedValue<CandlePoint[]>([]);
  const nullLive = useSharedValue<CandlePoint | null>(null);

  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: true,
    tradeStream: false,
    candleWidth: candleWidthSecs,
    // Span = visible window; `seedRange` supplies the fine sampling interval so
    // each candle bucket gets dozens of ticks (real bodies + wicks).
    historySpanSeconds: tf.windowSecs,
    historyRange: tf.seedRange,
    volatilityMode: "volatile",
    // The sim re-buckets a sliding `maxPoints` tick buffer every trade, so a
    // buffer shorter than the window would evict still-visible ticks and make
    // the oldest *committed* candle mutate each trade. Keep the buffer well
    // longer than the largest window (3600s): 10000 / 2 tps = 5000s of history.
    tradesPerSecond: 2,
    maxPoints: 10000,
  });

  const referenceLines: ReferenceLine[] = averageCost
    ? [
        {
          id: "average-cost",
          series: buildAverageCostSeries(referenceAnchor),
          extendToNow: extendAverageCost,
          label: "Avg cost",
          showValue: true,
          labelPosition: "right",
          color: "#f59e0b",
          labelColor: "#b45309",
          strokeWidth: 2,
          intervals: [6, 4],
        },
      ]
    : [];

  return (
    <DemoScreen
      title="Candlestick"
      docs="guides/candlestick"
      description={`mode="candle" with ${candleWidthSecs}s OHLC buckets plus a historical average-cost reference series. Each candle aggregates many ticks, so it shows a real body + wick. A single committed candle is enough to draw.`}
      chart={
        <LiveChart
          data={data}
          value={value}
          mode="candle"
          candles={stripCandles ? emptyCandles : candles}
          liveCandle={stripCandles ? nullLive : liveCandle}
          candleWidth={candleWidthSecs}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={tf.windowSecs}
          palette={customColors ? CUSTOM_CANDLE_PALETTE : undefined}
          metrics={{ candle: { bodyRadius: rounding, wickWidth } }}
          volume={
            volume
              ? {
                  maxHeight: volumeHeight,
                  radius: volumeRound,
                  ...(customVolumeColors ? CUSTOM_VOLUME_COLORS : {}),
                }
              : false
          }
          scrub={{ tooltip: true, snapToCandles }}
          referenceLines={referenceLines}
        />
      }
    >
      <ControlRow label="Reference series">
        <ToggleChip
          label="Historical average cost"
          value={averageCost}
          onChange={setAverageCost}
        />
        {averageCost ? (
          <ToggleChip
            label="Extend to live edge"
            value={extendAverageCost}
            onChange={setExtendAverageCost}
          />
        ) : null}
      </ControlRow>

      <ChipRow
        label="Timeframe (window · candle)"
        options={TIMEFRAME_OPTIONS}
        value={tfLabel}
        onChange={setTfLabel}
      />

      <ChipRow
        label="Body radius"
        options={ROUNDING_OPTIONS}
        value={rounding}
        onChange={setRounding}
      />

      <ChipRow
        label="Wick width"
        options={WICK_OPTIONS}
        value={wickWidth}
        onChange={setWickWidth}
      />

      <ControlRow label="Candle colors">
        <ToggleChip
          label="Teal / orange palette"
          value={customColors}
          onChange={setCustomColors}
        />
      </ControlRow>

      <ControlRow label="Volume bars">
        <ToggleChip label="Show volume" value={volume} onChange={setVolume} />
      </ControlRow>

      {volume && (
        <>
          <ChipRow
            label="Volume height"
            options={VOLUME_HEIGHT_OPTIONS}
            value={volumeHeight}
            onChange={setVolumeHeight}
          />

          <ChipRow
            label="Volume rounding"
            options={VOLUME_ROUND_OPTIONS}
            value={volumeRound}
            onChange={setVolumeRound}
          />

          <ControlRow label="Volume colors">
            <ToggleChip
              label="Violet bars"
              value={customVolumeColors}
              onChange={setCustomVolumeColors}
            />
          </ControlRow>
        </>
      )}

      <ControlRow label="Scrub crosshair">
        <ToggleChip
          label="Snap to candles"
          value={snapToCandles}
          onChange={setSnapToCandles}
        />
      </ControlRow>

      <ControlRow label="Empty state">
        <ToggleChip
          label="No committed candles"
          value={stripCandles}
          onChange={setStripCandles}
        />
      </ControlRow>
    </DemoScreen>
  );
}
