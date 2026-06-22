import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  LiveChart,
  type CandlePoint,
  type ReferenceLine,
  type ScrubActionPoint,
} from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ChipRow, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { ACCENT } from "../../demo-lib/shared";
import { APP_THEME, colors } from "../../demo-lib/theme";
import { useSimulatedChartData } from "../../sim/useSimulatedChartData";

export const options = { title: "Order ticket" };

type DisplayMode = "line" | "candle";

const DISPLAY_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "candle", label: "Candle" },
];

const WINDOW_SECS = 300;
const CANDLE_WIDTH_SECS = 15;

type WorkingOrder = { side: "buy" | "sell"; price: number };

// Custom `formatTime` for the reticle's time badge: an exact date + clock.
// `formatTime` runs on the UI thread (axis labels, tooltip, and the scrubAction
// time badge all call it inside worklets), so this MUST be a worklet and use
// worklet-safe ops — `new Date` getters + manual padding, NOT Intl/toLocaleString.
function formatDateTime(t: number) {
  "worklet";
  const d = new Date(t * 1000);
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mo}/${da} ${hh}:${mi}`; // e.g. "06/10 16:34"
}

/**
 * "Order ticket" demo for `scrubAction`. Tap the chart to drop a price reticle,
 * drag to fine-tune, then press the right-gutter `+` badge. The callback opens a
 * sheet that derives BUY/SELL from the chosen price vs the live price (the
 * library asserts no side); confirming pushes a `referenceLines` working order.
 */
export default function ScrubActionScreen() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("candle");
  const [snap, setSnap] = useState(false);
  const [iconOnly, setIconOnly] = useState(false);
  // Action glyph: default "+" vs a confirm "✓" (rendered as chart text).
  const [checkIcon, setCheckIcon] = useState(false);
  // Empty-plot tap clears the reticle instead of re-placing it.
  const [dismissOnTapOutside, setDismissOnTapOutside] = useState(false);
  // Opt-in x-axis time badge (off by default — time is incidental to a price order).
  const [showTime, setShowTime] = useState(false);
  // Swap the time badge's clock-only label for an exact date + time (worklet
  // formatter). Only meaningful when the Time badge is on.
  const [exactTime, setExactTime] = useState(false);
  // Working-order badge: icon + label vs an icon-only tag.
  const [orderIconOnly, setOrderIconOnly] = useState(false);
  const [orders, setOrders] = useState<WorkingOrder[]>([]);
  // The order being confirmed (set on badge press, cleared on confirm/cancel).
  const [pending, setPending] = useState<{
    side: "buy" | "sell";
    price: number;
  } | null>(null);
  // The working order whose line was tapped (index into `orders`); opens the
  // cancel sheet. null when no order is selected.
  const [cancelIdx, setCancelIdx] = useState<number | null>(null);

  const emptyCandles = useSharedValue<CandlePoint[]>([]);
  const nullLive = useSharedValue<CandlePoint | null>(null);

  const { data, value, candles, liveCandle } = useSimulatedChartData({
    multiSeries: false,
    candleAggregation: displayMode === "candle",
    tradeStream: false,
    candleWidth: CANDLE_WIDTH_SECS,
    historySpanSeconds: WINDOW_SECS,
    historyRange: "1m",
    volatilityMode: "volatile",
    maxPoints: 6000,
  });

  // onScrubAction runs on the JS thread; read the live value off the SharedValue
  // closure to decide the side (buy below market / sell above — a convention the
  // app owns, not the library).
  const onScrubAction = (point: ScrubActionPoint) => {
    const last = value.get();
    setPending({ side: point.price < last ? "buy" : "sell", price: point.price });
  };

  const confirmOrder = () => {
    if (pending) setOrders((prev) => [...prev, pending]);
    setPending(null);
  };

  // onReferenceLinePress fires when a working-order badge is tapped. `index` is
  // the order's position in `referenceLines` (= `orders`, same order), so it maps
  // straight back to the order to cancel.
  const cancelOrder = () => {
    if (cancelIdx !== null) {
      setOrders((prev) => prev.filter((_, i) => i !== cancelIdx));
    }
    setCancelIdx(null);
  };
  const cancelTarget = cancelIdx !== null ? orders[cancelIdx] : undefined;

  const referenceLines: ReferenceLine[] = orders.map((o) => {
    const color = o.side === "buy" ? "#16a34a" : "#dc2626";
    return {
      value: o.price,
      label: o.side === "buy" ? "Limit buy" : "Limit sell",
      showValue: true,
      // `excludeFromRange` keeps a far order from distorting the axis — it then
      // pins to the edge as an off-screen badge instead.
      excludeFromRange: true,
      color,
      labelColor: color,
      strokeWidth: 1,
      intervals: [4, 4],
      // Pill badge with a directional icon (and optional text). Left-pinned with a
      // connector to the right edge; gains a chevron once it scrolls off-screen.
      badge: {
        icon: o.side === "buy" ? "+" : "−",
        text: !orderIconOnly,
        background:
          o.side === "buy" ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.15)",
        borderColor: color,
        radius: 6,
      },
    };
  });

  return (
    <DemoScreen
      title="Order ticket"
      docs="guides/order-ticket"
      description="scrubAction: tap to drop a price reticle, drag to adjust, press the + badge to place a limit order. Confirmed orders become working-order lines — tap an order's badge to cancel it."
      chart={
        <LiveChart
          data={data}
          value={value}
          mode={displayMode}
          candles={displayMode === "candle" ? candles : emptyCandles}
          liveCandle={displayMode === "candle" ? liveCandle : nullLive}
          candleWidth={CANDLE_WIDTH_SECS}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={WINDOW_SECS}
          referenceLines={referenceLines}
          // Scrub coexists with scrubAction: drag before placing a reticle to
          // scrub (crosshair + readout); tap to drop a reticle, then drag to
          // adjust it. (dimOpacity 1 keeps the working-order lines un-dimmed.)
          scrub={{ dimOpacity: 1 }}
          scrubAction={{
            icon: checkIcon ? "✓" : "+",
            snap: snap ? 0.5 : undefined,
            text: !iconOnly,
            timeBadge: showTime,
            dismissOnTapOutside,
          }}
          // Exact date + time formatter for the time badge (worklet — runs on the
          // UI thread). Only swapped in when the date variant is chosen.
          formatTime={exactTime ? formatDateTime : undefined}
          onScrubAction={onScrubAction}
          // Tap a working-order badge to manage it — here, open a cancel sheet.
          onReferenceLinePress={(_line, index) => setCancelIdx(index)}
        />
      }
    >
      <ChipRow
        label="Display"
        options={DISPLAY_OPTIONS}
        value={displayMode}
        onChange={setDisplayMode}
      />

      <ControlRow label="Badge">
        <ToggleChip label="Snap to 0.5" value={snap} onChange={setSnap} />
        <ToggleChip label="Icon only" value={iconOnly} onChange={setIconOnly} />
        {/* scrubAction.icon: default "+" vs a confirm "✓" glyph. */}
        <ToggleChip
          label="✓ glyph"
          value={checkIcon}
          onChange={setCheckIcon}
        />
        {/* scrubAction.dismissOnTapOutside: empty-plot tap clears the reticle. */}
        <ToggleChip
          label="Tap-outside dismiss"
          value={dismissOnTapOutside}
          onChange={setDismissOnTapOutside}
        />
      </ControlRow>

      <ControlRow label="Time badge">
        <ToggleChip label="Show" value={showTime} onChange={setShowTime} />
        {/* Custom worklet formatTime → exact date + time. Only bites with Show on. */}
        <ToggleChip
          label="Exact date+time"
          value={exactTime}
          onChange={setExactTime}
        />
      </ControlRow>

      <ControlRow label="Order badge">
        <ToggleChip
          label="Icon only"
          value={orderIconOnly}
          onChange={setOrderIconOnly}
        />
      </ControlRow>

      <ControlRow label="Working orders">
        <ToggleChip
          label={`Clear (${orders.length})`}
          value={false}
          onChange={() => setOrders([])}
        />
      </ControlRow>

      {/* Order-confirmation sheet, opened by the badge press. */}
      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPending(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPending(null)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {pending?.side === "buy" ? "Limit buy" : "Limit sell"}
            </Text>
            <Text style={styles.sheetPrice}>
              @ ${pending?.price.toFixed(2)}
            </Text>
            <View style={styles.sheetRow}>
              <Pressable
                style={[styles.sheetButton, styles.sheetCancel]}
                onPress={() => setPending(null)}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.sheetButton,
                  {
                    backgroundColor:
                      pending?.side === "buy" ? "#16a34a" : "#dc2626",
                  },
                ]}
                onPress={confirmOrder}
              >
                <Text style={styles.sheetConfirmText}>
                  Place {pending?.side === "buy" ? "buy" : "sell"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Cancel sheet, opened by tapping a working-order badge (onReferenceLinePress). */}
      <Modal
        visible={cancelTarget !== undefined}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelIdx(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setCancelIdx(null)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              Cancel {cancelTarget?.side === "buy" ? "limit buy" : "limit sell"}?
            </Text>
            <Text style={styles.sheetPrice}>
              @ ${cancelTarget?.price.toFixed(2)}
            </Text>
            <View style={styles.sheetRow}>
              <Pressable
                style={[styles.sheetButton, styles.sheetCancel]}
                onPress={() => setCancelIdx(null)}
              >
                <Text style={styles.sheetCancelText}>Keep</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetButton, { backgroundColor: "#dc2626" }]}
                onPress={cancelOrder}
              >
                <Text style={styles.sheetConfirmText}>Cancel order</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "600" },
  sheetPrice: { color: colors.textMuted, fontSize: 15, marginTop: 4 },
  sheetRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  sheetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  sheetCancel: { backgroundColor: colors.chipBackground },
  sheetCancelText: { color: colors.chipText, fontWeight: "600" },
  sheetConfirmText: { color: "#ffffff", fontWeight: "600" },
});
