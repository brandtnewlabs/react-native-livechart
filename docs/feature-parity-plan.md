# Feature parity plan — `react-native-livechart` vs `@morfi/chart`

Status: **proposed** · Last updated: 2026-06-02

This plan captures every feature/config gap between our Skia/Reanimated chart and the
React/canvas `@morfi/chart` fork (v0.6.0), and maps each one to concrete library
changes **plus** a playground page (new or updated) to exercise it.

Both libraries descend from upstream `benjitaylor/liveline` `0.0.7`. Morfi is the web
fork; we are an independent RN reimplementation. Web-only surface (CSS `cursor`,
`className`/`style: CSSProperties`, `resolveCssVar`, ARIA) is **out of scope** except
where it has an RN equivalent (accessibility props).

## Conventions when porting morfi APIs

Adapt web naming to our existing idioms — do **not** copy morfi's prop names verbatim:

| morfi (web)            | ours (RN)                          |
| ---------------------- | ---------------------------------- |
| `width` (line/ref)     | `strokeWidth`                      |
| `dashPattern`          | `intervals`                        |
| `color: var(--…)`      | literal color string only          |
| `theme` + `color`      | `theme` + `accentColor`            |
| `style: CSSProperties` | `style: ViewStyle`                 |
| canvas `draw(ctx,…)`   | Skia `draw(canvas/path,…)` worklet |

Keep all data on `SharedValue`s and all per-frame work in worklets / `useDerivedValue`,
per `CLAUDE.md`. Reuse `SkPath` instances (`.rewind()`), never allocate per frame.

## How playground pages work (for reference)

- Pages live in `app/demo/*.tsx`, export `default` component + `export const options = { title }`.
- Each wraps content in `<DemoScreen description chart={…}>{controls}</DemoScreen>`
  ([DemoScreen.tsx](app/demo/lib/DemoScreen.tsx)).
- **New pages must be registered** in the `DEMOS` array in [app/index.tsx](app/index.tsx:5).
- Data comes from [useSimulatedChartData](sim/useSimulatedChartData.ts); shared constants
  (`ACCENT`, `TIME_WINDOWS`, `VOLATILITY_MODES`, `TRADE_SOURCES`, …) from
  [shared.ts](app/demo/lib/shared.ts); chips/toggles use `demoStyles`
  ([styles.ts](app/demo/lib/styles.ts)).

---

## Phase 1 — Axis & reference (high value, low/medium effort)

### 1.1 Multiple reference lines + bands + off-axis badge

**What.** Today we expose a single `referenceLine?: ReferenceLine` with only a horizontal
`value`. Morfi supports an **array** of three forms plus an off-axis indicator.

**Library API** (extend [types.ts](packages/react-native-livechart/src/types.ts:49)):
```ts
export interface ReferenceLine {
  // Form A — horizontal line
  value?: number;
  // Form B — horizontal band
  valueFrom?: number;
  valueTo?: number;
  // Form C — vertical time band (unix seconds)
  from?: number;
  to?: number;
  // Appearance
  label?: string;
  color?: string;
  strokeWidth?: number;          // was morfi `width`
  intervals?: [number, number];  // was morfi `dashPattern`
  labelColor?: string;
  labelPosition?: "left" | "center" | "right";
  showValue?: boolean;
  // Axis-range interaction
  excludeFromRange?: boolean;    // skip in y-range computation
  offAxisBadge?: boolean;        // pinned chevron pill when off-screen
  offAxisBadgeLabel?: string;
}
// Add plural prop on LiveChartCoreProps (keep singular as deprecated alias):
referenceLines?: ReferenceLine[];
```

**Implementation.**
- Generalize [ReferenceLineOverlay.tsx](packages/react-native-livechart/src/components/ReferenceLineOverlay.tsx)
  to map over an array and render bands (filled `Rect`/path between two y's, or two x's
  for time bands) in addition to lines.
- Add `excludeFromRange` handling + a `classifyReferenceEdge(value, layout)` helper feeding
  off-axis badge rendering. Wire reference values into y-range collection in
  [math/range.ts](packages/react-native-livechart/src/math/range.ts).
- Resolve in [resolveConfig.ts](packages/react-native-livechart/src/core/resolveConfig.ts).

**Playground.** **Update** [horizontal-lines.tsx](app/demo/horizontal-lines.tsx)
(title → "Reference lines & bands"). Add toggles: single line · multiple lines ·
horizontal band · time band · off-axis badge (set a target above the visible range and
confirm the chevron pill + dashed connector appear).

**Tests.** Extend reference-line unit tests: precedence A>B>C, `excludeFromRange`,
`classifyReferenceEdge` → `'in'|'above'|'below'`.

### 1.2 Y-axis bounds: `nonNegative` + `maxValue`

**What.** `nonNegative` clamps the y lower bound at 0 (prices/caps/volumes); `maxValue`
caps the upper bound (e.g. market share ≤ 1). Symmetric clamps on the computed range.

**Library API** (add to `LiveChartCoreProps`):
```ts
nonNegative?: boolean;  // default false
maxValue?: number;      // default undefined (uncapped)
```

**Implementation.** Thread both into the range computation in
[math/range.ts](packages/react-native-livechart/src/math/range.ts) and the engine tick
([liveChartEngineTick.ts](packages/react-native-livechart/src/core/liveChartEngineTick.ts),
[liveChartSeriesEngineTick.ts](packages/react-native-livechart/src/core/liveChartSeriesEngineTick.ts)).
Also fix the morfi-noted edge case: a tick landing exactly on a clamped ceiling must still
render (don't let the edge fade hide it).

**Playground.** **Update** [line-playback.tsx](app/demo/line-playback.tsx) (or add a small
"Y-axis range" section): toggles for `nonNegative` and `maxValue` presets (`1`, `100`,
off). Drive value toward 0 and toward the cap to see clamping.

**Tests.** Range computation with each clamp, and combined with `exaggerate`.

### 1.3 Grid styling + palette override + lerp speed

**What.** Three small appearance configs:
- `gridStyle` — stroke color/width/dash/opacity for grid lines.
- `palette` — partial override of individual palette keys on top of `accentColor`+`theme`.
- `lerpSpeed` — value-lerp speed (currently hardcoded internally).

**Library API:**
```ts
// LiveChartCoreProps
gridStyle?: { color?: string; strokeWidth?: number; intervals?: number[]; opacity?: number };
palette?: Partial<LiveChartPalette>;
lerpSpeed?: number;  // default 0.08
```

**Implementation.**
- `gridStyle` → [draw/grid.ts](packages/react-native-livechart/src/draw/grid.ts) +
  [YAxisOverlay.tsx](packages/react-native-livechart/src/components/YAxisOverlay.tsx).
- `palette` → merge in [theme.ts](packages/react-native-livechart/src/theme.ts) /
  [useChartColors.ts](packages/react-native-livechart/src/hooks/useChartColors.ts) after
  deriving from accent.
- `lerpSpeed` → engine ticks (replace the hardcoded factor).

**Playground.** **Update** [appearance.tsx](app/demo/appearance.tsx) (palette override +
gridStyle) and [line-playback.tsx](app/demo/line-playback.tsx) (lerpSpeed slider/presets:
Snappy / Default / Floaty).

**Tests.** Palette merge precedence; grid resolve defaults; tick lerp at varied speeds.

---

## Phase 2 — Multi-series parity

### 2.1 Per-series styling

**What.** Morfi's series carry `style` (solid/dashed), `dashPattern`, `width`, `glow`,
`kind` ('outcome'|'derived'), `valueLabel`. Our `SeriesConfig` has only
`color`/`label`/`visible`.

**Library API** (extend [SeriesConfig](packages/react-native-livechart/src/types.ts:279)):
```ts
style?: "solid" | "dashed";
intervals?: [number, number];
strokeWidth?: number;
glow?: boolean;
kind?: "outcome" | "derived";   // affects legend chip styling
valueLabel?: string;            // shown next to label in chip + endpoint
```

**Implementation.** Per-series stroke in
[MultiSeriesStroke.tsx](packages/react-native-livechart/src/components/MultiSeriesStroke.tsx)
(dash via Skia `DashPathEffect`, glow via blur layer), endpoint labels in
[MultiSeriesValueLabels.tsx](packages/react-native-livechart/src/components/MultiSeriesValueLabels.tsx),
chip styling in [SeriesToggleChips.tsx](packages/react-native-livechart/src/components/SeriesToggleChips.tsx).

**Playground.** **Update** [multi-series.tsx](app/demo/multi-series.tsx): per-series
dashed/solid, width, glow on/off, a 'derived' trajectory series styled differently.

### 2.2 Multi-series degen

**What.** Run particles + shake in multi-series mode (each series sparks off its own dot
in its own color; one shared shake from the largest swing). Today `degen` only exists on
single-series `LiveChartProps`.

**Library API.** Add `degen?: boolean | DegenOptions` to
[LiveChartSeriesProps](packages/react-native-livechart/src/types.ts:446).

**Implementation.** Per-series particle pools keyed by series id in
[useLiveChartSeriesEngine.ts](packages/react-native-livechart/src/core/useLiveChartSeriesEngine.ts)
+ [liveChartSeriesEngineTick.ts](packages/react-native-livechart/src/core/liveChartSeriesEngineTick.ts);
reuse [DegenParticlesOverlay.tsx](packages/react-native-livechart/src/components/DegenParticlesOverlay.tsx)
and the [degenTick.ts](packages/react-native-livechart/src/math/degenTick.ts) math. Re-arm
one shared shake from the largest per-series burst. Honor reduced-motion.

**Playground.** **Update** [degen.tsx](app/demo/degen.tsx): add a single ↔ multi toggle;
confirm independent per-series bursts and a shared shake.

### 2.3 Legend / series-toggle styling + series-color dash lines

**What.** Morfi's `SeriesToggleStyle` is a full styling surface; `seriesEndpoints`
supports `showDashLines: 'series-color'` (tint each endpoint dash to its stroke).

**Library API** (extend [LegendConfig](packages/react-native-livechart/src/types.ts:269)
and [MultiSeriesDotConfig](packages/react-native-livechart/src/types.ts:257)):
```ts
// LegendConfig
style?: {
  fontSize?: number; fontWeight?: FontWeight;
  gap?: number; borderRadius?: number; paddingX?: number; paddingY?: number;
  dotSize?: number; dotGap?: number;
  containerBackground?: string;
  defaultBackground?: string; defaultColor?: string;
  hiddenBackground?: string; hiddenColor?: string;
  valueColor?: string; valueFontWeight?: FontWeight;
};
// MultiSeriesDotConfig
valueLine?: boolean | ValueLineConfig | "series-color";
```

**Implementation.** [SeriesToggleChips.tsx](packages/react-native-livechart/src/components/SeriesToggleChips.tsx)
and [MultiSeriesValueLines.tsx](packages/react-native-livechart/src/components/MultiSeriesValueLines.tsx).

**Playground.** **Update** [multi-series.tsx](app/demo/multi-series.tsx): a "Legend style"
section (pill radius, compact, colors) + series-color dash toggle.

---

## Phase 3 — Marker & data overlays (larger lifts)

### 3.1 General marker system

**What.** Morfi's headline addition over upstream: `markers?: Marker[]` with 5 built-in
kinds (`trade`, `boost`, `graduation`, `winner`, `clawback`), per-marker `draw` override,
`onMarkerHover` + `markerHitRadius` hit-testing with kind-precedence tie-break. We only
have single-series `tradeStream`.

**Library API:**
```ts
export type MarkerKind = "trade" | "boost" | "graduation" | "winner" | "clawback";
export interface Marker {
  id: string;
  time: number;            // unix seconds
  kind: MarkerKind;
  seriesId?: string;       // anchor y to a series line… (multi)
  value?: number;          // …or absolute y
  color?: string;
  data?: unknown;          // pass-through for hover
  draw?: (canvas, x, y, state) => void;   // Skia worklet override
}
// Props (both components):
markers?: SharedValue<Marker[]>;
onMarkerHover?: (event: { marker: Marker; point: { x: number; y: number } } | null) => void;
markerHitRadius?: number;  // default 8; ~22 for touch
```

**Implementation.**
- New `src/draw/markers/` (one file per kind) mirroring morfi's renderers, in Skia:
  graduation (stem + flag), winner (pulsing star), boost (starburst), clawback (axis
  square), trade (reuse [draw/trade.ts](packages/react-native-livechart/src/draw/trade.ts)).
- `MARKER_KIND_PRECEDENCE` + `drawMarkerDefault` dispatcher.
- New `MarkerOverlay.tsx` reading the `SharedValue`; new `useMarkers` hook for layout +
  hit-test (touch via gesture handler → `onMarkerHover` on JS thread).
- Anchor y by `seriesId` (interpolate the series line) or absolute `value`.

**Playground.** **New page** `app/demo/markers.tsx` (register in `DEMOS`): toggles to seed
each kind, a hit-radius slider, and an `onMarkerHover` readout. Drive markers from a
`SharedValue` updated by `useSimulatedChartData`-style timers.

### 3.2 Orderbook overlay

**What.** `orderbook?: OrderbookData` (`bids`/`asks`). Streaming size-weighted labels that
fade in/out, green/red mixed toward the background by intensity, with per-entry
`label`/`color`/`id` overrides for trade-tape style. We have nothing.

**Library API:**
```ts
export interface OrderbookEntryOptions { label?: string; color?: string; id?: string }
export type OrderbookEntry =
  | readonly [number, number]                                  // [price, size]
  | (OrderbookEntryOptions & { size: number; price?: number });
export interface OrderbookData { bids: OrderbookEntry[]; asks: OrderbookEntry[] }
// Prop (single-series): orderbook?: SharedValue<OrderbookData>;
```

**Implementation.** Port morfi `draw/orderbook.ts` to Skia: a ring-buffer label state
(`OrderbookState`) advanced in the engine tick, size→intensity→alpha mixing toward
`palette.bgRgb`, per-entry `id` ⇒ spawn-once semantics. New `OrderbookOverlay.tsx`.

**Playground.** **Update** [trade-stream.tsx](app/demo/trade-stream.tsx) (already blurbs
"orderbook vs bonding-curve") or **new** `app/demo/orderbook.tsx`: drive bids/asks from the
sim's `orderbook` `TradeSource` and show intensity-weighted labels.

---

## Phase 4 — Crosshair & value display

### 4.1 Crosshair tooltip layouts

**What.** Morfi: `layout: 'multi-text' | 'per-series-pill' | 'none'` with a deep style
surface (time pill + per-series pills, `formatTimeRange`, `formatSeriesValue`, dot sizing,
label truncation). Our scrub tooltip is a single layout.

**Library API** (extend [ScrubConfig](packages/react-native-livechart/src/types.ts:113)):
```ts
layout?: "single" | "per-series-pill" | "none";   // "single" = current behavior
timePill?: { background?: string; color?: string; borderColor?: string; radius?: number };
seriesPill?: { background?: string; color?: string; radius?: number; dotSize?: number };
formatTimeRange?: (from: number, to: number) => string;
maxLabelChars?: number;
```

**Implementation.** [CrosshairOverlay.tsx](packages/react-native-livechart/src/components/CrosshairOverlay.tsx)
+ [MultiSeriesTooltipStack.tsx](packages/react-native-livechart/src/components/MultiSeriesTooltipStack.tsx)
(per-series-pill: a time pill at top-center + one pill at each series intersection).

**Playground.** **Update** [scrub.tsx](app/demo/scrub.tsx) (layout switch) and
[multi-series.tsx](app/demo/multi-series.tsx) (per-series-pill demo).

### 4.2 Live value text overlay: `showValue` + `valueMomentumColor`

**What.** `showValue` renders the live value as a large text overlay; `valueMomentumColor`
tints it green/red by momentum.

**Library API** (single-series `LiveChartProps`):
```ts
showValue?: boolean;            // default false
valueMomentumColor?: boolean;   // default false
```

**Implementation.** Reuse [AnimatedLabel.tsx](packages/react-native-livechart/src/components/AnimatedLabel.tsx)
driven by the engine's smoothed value + momentum `SharedValue`s; format via `formatValue`.

**Playground.** **Update** [badge-pulse.tsx](app/demo/badge-pulse.tsx) or
[momentum.tsx](app/demo/momentum.tsx): toggle the value overlay and momentum coloring.

---

## Phase 5 — Optional / host-owned (decide per use case)

These are lower priority — several are arguably better owned by the host app in RN.

### 5.1 Historical data fill: `windowBuffer` + `nowOverride`
Right-edge buffer fraction (0 ⇒ latest point hits the edge) and an engine "now" override
so historical data fills edge-to-edge. Thread into the engine ticks + layout.
**Playground:** new `app/demo/historical-data.tsx` — replay a fixed historical span filling
the full width (`windowBuffer=0`, `nowOverride=maxT`).

### 5.2 Built-in time-range selector: `windows` / `onWindowChange` / `windowStyle`
A built-in row of 1m/5m/1h… buttons. We already have `TIME_WINDOWS` in
[shared.ts](app/demo/lib/shared.ts:33); decide whether to ship the selector UI in the
library or leave it host-owned. **Playground:** new `app/demo/time-windows.tsx`.

### 5.3 Built-in mode toggle: `onModeChange`
A built-in candle↔line toggle row (we already have the `mode` prop + internal
`useModeBlend`). **Playground:** update [candlestick.tsx](app/demo/candlestick.tsx).

### 5.4 Chart transition wrapper (`LivelineTransition` equivalent)
A cross-fade wrapper between two chart instances. RN version via Reanimated opacity.
**Playground:** new `app/demo/transitions.tsx` (line ↔ candle cross-fade).

### 5.5 Accessibility props
RN equivalents of morfi's ARIA: `accessibilityLabel` / `accessibilityRole` on the chart
container (add to `LiveChartCoreProps`). No dedicated page — fold into existing screens.

---

## Suggested order & sizing

| Phase | Items | Rough size |
| ----- | ----- | ---------- |
| 1 | reference lines/bands, y-bounds, grid/palette/lerp | M |
| 2 | per-series style, multi degen, legend style | M |
| 3 | markers, orderbook | L |
| 4 | crosshair layouts, value overlay | M |
| 5 | windowBuffer/nowOverride, window selector, mode toggle, transition, a11y | S–M each |

Each item is additive and independently shippable. Recommended first cut: **1.1, 1.2,
2.1** (broadest utility), then the **marker system (3.1)** since it builds on the existing
`tradeStream` plumbing.

## Definition of done (per item)

- [ ] Library types + `resolveConfig` updated; defaults documented.
- [ ] Worklet-safe rendering; `SkPath` reuse; no per-frame allocation.
- [ ] Unit tests for pure logic (ticks, range, resolve, hit-test) ≥ existing coverage
      thresholds (branches 90 / funcs 95 / lines 95 / stmts 95).
- [ ] Playground page added/updated **and registered** in
      [app/index.tsx](app/index.tsx:5) `DEMOS`.
- [ ] `npm run verify` (typecheck + lint + test) green.
- [ ] README/CHANGELOG note for the new prop(s).
</content>
</invoke>
