import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  LiveChart,
  type CandlePoint,
  type LiveChartPoint,
} from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import { DemoScreen } from "./DemoScreen";

function createQASeed() {
  const now = Math.floor(Date.now() / 2000) * 2;
  const candles: CandlePoint[] = [],
    points: LiveChartPoint[] = [];
  for (let i = 0; i < 600; i++) {
    const price = 100 + 20 * Math.sin(i * 0.25) + 10 * Math.sin(i * 1.1),
      time = now - 1200 + i * 2;
    candles.push({
      time,
      open: price - 5 * Math.sin(i),
      close: price,
      high: price + 8,
      low: price - 8,
      volume: 40 + (i % 13) * 20,
    });
    points.push({ time, value: price });
  }
  return { now, candles, points };
}

const control = (label: string, onPress: () => void) => (
  <Pressable
    key={label}
    accessibilityRole="button"
    onPress={onPress}
    style={{ padding: 10, backgroundColor: "#eeebff", borderRadius: 6 }}
  >
    <Text>{label}</Text>
  </Pressable>
);

function toggle(
  onLabel: string,
  offLabel: string,
  value: boolean,
  onPress: () => void,
) {
  return control(value ? onLabel : offLabel, onPress);
}

export function VolumeLineQA() {
  const [seed] = useState(createQASeed);
  const candles = useSharedValue(seed.candles),
    data = useSharedValue(seed.points),
    value = useSharedValue(100);
  const threshold = useSharedValue(100);
  const live = useSharedValue<CandlePoint | null>(null);
  const emptyCandles = useSharedValue<CandlePoint[]>([]),
    emptyData = useSharedValue<LiveChartPoint[]>([]),
    emptyLive = useSharedValue<CandlePoint | null>(null);
  const [paused, setPaused] = useState(false),
    [spike, setSpike] = useState(false),
    [rounded, setRounded] = useState(false),
    [wide, setWide] = useState(false),
    [empty, setEmpty] = useState(false),
    [linear, setLinear] = useState(false),
    [gaps, setGaps] = useState(false);
  const [revision, setRevision] = useState(0);
  const [candleView, setCandleView] = useState("Live");
  const [lineView, setLineView] = useState("Live");
  useEffect(() => {
    if (paused) return;
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      const now = Date.now() / 1000,
        price =
          100 +
          30 * Math.sin(now * 2) +
          (spike ? 250 * Math.pow(Math.max(0, Math.sin(now)), 8) : 0);
      value.set(price);
      const next = {
        time: Math.floor(now / 2) * 2,
        open: 100,
        close: price,
        high: Math.max(110, price),
        low: Math.min(80, price),
        volume: spike ? 6000 : 100 + (tick % 10) * 20,
      };
      const previous = live.get();
      if (previous && previous.time !== next.time)
        candles.set([...candles.get().slice(-599), previous]);
      live.set(next);
      data.set([...data.get().slice(-1199), { time: now, value: price }]);
    }, 100);
    return () => clearInterval(id);
  }, [paused, spike, candles, data, value, live]);
  const gap = useMemo(
    () =>
      gaps
        ? [
            {
              from: seed.now - 25,
              to: seed.now - 15,
              kind: "unavailable" as const,
            },
          ]
        : [],
    [gaps, seed.now],
  );
  const editHistory = () => {
    const high = revision % 2 === 0;
    scheduleOnUI(() => {
      "worklet";
      candles.modify((items) => {
        "worklet";
        for (let i = Math.max(0, items.length - 20); i < items.length; i++)
          items[i].volume = high ? 12000 : 80;
        return items;
      });
    });
    setRevision((v) => v + 1);
  };
  return (
    <DemoScreen
      title="Volume + line QA"
      description="Live candles, volume spikes and shared line/fill curves"
      chartWrapperStyle={{ height: 430 }}
      chart={
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12 }}>
            Candles + volume ·{" "}
            {spike ? "6,000 live volume" : "normal live volume"} · {candleView}
          </Text>
          <View style={{ height: 190 }}>
            <LiveChart
              data={empty ? emptyData : data}
              value={value}
              mode="candle"
              candles={empty ? emptyCandles : candles}
              liveCandle={empty ? emptyLive : live}
              timeScroll={{ gesture: "holdToScrub", fling: false }}
              zoom
              onVisibleRangeChange={(r) =>
                setCandleView(
                  `${r.following ? "Live" : "History"} ${Math.round(r.endSec - r.startSec)}s`,
                )
              }
              candleWidth={2}
              timeWindow={wide ? 400 : 60}
              volume={{ maxHeight: 45, radius: rounded ? 4 : 0 }}
              metrics={{ candle: { bodyRadius: rounded ? 3 : 0 } }}
              candleGaps={gap}
              scrub={{ tooltip: true, snapToCandles: true }}
            />
          </View>
          <Text style={{ fontSize: 12 }}>
            Line + fill · {linear ? "linear" : "smooth"} · {lineView}
          </Text>
          <View style={{ height: 210 }}>
            <LiveChart
              data={empty ? emptyData : data}
              value={value}
              timeWindow={wide ? 400 : 60}
              timeScroll={{ gesture: "holdToScrub", fling: false }}
              zoom
              onVisibleRangeChange={(r) =>
                setLineView(
                  `${r.following ? "Live" : "History"} ${Math.round(r.endSec - r.startSec)}s`,
                )
              }
              line={{ curve: linear ? "linear" : "monotone" }}
              lineGaps={gap}
              threshold={{ value: threshold, fill: true }}
              scrub={{ tooltip: true }}
            />
          </View>
        </View>
      }
    >
      <Text style={{ marginBottom: 10 }}>
        History edits: {revision} · {paused ? "Feed paused" : "Feed live"}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {toggle("Resume feed", "Pause feed", paused, () =>
          setPaused((v) => !v),
        )}
        {toggle("Normal volume", "Spike price + volume", spike, () =>
          setSpike((v) => !v),
        )}
        {toggle("Sharp bars", "Rounded bars", rounded, () =>
          setRounded((v) => !v),
        )}
        {toggle("60 seconds", "400 seconds", wide, () => setWide((v) => !v))}
        {control("Edit history in place", editHistory)}
        {toggle("Smooth line", "Linear line", linear, () =>
          setLinear((v) => !v),
        )}
        {toggle("Remove gaps", "Add gaps", gaps, () => setGaps((v) => !v))}
        {toggle("Restore data", "Empty data", empty, () => setEmpty((v) => !v))}
      </View>
    </DemoScreen>
  );
}
