import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import {
  LiveChart,
  type ChartOverlayContext,
  type ChartScale,
  type LiveChartHandle,
  type ScrubActionPoint,
  type ViewportConfig,
} from "react-native-livechart";
import {
  cancelAnimation,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { Chip, ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

// 5-minute window of 15s candles (20 visible), but seed ~5 windows of history so
// there's somewhere to scroll back into. `maxPoints` (tick buffer) stays well
// longer than the seed so the oldest committed candles don't re-bucket as you
// scroll into them. (Prototype — see the `timeScroll` prop.)
const WINDOW_SECS = 300;
const CANDLE_WIDTH_SECS = 15;
const HISTORY_SPAN_SECS = WINDOW_SECS * 5;

const MODE_OPTIONS: { value: "candle" | "line"; label: string }[] = [
  { value: "candle", label: "Candles" },
  { value: "line", label: "Line" },
];

type Gesture = "holdToScrub" | "axisDrag";

const GESTURE_OPTIONS: { value: Gesture; label: string }[] = [
  { value: "holdToScrub", label: "Drag / hold" },
  { value: "axisDrag", label: "Drag axis" },
];

const GESTURE_HINT: Record<Gesture, string> = {
  holdToScrub:
    "Drag with ONE finger to pan back through history; press and hold to scrub.",
  axisDrag:
    "Drag the bottom time-axis strip with ONE finger to pan back through history.",
};

const HOLD_OPTIONS: { value: number; label: string }[] = [
  { value: 350, label: "350ms" },
  { value: 500, label: "500ms" },
  { value: 750, label: "750ms" },
];

const OVERSCROLL_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Off" },
  { value: 0.5, label: "50%" },
  { value: 0.9, label: "90%" },
];

// `returnToLive` controls how the window goes back to live when timeScroll is
// switched off mid-scroll: glide (default), instant snap, or a slower glide.
type ReturnMode = "glide" | "instant" | "slow";

const RETURN_OPTIONS: { value: ReturnMode; label: string }[] = [
  { value: "glide", label: "Glide" },
  { value: "instant", label: "Instant" },
  { value: "slow", label: "Slow" },
];

const RETURN_TO_LIVE: Record<ReturnMode, boolean | { duration: number }> = {
  glide: true,
  instant: false,
  slow: { duration: 900 },
};

// `priceScroll` pans the price window with a vertical drag. "After scale" only
// engages once the price axis was dragged or the window pinched, so a vertical
// drag on an untouched chart still scrolls this demo's own ScrollView.
type PriceScroll = "off" | "afterScale" | "always";

const PRICE_SCROLL_OPTIONS: { value: PriceScroll; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "afterScale", label: "After scale" },
  { value: "always", label: "Always" },
];

function CaptureViewport({
  ctx,
  onScale,
}: {
  ctx: ChartOverlayContext;
  onScale: (scale: SharedValue<ChartScale>) => void;
}) {
  const { scale } = ctx;
  useEffect(() => onScale(scale), [scale, onScale]);
  return null;
}

function useAnnotationViewport(chartRef: React.RefObject<LiveChartHandle | null>) {
  const [active, setActive] = useState(false);
  const [fixedRange, setFixedRange] = useState(false);
  const end = useSharedValue<number | null>(null);
  const window = useSharedValue<number | null>(null);
  const range = useSharedValue<Pick<ChartScale, "min" | "max"> | null>(null);
  const drawn = useRef<SharedValue<ChartScale> | null>(null);
  const viewport = useMemo<ViewportConfig>(
    () => ({ end, window, range, windowSmoothing: false }),
    [end, window, range],
  );
  const captureScale = useCallback((scale: SharedValue<ChartScale>) => {
    drawn.current = scale;
  }, []);
  const renderOverlay = useCallback(
    (ctx: ChartOverlayContext) => <CaptureViewport ctx={ctx} onScale={captureScale} />,
    [captureScale],
  );

  // Restore the private gesture state after leaving the annotation viewport.
  useEffect(() => {
    if (!active) chartRef.current?.resetZoom();
  }, [active, chartRef]);

  const toggleRange = (fixed: boolean) => {
    const scale = drawn.current;
    if (!scale) return;
    setActive(true);
    setFixedRange(fixed);
    scheduleOnUI(() => {
      "worklet";
      const current = scale.get();
      if (fixed) {
        cancelAnimation(end);
        cancelAnimation(window);
        end.set(current.now);
        window.set(current.window);
        range.set({ min: current.min, max: current.max });
      } else {
        range.set(null);
      }
    });
  };

  const preview = (now: number, offset: number) => {
    const scale = drawn.current;
    setActive(true);
    scheduleOnUI(() => {
      "worklet";
      const width = scale?.get().window ?? WINDOW_SECS;
      cancelAnimation(end);
      cancelAnimation(window);
      window.set(width);
      end.set(now + offset * width);
    });
  };

  const returnToLive = () => {
    chartRef.current?.resetZoom();
    setFixedRange(false);
    setActive(false);
    scheduleOnUI(() => {
      "worklet";
      cancelAnimation(end);
      cancelAnimation(window);
      end.set(null);
      window.set(null);
      range.set(null);
    });
  };

  return {
    viewport: active ? viewport : false as const,
    renderOverlay,
    fixedRange,
    toggleRange,
    preview,
    returnToLive,
  };
}

export default function TimeScrollScreen() {
  const chartRef = useRef<LiveChartHandle>(null);
  const annotationViewport = useAnnotationViewport(chartRef);
  const [frozenNow, setFrozenNow] = useState<number>();
  const [mode, setMode] = useState<"candle" | "line">("candle");
  const [gesture, setGesture] = useState<Gesture>("holdToScrub");
  const [holdMs, setHoldMs] = useState(500);
  const [overscroll, setOverscroll] = useState(0);
  const [fling, setFling] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [followViewEdge, setFollowViewEdge] = useState(true);
  const [hideLiveOnScrollBack, setHideLiveOnScrollBack] = useState(true);
  // Dot tracks the true live point while scrolled back / overscrolled (keeps
  // pulsing, hides once the point leaves the window). Ignored while "Follow
  // visible edge" is on — an edge-pinned dot stays aligned with its badge.
  const [trackWhileParked, setTrackWhileParked] = useState(false);
  const [returnMode, setReturnMode] = useState<ReturnMode>("glide");
  const [zoomOn, setZoomOn] = useState(true);
  const [priceScroll, setPriceScroll] = useState<PriceScroll>("afterScale");
  const [resetButton, setResetButton] = useState(true);
  const [scrub, setScrub] = useState(true);
  const [orderTicket, setOrderTicket] = useState(true);
  const [floatAxis, setFloatAxis] = useState(true);
  const [reachedStart, setReachedStart] = useState(false);
  const [visibleWindowSecs, setVisibleWindowSecs] = useState(WINDOW_SECS);

  // candleAggregation gives us both the line `data` and `candles`; the toggle
  // just switches which the chart renders. Time-scroll is mode-agnostic — it
  // pans the window regardless of line vs candle.
  const { data, value, candles, liveCandle } = useSimulatedChartData({
    paused: frozenNow !== undefined,
    multiSeries: false,
    candleAggregation: true,
    tradeStream: false,
    candleWidth: CANDLE_WIDTH_SECS,
    historySpanSeconds: HISTORY_SPAN_SECS,
    historyRange: "1m",
    volatilityMode: "volatile",
    tradesPerSecond: 2,
    maxPoints: 10000,
  });

  const isCandle = mode === "candle";
  const hint = GESTURE_HINT[gesture];

  // Default "order ticket" (scrubAction): tap to drop a price reticle, drag to
  // adjust, press the gutter badge to fire this. Here it just echoes the chosen
  // price — enough to confirm the reticle/badge coexist with time-scroll + scrub.
  const onScrubAction = (point: ScrubActionPoint) => {
    Alert.alert("Order ticket", `Price level: ${point.price.toFixed(2)}`);
  };

  return (
    <DemoScreen
      title="Time scroll"
      docs="guides/time-scroll"
      description={`${hint} Pinch to zoom time. Drag the price axis to scale, then drag the plot vertically to pan price; the floating button resets the view. Freeze the feed, compare history and future space with Fixed price range off, then return live and turn it on to keep the same price bounds.${reachedStart ? "  ● Reached oldest data (onReachStart fired — page here)" : ""}`}
      chart={
        <LiveChart
          ref={chartRef}
          data={data}
          value={value}
          mode={mode}
          candles={isCandle ? candles : undefined}
          liveCandle={isCandle ? liveCandle : undefined}
          candleWidth={CANDLE_WIDTH_SECS}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={WINDOW_SECS}
          nowOverride={frozenNow}
          viewport={annotationViewport.viewport}
          renderOverlay={annotationViewport.renderOverlay}
          yAxis={{ float: floatAxis, scaleGesture: true }}
          badge={{ followViewEdge }}
          dot={{ trackWhileParked }}
          timeScroll={
            enabled
              ? {
                  gesture,
                  scrubHoldMs: holdMs,
                  hideLiveOnScrollBack,
                  overscroll,
                  fling,
                }
              : false
          }
          returnToLive={RETURN_TO_LIVE[returnMode]}
          zoom={zoomOn}
          // Vertical drag pans the price window (free X/Y panning with the
          // time-scroll pan). Needs the "holdToScrub" gesture above.
          priceScroll={
            priceScroll === "off" ? false : { activation: priceScroll }
          }
          // Floating reset-view button: shows once the view leaves the fitted
          // live view (scrolled back, pinched, scaled or price-panned).
          resetButton={resetButton}
          onResetView={() => console.log("reset view")}
          // Paging callbacks (Phase 3): log the visible range (~1 Hz) and show an
          // indicator while the left edge is near the oldest seeded candle. The
          // indicator persists until you scroll back to the live edge (clears on
          // `following`), rather than flashing — `onReachStart` is a one-shot
          // edge trigger (it fires once to cue a page-in, then re-arms).
          onVisibleRangeChange={(r) => {
            setVisibleWindowSecs(r.endSec - r.startSec);
            console.log(
              `visible range: ${r.startSec.toFixed(0)}–${r.endSec.toFixed(0)} following=${r.following}`,
            );
            if (r.following) setReachedStart(false);
          }}
          onReachStart={() => setReachedStart(true)}
          scrub={scrub ? { tooltip: true } : false}
          scrubAction={orderTicket}
          onScrubAction={onScrubAction}
        />
      }
    >
      <ChipRow
        label="Chart type"
        options={MODE_OPTIONS}
        value={mode}
        onChange={setMode}
      />
      <ControlRow label="Annotation viewport">
        <ToggleChip
          label={`Fixed price range: ${annotationViewport.fixedRange ? "On" : "Off"}`}
          value={annotationViewport.fixedRange}
          onChange={annotationViewport.toggleRange}
        />
        <ToggleChip
          label="Freeze feed"
          value={frozenNow !== undefined}
          onChange={(freeze) =>
            setFrozenNow(freeze ? Date.now() / 1000 : undefined)
          }
        />
      </ControlRow>
      <ControlRow label="Compare the same positions">
        <Chip
          label="History"
          active={false}
          onPress={() => annotationViewport.preview(frozenNow ?? Date.now() / 1000, -0.5)}
        />
        <Chip
          label="Future space"
          active={false}
          onPress={() => annotationViewport.preview(frozenNow ?? Date.now() / 1000, 0.65)}
        />
        <Chip
          label="Return live"
          active={false}
          onPress={annotationViewport.returnToLive}
        />
      </ControlRow>
      <ControlRow label="Live indicator behavior">
        <ToggleChip
          label="Follow visible edge"
          value={followViewEdge}
          onChange={setFollowViewEdge}
        />
        <ToggleChip
          label="Hide on scroll back"
          value={hideLiveOnScrollBack}
          onChange={setHideLiveOnScrollBack}
        />
        <ToggleChip
          label="Dot tracks live point"
          value={trackWhileParked}
          onChange={setTrackWhileParked}
        />
      </ControlRow>

      <ChipRow
        label="Scroll gesture (A/B)"
        options={GESTURE_OPTIONS}
        value={gesture}
        onChange={setGesture}
      />

      {gesture === "holdToScrub" ? (
        <ChipRow
          label="Hold to scrub"
          options={HOLD_OPTIONS}
          value={holdMs}
          onChange={setHoldMs}
        />
      ) : null}

      <ControlRow label="Pan to scroll">
        <ToggleChip label="timeScroll" value={enabled} onChange={setEnabled} />
      </ControlRow>

      <ChipRow
        label="Overscroll (visible-window fraction)"
        options={OVERSCROLL_OPTIONS}
        value={overscroll}
        onChange={setOverscroll}
      />

      <ControlRow label="Release behavior">
        <ToggleChip
          label="Fling inertia"
          value={fling}
          onChange={setFling}
        />
      </ControlRow>

      <ChipRow
        label="Return to live (toggle timeScroll off while scrolled back)"
        options={RETURN_OPTIONS}
        value={returnMode}
        onChange={setReturnMode}
      />

      <ControlRow
        label={`Pinch to zoom · visible ${Math.round(visibleWindowSecs)}s`}
      >
        <ToggleChip label="zoom" value={zoomOn} onChange={setZoomOn} />
        <Chip
          label="Reset zoom"
          active={false}
          onPress={() => chartRef.current?.resetZoom()}
        />
      </ControlRow>

      {gesture === "holdToScrub" ? (
        <ChipRow
          label="Price scroll (vertical drag pans price)"
          options={PRICE_SCROLL_OPTIONS}
          value={priceScroll}
          onChange={setPriceScroll}
        />
      ) : null}

      <ControlRow label="Reset view">
        <ToggleChip
          label="resetButton"
          value={resetButton}
          onChange={setResetButton}
        />
        <Chip
          label="resetView()"
          active={false}
          onPress={() => chartRef.current?.resetView()}
        />
      </ControlRow>

      <ControlRow label="One-finger scrub">
        <ToggleChip label="scrub" value={scrub} onChange={setScrub} />
      </ControlRow>

      <ControlRow label="Order ticket">
        <ToggleChip
          label="scrubAction"
          value={orderTicket}
          onChange={setOrderTicket}
        />
      </ControlRow>

      <ControlRow label="Full-width plot">
        <ToggleChip
          label="yAxis.float"
          value={floatAxis}
          onChange={setFloatAxis}
        />
      </ControlRow>
    </DemoScreen>
  );
}
