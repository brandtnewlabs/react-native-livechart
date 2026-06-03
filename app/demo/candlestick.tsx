import { useState } from "react";
import type { CandlePoint } from "react-native-livechart";
import { LiveChart } from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { Chip, ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import {
  ACCENT,
  HISTORY_RANGE_PRESETS,
  TIME_WINDOWS,
  viewportSecsForHistoryPreset,
} from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import {
  useSimulatedChartData,
  type HistoryRange,
} from "../../sim/useSimulatedChartData";

export const options = { title: "Candlestick" };

const WINDOW_OPTIONS = TIME_WINDOWS.map((w) => ({ value: w.secs, label: w.label }));

export default function CandlestickScreen() {
  const [historyRange, setHistoryRange] = useState<HistoryRange>("1d");
  const [windowSecs, setWindowSecs] = useState(300);
  const [stripCandles, setStripCandles] = useState(false);
  const candleWidthSecs = Math.max(5, Math.round(windowSecs / 20));

  const emptyCandles = useSharedValue<CandlePoint[]>([]);
  const nullLive = useSharedValue<CandlePoint | null>(null);

  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: true,
    tradeStream: false,
    candleWidth: candleWidthSecs,
    historyRange,
    tradesPerSecond: 5,
  });

  return (
    <DemoScreen
      docs="guides/candlestick"
      description={`mode=candle, candleWidth=${candleWidthSecs}s. Needs ≥2 committed candles for the chart (live bar alone is not enough).`}
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
          timeWindow={windowSecs}
          scrub={{ tooltip: true }}
        />
      }
    >
      <ControlRow label="History span">
        {HISTORY_RANGE_PRESETS.map((r) => (
          <Chip
            key={r.preset}
            label={r.label}
            active={historyRange === r.preset}
            onPress={() => {
              setHistoryRange(r.preset);
              setWindowSecs(viewportSecsForHistoryPreset(r.preset));
            }}
          />
        ))}
      </ControlRow>

      <ControlRow label="Data">
        <ToggleChip
          label="No committed candles"
          value={stripCandles}
          onChange={setStripCandles}
        />
      </ControlRow>

      <ChipRow
        label="Time window"
        options={WINDOW_OPTIONS}
        value={windowSecs}
        onChange={setWindowSecs}
      />
    </DemoScreen>
  );
}
