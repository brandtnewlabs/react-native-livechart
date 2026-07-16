# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Short taps no longer strand a delayed scrub crosshair on iOS.** When a
  stationary press ended before `scrub.panGestureDelay` /
  `timeScroll.scrubHoldMs`, React Native Gesture Handler could fire its pending
  long-press timer after the finger was already up, leaving the crosshair active
  without a matching gesture end. Both `LiveChart` and `LiveChartSeries` now
  fail that pending pan on the final pointer-up and ignore any raced activation;
  zero-delay scrubbing is unchanged. Thanks [@ianlapham](https://github.com/ianlapham).
  ([#206](https://github.com/brandtnewlabs/react-native-livechart/pull/206))

## [4.9.2] - 2026-07-15

### Changed

- **Disabled `LiveChart` subsystems no longer register their UI-thread worklets.**
  Axis, badge, trade-tape, custom-overlay, degen, and line-vs-candle rendering
  hooks now live in conditionally mounted child components. Minimal line charts
  avoid compiling and retaining worklets for features they do not use.
- **Crosshair geometry now publishes two coherent snapshots instead of twelve
  chained derived values.** Scrub and locked-reticle state still expose the same
  individual SharedValues, but compile fewer Hermes worklets and no longer pass
  through intermediate mixed-frame geometry while dependent mappers settle.

## [4.9.1] - 2026-07-06

### Changed

- **`LiveChartSeries` hides the scrub selection dot by default** (`selectionDot`
  now defaults to `false` on the multi-series chart; `LiveChart` is unchanged).
  With multiple lines the dot could only track the leading series, which read as
  a stray dot following one line while scrubbing — the crosshair + per-series
  tooltip stack already mark the scrub point. Pass `selectionDot` (or a
  `SelectionDotConfig`) explicitly to opt back in.

### Fixed

- **Y-axis now adapts to the visible window while time-scrolled.** While panned
  back through history (`timeScroll`), the engine's Y-range folded in data
  *newer* than the frozen window edge, the in-progress live candle, and the live
  price — so the axis stayed pinned to the live range instead of re-fitting the
  history on screen. All three are now excluded from the range while scrolled
  back (line + candle, single- and multi-series); live-following behavior is
  unchanged.
- **Skia system-font matching is now cached module-wide** (`matchFont` per
  `{family, size, weight}` instead of per chart per render). Screens that mount
  many charts at once no longer pay ~4 native font lookups per chart per render —
  measured ~40% faster time-to-rendered on the example app's Sparklines screen
  (25 static charts).

## [4.9.0] - 2026-07-06

### Added

- **Time-varying `threshold`** — `ThresholdConfig.value` now also accepts a
  `LiveChartPoint[]` series, not just a `SharedValue<number>`. The stroke split,
  profit/loss fill band and marker line follow the threshold **point-for-point**
  instead of a single horizontal level — a stepped break-even / average cost as
  you DCA, a historical VWAP, a moving peg. The series clamps to its first/last
  value outside its own time range, so a threshold whose last point sits behind
  the live edge extends as a flat line to "now". Single-series `LiveChart`, line
  mode (unchanged). The constant `SharedValue<number>` form is untouched; the two
  are distinguished at render by `Array.isArray` (no `SharedValue` read), and the
  series renders via a per-fragment split shader so the polyline boundary stays
  one GPU draw with no per-frame clip. Also ships: **`threshold.series`** — a
  live `SharedValue<LiveChartPoint[]>` form that updates with `.set()` and no
  re-render (a per-tick VWAP, mirroring the `data` prop); **`fill: { opacity }`**
  to tune the P/L band (default `0.16`, parity with reference-line bands);
  **`includeInRange`** to fold the threshold into the Y-range fit like reference
  lines (an off-range break-even stays on-plot); **`extendToNow: false`** to stop
  a series at its last point instead of projecting flat to "now"; and
  **`line.labelColor`** for the marker badge text. Thanks
  [@fsher](https://github.com/fsher).
  ([#174](https://github.com/brandtnewlabs/react-native-livechart/issues/174))

## [4.8.0] - 2026-07-02

### Added

- **`LoadingConfig.axisLabels`** (`boolean`, default `true`). Set `false` to hide the
  loading shell's skeleton Y-axis label placeholders and show only the breathing
  squiggle. Resolves through `resolveLoading`, so it works on both `LiveChart` and
  `LiveChartSeries` (`loading={{ axisLabels: false }}`). Thanks @dszym00.

### Fixed

- **Crash `[Worklets] Cannot copy value of type PanGesture` on
  `react-native-worklets` ≥ 0.10** (Reanimated ≥ 4.5, Expo SDK 57, RN 0.86).
  Several `"worklet"` closures in `LiveChart` / `LiveChartSeries` referenced
  `crosshair.scrubActive`, which made the worklets Babel plugin capture the whole
  `crosshair` object — including the non-serializable `gesture` (`Gesture.Pan()`)
  it also returns. Worklets 0.10 removed the silent fallback for unknown class
  instances and now throws on serialization, so scrub + time-scroll/pinch charts
  crashed on mount. The affected closures now capture only the hoisted
  `SharedValue`; behavior is unchanged. Latent (non-crashing) on worklets 0.9.x.

## [4.7.0] - 2026-07-01

### Added

- **`transitions.candleLerpSpeed`** (`number`, default `0.08`) on `LiveChart`.
  Controls the per-frame speed at which candle bodies resize when `candleWidth`
  changes (a timeframe / bucket switch). Same units as `smoothing` (`0`–`1`); set
  it to `1` to resize candles in a single frame instead of the default
  "fat → thin" slide. `transitions={false}` now also snaps the candle width
  (every transition instant). Replaces the previously hard-coded candle-width
  lerp speed, which nothing could tune or disable. Thanks
  [@dszym00](https://github.com/dszym00).
  ([#176](https://github.com/brandtnewlabs/react-native-livechart/issues/176))

### Changed

- **`static` charts are now scrubbable.** `scrub` and `scrubAction` stay live on a
  `static` `LiveChart` — they're on-demand touch gestures with no per-frame loop,
  so a still chart stays at zero idle cost yet reveals its crosshair / value
  read-out on touch. Previously `static` forced both off, so the only way to stop
  the render loop (e.g. for many sparklines in a list) also removed scrubbing. The
  continuous animations (`pulse`, `degen`, the entry reveal) remain disabled under
  `static`. Thanks [@dszym00](https://github.com/dszym00).
  ([#177](https://github.com/brandtnewlabs/react-native-livechart/issues/177))

## [4.6.0] - 2026-06-29

### Added

- **`snapKey`** (`string | number`) on `LiveChart` and `LiveChartSeries`. Snaps
  the framing — time window, Y-range, and value (per-series tips on
  `LiveChartSeries`) — to its target in a single frame whenever the key changes,
  then resumes normal `smoothing` for live ticks. Lets a timeframe switch (a
  `timeWindow` change) or a dataset swap settle instantly instead of sliding,
  without the all-or-nothing trade-offs of `smoothing={1}` (jumpy live ticks) or
  `static` (no live updates). Pass the current timeframe id, or a counter you bump
  when replacing the `data` / `candles` array. Geometry only and one frame only —
  the time-scroll position and the live loop are untouched. Thanks
  [@dszym00](https://github.com/dszym00).
  ([#173](https://github.com/brandtnewlabs/react-native-livechart/issues/173))

### Docs

- Clarified that `transitions.reveal` animates **opacity** only (the grow-in
  fade), not the time window / Y-range easing on a timeframe change — that easing
  is `smoothing`, and `snapKey` collapses it to one frame.

## [4.5.0] - 2026-06-26

### Added

- **`scrub.hideOverlaysOnScrub`** (`boolean`, default `false`) on `LiveChart` and
  `LiveChartSeries`. Fades the annotation overlays — buy/sell **markers** and
  **reference lines** (both the built-in Skia tags/lines and any custom
  `renderMarker` / `renderReferenceLine` RN views) — out while scrubbing so they
  don't clutter the crosshair read-out, easing back in on release. Driven by the
  scrub-active state (not the crosshair's edge-proximity fade, which would
  resurface the overlays near the live dot) and eased on the UI thread. Animates
  only a group opacity — the marker atlas and reference-line geometry are left
  intact (still one batched draw each), so there's no per-scrub data rebuild.
  Thanks [@dszym00](https://github.com/dszym00).
  ([#169](https://github.com/brandtnewlabs/react-native-livechart/pull/169))
- **`transitions` prop** (`boolean | TransitionConfig`) on `LiveChart` and
  `LiveChartSeries` to tune or disable the built-in transition animations.
  `false` makes them instant; an object sets per-transition durations in ms —
  `reveal` (the grow-in when data appears / on a timeframe change / when a line
  chart's data appears; default `600`) and `mode` (the candle↔line crossfade,
  single-series only; default `300`), with `0` snapping that transition.
  `reveal: 0` removes the grow-in on timeframe change and the line "animating in"
  when switching candle→line. Independent of `smoothing` (live value easing) and
  `static` (one-shot render). Exports the new `TransitionConfig` type.
  Thanks [@dszym00](https://github.com/dszym00).
  ([#171](https://github.com/brandtnewlabs/react-native-livechart/pull/171))
- **Configurable loading shell** — `loading` now accepts a `LoadingConfig` object
  (`boolean | LoadingConfig`) on `LiveChart` and `LiveChartSeries`, so the
  breathing-line placeholder can be restyled: `color` (squiggle + skeleton
  Y-axis placeholders; default theme `gridLine`), `strokeWidth` (default the
  chart line width), `amplitude` (base breathing-wave height, default `14`), and
  `speed` (wave cadence multiplier, default `1`; `0` freezes).
  `color` / `amplitude` / `speed` also flow into the reveal morph so the squiggle
  keeps its look as it melts into the line. `true` keeps the defaults, `false` /
  omitted is "not loading". Exports the new `LoadingConfig` type. (The
  loading→live reveal duration is tuned separately via the `transitions.reveal`
  prop above.) Thanks [@dszym00](https://github.com/dszym00).
  ([#170](https://github.com/brandtnewlabs/react-native-livechart/pull/170))

## [4.4.0] - 2026-06-26

### Added

- **Custom look for collapsed marker groups** — `MarkerClusterConfig.groupBadge`
  and `showGroupCount`. By default a collapsed cluster draws a round count badge;
  give it a custom Skia look two ways:
  - `groupBadge: "marker"` draws the **representative marker's own glyph** (its
    `image` / `icon` / `pill` / `kind`), so a run of buy pills collapses to a single
    buy pill rather than a generic count.
  - `groupBadge: { image }` (or `{ icon, pill, color }`, the new `MarkerGroupBadge`
    type) draws a **dedicated badge you supply**, independent of the member markers
    — for when the collapse should look different from the individual markers (e.g.
    tiny dots → a distinct "Buy 5" image).

  Add `showGroupCount` to stamp the member count in the glyph's top-right corner
  (the "Buy 5" look). Everything is batched in the same `drawAtlas` as every other
  marker (not a `renderMarker` RN overlay). Default behavior is unchanged
  (`groupBadge: "count"`). Exports the `MarkerGroupBadge` type.
  ([#165](https://github.com/brandtnewlabs/react-native-livechart/issues/165))

## [4.3.0] - 2026-06-25

### Added

- **Animated "return to live"** when `timeScroll` is switched off while scrolled
  back. Instead of snapping, the window now **eases onto the live edge** (a brief
  ~450 ms decelerate, all on the UI thread). It interpolates toward the *current*
  live edge each frame, so it lands exactly on live with no end-snap.
- **`returnToLive` prop** (`boolean | ReturnToLiveConfig`) on `LiveChart` and
  `LiveChartSeries` to control that glide: `true` (default) glides over `450` ms,
  `false` snaps instantly (the previous behavior), and `{ duration }` sets a custom
  length. It's a sibling of `timeScroll` (not nested in `TimeScrollConfig`) so it
  stays in effect through `timeScroll={false}` — the toggle that triggers it.
  Exports the new `ReturnToLiveConfig` type.
  ([#164](https://github.com/brandtnewlabs/react-native-livechart/issues/164))

### Fixed

- **Disabling `timeScroll` (or a mode switch that turns it off) no longer freezes
  the chart at the scrolled-back position.** Previously, panning back through
  history and then setting `timeScroll={false}` — or switching `mode` so the
  consumer stopped passing `timeScroll` — left the window frozen at the scrolled-to
  position with no way to return to live: the frozen edge survived because nothing
  reset it once the gesture was disabled. The chart now returns to the live edge
  (gliding by default — see Added), resets the internal scroll state so re-enabling
  `timeScroll` resumes from live rather than snapping back, and, as an added guard,
  follows live instead of stranding the window on an empty plot when a frozen edge
  falls before the active series' first data point (e.g. line and candle series
  with different history spans).
  ([#164](https://github.com/brandtnewlabs/react-native-livechart/issues/164))

## [4.2.1] - 2026-06-25

### Fixed

- **Draggable reference lines now win the gesture race against scrubbing.**
  Previously, grabbing a `draggable` reference line while `scrub` was enabled
  would drop a scrub crosshair instead of moving the line — the drag fell through
  to scrub the moment the touch drifted even slightly sideways (which a real
  finger drag almost always does at the start). A grabbed line now **owns** the
  touch: once you press within reach of the line, any drag past the activation
  threshold drags it, in any direction. Scrubbing still works everywhere outside
  a draggable line's grab band, so the two features can finally be used together.
  ([#163](https://github.com/brandtnewlabs/react-native-livechart/issues/163))

## [4.2.0] - 2026-06-23

### Added

- **Vertical marker stacking** — `MarkerClusterConfig.direction`. The
  `markerCluster` object form gains `direction?: "horizontal" | "vertical"`.
  `"horizontal"` (default, unchanged) fans co-located markers into an overlapping
  row; `"vertical"` piles them into a **column** that grows away from the line in
  each glyph's `side` direction (`"above"` climbs up, `"below"` descends,
  `"center"` climbs up from the line) — the transactions-stacked-on-the-candle
  look. Collapse-to-count, grouping, and hit-testing all carry over; raise
  `maxBeforeGroup` for taller columns before they collapse to a count badge.

## [4.1.0] - 2026-06-23

### Added

- **Fixed Y-axis price count** (`yAxis={{ count }}`). Render an exact number of
  evenly-spaced price labels instead of the dynamic nice-interval grid — top label
  = current high, bottom = current low — so the count stays constant as data
  streams in while the values track the live range each frame (not rounded to nice
  numbers). `minGap` still acts as a floor (the count drops to what fits on a short
  plot) and is clamped to `15`. Works on both `LiveChart` and `LiveChartSeries`.
  Thanks [@Cancuuu](https://github.com/Cancuuu).
  ([#160](https://github.com/brandtnewlabs/react-native-livechart/issues/160))
- **`dismissOnAction`** on `ScrubActionConfig` (`LiveChart`). When the locked
  scrub reticle's action badge is pressed (firing `onScrubAction`), dismiss the
  reticle so no crosshair lingers after the action — e.g. clear the order reticle
  once the order is placed. Default `false` (the reticle stays until tapped away).
  See the new `app/showcase/fomo-perps.tsx` example.
  ([#161](https://github.com/brandtnewlabs/react-native-livechart/issues/161))

## [4.0.0] - 2026-06-19

A large feature release — two-finger pinch-to-zoom, one-finger time-scroll, a price↔pixel
overlay bridge, draggable/groupable reference lines, marker stacking & grouping,
volume bars, and badge styling — plus one breaking rename. See **Breaking** for
the one-line migration.

### Breaking

- **`onMarkerHover` → `onMarkerPress`** (event type **`MarkerHoverEvent` →
  `MarkerPressEvent`**). The marker tap callback and its event type were renamed
  to match what they always were — a tap, not a hover (there is no hover on
  touch). Rename the prop and the type at your call sites; the payload is
  otherwise unchanged, and now *also* carries `index`, `isGrouped`, and the tapped
  cluster's `members`.
  ([#155](https://github.com/brandtnewlabs/react-native-livechart/issues/155))

### Added

- **Time-scroll (`timeScroll`)** on `LiveChart`. A new `timeScroll` prop
  (`boolean | TimeScrollConfig`) enables a **one-finger** horizontal pan (with
  fling/decay inertia) to scroll back through retained history; the chart stops
  auto-following while panned and snaps back to live at the right edge. Two
  activation modes via `gesture`: `"holdToScrub"` (default — a quick drag
  scrolls, so scrub moves to a press-and-hold) and `"axisDrag"` (only a drag
  starting on the bottom x-axis strip scrolls, leaving the plot free to scrub).
  Works in both line and candle mode. **@experimental.**
- **`renderOverlay` price↔pixel bridge** (`LiveChart`). `renderOverlay(ctx)`
  mounts a `box-none` RN sibling of the canvas and hands you a
  `ChartOverlayContext`: a per-frame `scale` SharedValue plus pure
  `priceToY` / `yToPrice` / `timeToX` / `xToTime` worklets, so you can float your
  own views (order tickets, price tags) glued to the rescaling axis. Two new hooks
  `usePriceY` / `useTimeX` return a `SharedValue<number>` that tracks a given
  price/time — the library owns the scale subscription so reactivity can't be
  forgotten. Exports `ChartOverlayContext`, `ChartScale`, `ChartPlotRect`,
  `usePriceY`, `useTimeX`.
- **Full-width reference lines** — `ReferenceLine.fullWidth?: boolean` (default
  off) runs a Form-A line or value band edge-to-edge **through the Y-axis
  gutter**, connecting it visually to its value on the axis. Labels and badges
  stay anchored inside the plot.
- **Marker stacking, grouping & side anchoring** (`LiveChart`). A new
  `markerCluster?: "anchored" | "stacked" | MarkerClusterConfig` prop handles
  collisions: `"anchored"` (default) is the unchanged, zero-per-frame-cost
  behavior; `"stacked"` fans co-located markers horizontally and collapses a dense
  run into a single count badge once it exceeds `maxBeforeGroup` (default 5),
  recomputed per frame so a cluster fans back out as you zoom in. A per-marker
  `side?: "above" | "below" | "center"` lifts the glyph off the line (e.g. buys
  below, sells above), and `renderMarker(marker, ctx)` now receives
  `{ index, isGrouped, groupCount, side }`. Exports `MarkerClusterConfig`,
  `MarkerSide`, `MarkerRenderContext`.
- **Badge style & shape config** (`LiveChart`). `BadgeConfig` gains Skia-native
  style knobs that cost nothing extra per frame: `radius` (corner radius; `0` =
  sharp), `borderColor` / `borderWidth`, `textColor`, `fontSize` / `fontFamily` /
  `fontWeight` (per-badge font), and `offsetX` / `offsetY`. Exports the shared
  `BadgeStyleConfig`.
  ([#139](https://github.com/brandtnewlabs/react-native-livechart/issues/139))
- **Volume bars (`volume`)** on `LiveChart` candle mode. An opt-in
  `volume?: boolean | VolumeConfig` (`{ upColor, downColor, maxHeight, radius,
  opacity }`) renders volume bars in a reserved band below the candles; the price
  plot shrinks so candles are never clipped and the x-axis stays pinned to the
  bottom. `CandlePoint` gains an optional `volume`. Exports `VolumeConfig`.
- **Candle styling** — `metrics.candle.bodyRadius` rounds candle-body corners
  (clamped so thin candles and dojis stay clean; `0` = sharp, the default) and
  `metrics.candle.wickWidth` sets the high–low wick stroke width (default `1`).
  When time-scrolled, candle bodies poking past the plot edge now slide **behind**
  the Y-axis labels instead of drawing over them.
- **Scrub "point" tooltip placement** — `scrub.tooltipPlacement` accepts a fourth
  value `"point"`, deriving the tooltip's Y from the scrub dot so the pill floats
  just above the dot (flipping below when there's no room and clamping into the
  plot) instead of pinning to a plot edge. Single-series line mode.
- **Interactive reference lines** (`LiveChart`). Form-A `ReferenceLine`s gain a full
  interaction model for working orders, alerts, and targets:
  - **Draggable** — `draggable` lets you grab a line and drag it along the Y-axis,
    with `snap` (round to a tick), `bounds` (hard clamp), and per-line callbacks
    `onChange` (during), `onCommit` (on release), and `onDragIn` / `onDragOut`
    (value crossing the visible range or a bound, from a drag or the axis
    rescaling). Uncontrolled by default; pair `onCommit` with `value` for a
    controlled line. Dragging a line toward the edge expands the Y-axis so it
    follows the finger in one motion (no release-and-re-grab).
  - **Custom tags** — `renderReferenceLine` floats any React Native view at a line's
    value (the `renderMarker` / `renderTooltip` model), tracking the axis and any
    drag on the UI thread via the `ReferenceLineRenderProps` SharedValues. Replaces
    the built-in pill / gutter label (return `null` to keep the built-in; works with
    `badge: false`).
  - **Center badge** — `ReferenceLineBadgeConfig.position` accepts `"center"`,
    floating the pill at the value with no connector.
  - **Grouping** — `referenceLineGrouping` collapses lines whose handles sit near
    the same value into a single count handle. Custom-rendered lines are excluded
    (the count reflects only collapsed built-in tags).
- **Badge style/shape parity** for reference-line and group badges. Both
  `ReferenceLineBadgeConfig` and the grouping count pill
  (`ReferenceLineGroupingConfig.badge`) now take the same style/shape config as the
  value `badge` (added in #152): `borderWidth`, `textColor`, `fontSize` /
  `fontFamily` / `fontWeight`, and `offsetX` / `offsetY` (on top of the existing
  `position` / `background` / `borderColor` / `radius`). The grouping config also
  gains a `format` fn for the count label (e.g. `n => \`×${n}\``).
- **Pinch-to-zoom (`zoom`)** on `LiveChart` and `LiveChartSeries`. A new `zoom`
  prop (`boolean | ZoomConfig`) enables two-finger pinch-to-zoom of the visible
  time window, anchored at the focal point between your fingers (the time under
  your fingers stays put). It composes with `timeScroll` — zoom level and scroll
  position are independent — and is two-finger, so it never competes with the
  one-finger pan/scrub. `ZoomConfig` tunes `minTimeWindow` (max zoom-in, default
  `timeWindow / 8`) and `maxTimeWindow` (max zoom-out, default the full data
  span). The Y-range auto-fits the visible window and candle bars re-flow as you
  zoom. **@experimental.**
- **`timeScroll` + `zoom` on `LiveChartSeries`.** Pan-back-through-history and
  pinch-zoom now work in multi-series too (previously single-series only). While
  scrolled back, each series' dot and value label track its value at the visible
  window's right edge — the dot rides the end of each line instead of the live
  price.
- **Paging callbacks** `onVisibleRangeChange` and `onReachStart` (both charts).
  `onVisibleRangeChange(range)` reports the visible window (`{ startSec, endSec,
  following }`, throttled to ~1 Hz); `onReachStart()` fires once when the left
  edge nears the earliest retained data — the cue to lazily page in older
  history. `VisibleRange` is exported. **@experimental.**

### Fixed

- **Marker / reference-line taps on iOS.** `onMarkerPress` and
  `onReferenceLinePress` never fired in the plain-scrub path on iOS — the
  `minDistance(0)` scrub pan won the gesture race and cancelled the tap. The root
  gesture is now always `Gesture.Simultaneous`, and scrub defers to a marker or
  badge sitting under the finger.
  ([#155](https://github.com/brandtnewlabs/react-native-livechart/issues/155))
- **Y-axis grid guard.** The Y-axis grid loop is guarded against a non-terminating
  step, so a zero or non-finite tick step can no longer hang the grid build.
  ([#151](https://github.com/brandtnewlabs/react-native-livechart/issues/151))

## [3.12.0] - 2026-06-17

### Added

- **`curve` for multi-series lines** (`LiveChartSeries`). `SeriesConfig` gains
  `curve?: "monotone" | "linear"` (per series, default `"monotone"`), mirroring
  `LineConfig.curve` on the single-series `LiveChart` — set `"linear"` to draw a
  series as straight segments between samples instead of the monotone cubic. Each
  series chooses independently.
  ([#141](https://github.com/brandtnewlabs/react-native-livechart/issues/141))

### Fixed

- **Markers anchored to a `"linear"` line now sit on the line.** A value-less
  marker (single-series, pinned to the line by `time`) or a `seriesId`-anchored
  marker was always projected onto the monotone spline, so in `curve: "linear"`
  mode the glyph floated off the straight segment — most visibly on sparse ranges
  (e.g. 1Y). Such markers now follow the rendered interpolation: the straight
  chord when the line/series is `"linear"`, the spline otherwise.
  ([#141](https://github.com/brandtnewlabs/react-native-livechart/issues/141))

## [3.11.0] - 2026-06-16

### Added

- **`areaDots` — dot-lattice area fill** (`LiveChart`). A new `areaDots` prop
  (`boolean | AreaDotsConfig`) fills the area **beneath the line** with a
  screen-fixed dot lattice clipped to the under-line region (the line scrolls
  over the dots; nothing is drawn above it). It composes with `gradient` or
  replaces it (`gradient={false}`), and `AreaDotsConfig` tunes `spacing`, `size`,
  `color` (defaults to a faint tint of the line color), and `opacity`. Inert in
  candle mode, like the gradient fill. See the new `app/showcase/kraken.tsx`
  example.

## [3.10.0] - 2026-06-16

### Added

- **`topLabel` / `bottomLabel` can mark the extrema points** (`LiveChart` and
  `LiveChartSeries`). Pass `position: "extrema"` to float the high / low readout
  at the actual data point where it occurs — a dot + value tracked on the UI
  thread as the chart scrolls and the Y-axis rescales — instead of pinning it to
  a fixed edge. Works in line and candle mode (extrema track the highest high /
  lowest low); a custom `render` is centered over the point. The label hides when
  the window holds no data or the extremum scrolls off-plot. `"left"` / `"right"`
  remain the default edge behavior, so existing labels are unchanged.
  `position: "extrema-edge"` is a variant that keeps the value on the top / bottom
  rail (x-aligned with the extremum) and joins it to a dot on the point with a
  configurable `connector` line (a `LineStyleConfig`, dashed by default). The
  built-in label is styleable without dropping to `render`: `AxisLabelConfig`
  gains `fontSize` / `fontWeight` / `fontFamily` (edge + extrema text),
  `dotColor` / `dotSize` / `dot` (the extrema marker), and `connector`.
  ([#131](https://github.com/brandtnewlabs/react-native-livechart/issues/131))
- **Custom `renderTooltip` now works in candlestick mode** (`LiveChart`). The
  custom tooltip replaces the built-in OHLC stack, and `TooltipRenderProps` gains
  a `candle: SharedValue<CandlePoint | null>` with the scrubbed bucket so you can
  render your own OHLC readout (or a minimal pill when the active candle is shown
  elsewhere in your UI). `value` / `valueStr` resolve to the candle's close and
  `time` / `timeStr` to the bucket time, so a close-only tooltip needs no
  candle-specific code. See the new **Candle scrub** demo
  (`app/demo/candle-scrub.tsx`) for a brokerage-style composition — OHLC in a
  header above the chart, the time pinned to the top edge.
  ([#132](https://github.com/brandtnewlabs/react-native-livechart/issues/132))

### Changed

- **Top/bottom-placed custom tooltips now pin to the canvas edge.** A custom
  `renderTooltip` with `scrub.tooltipPlacement: "top"` now sits at the **canvas
  top edge** (previously `insets.top + margin`) and the crosshair line **stops at
  the label** instead of running up through it; `"top"` / `"bottom"` tooltips also
  clamp to the canvas edges (so they can extend into the axis gutters) rather than
  the inner plot bounds. This affects **existing line-mode** top-pinned tooltips,
  not just candle mode — reserve `insets.top` for the label band so the data
  clears it (mirrors the extrema-label treatment). The default (`"side"`)
  placement is unchanged.
  ([#132](https://github.com/brandtnewlabs/react-native-livechart/issues/132))

## [3.9.0] - 2026-06-15

### Added

- **`scrub.crosshairDash` dashes the vertical scrub crosshair line** (`LiveChart`
  and `LiveChartSeries`). `true` applies a default `[4, 4]` dash; an array sets
  explicit Skia dash intervals `[on, off, …]` in px. Omit (or `false`) keeps the
  solid line, so existing charts are unchanged.

## [3.8.2] - 2026-06-15

### Fixed

- **An explicit `insets` value now overrides the live-dot pulse padding floor**
  (`LiveChart` / `LiveChartSeries`). The pulse ring reserves top/right/bottom
  room so it isn't clipped at the canvas edge, but that floor was applied with a
  `Math.max` that silently ignored an explicit inset — so e.g. `insets={{ bottom: 0 }}`
  (with `xAxis={false}`) still left a gap. Explicit insets now win per side, giving
  full control of the chart padding; the caller accepts that the pulse ring may
  clip at that edge. Sides you don't set still get the pulse floor as before.
  ([#128](https://github.com/brandtnewlabs/react-native-livechart/issues/128))

## [3.8.1] - 2026-06-15

### Fixed

- **X-axis tick cadence no longer depends on the time window you came from**
  (`LiveChart` and `LiveChartSeries`). Changing `timeWindow` between values —
  e.g. `24h` → `1h` — could settle the axis on a coarser tick interval (one fewer
  tick) than selecting that window directly, and switching from a much larger
  window down to a small one could leave only a single tick. Tick selection read
  the *animating* window, which eases asymptotically toward the target and settles
  just above or below it, landing in the neighbouring interval bucket depending on
  the direction of approach. Tick selection now reads the target `timeWindow`, so
  the cadence is stable and independent of the prior window; labels still animate
  smoothly via the easing window.
  ([#126](https://github.com/brandtnewlabs/react-native-livechart/issues/126))

## [3.8.0] - 2026-06-15

### Added

- **Line shape controls** (single-series `LiveChart`) — new `LineConfig` fields for
  angular, hard-edged lines:
  - `curve?: "monotone" | "linear"` — `"monotone"` (default) keeps the smooth
    cubic; `"linear"` draws straight segments between points. Applies to the area
    fill too, so the gradient follows the same straight path.
  - `join?: "round" | "miter" | "bevel"` — corner join between segments.
    `"round"` (default) softens peaks; `"miter"` gives sharp, angular peaks;
    `"bevel"` flattens them.
  - `cap?: "round" | "butt" | "square"` — stroke cap at the line's start/end.
  - Pair `curve: "linear"` + `join: "miter"` + `cap: "butt"` for a fully
    hard-edged line (see the new `app/showcase/robinhood.tsx` tokenized-stock
    showcase).

## [3.7.0] - 2026-06-14

### Added

- **Customizable scrub tooltips** (single-series `LiveChart`) — two complementary
  ways to reshape the tooltip pill, both UI-thread smooth.
  ([#119](https://github.com/brandtnewlabs/react-native-livechart/issues/119))
  - Adjustable `ScrubConfig` props: `tooltipPlacement` (`"side"` | `"top"` |
    `"bottom"` — top/bottom center the pill over the scrub line), `tooltipMargin`
    (gap to the pinned plot edge, default `8`), `tooltipShowValue` /
    `tooltipShowTime` (drop a row — e.g. a date-only tooltip), and
    `tooltipBorderRadius` (default `5`).
  - `renderTooltip?: (ctx: TooltipRenderProps) => ReactElement | null` — render a
    fully custom **React Native** tooltip, the same idea as `renderMarker`. The
    chart floats it over the canvas and positions it on the UI thread (honoring
    `tooltipPlacement` / `tooltipMargin`). It receives the live scrub state as
    `SharedValue`s (`TooltipRenderProps`), so the value/date can be bound to
    animated text and update on the UI thread — no JS-thread `onScrub` lag. Line
    mode only (candle keeps its OHLC stack). `TooltipRenderProps` is exported.

## [3.6.0] - 2026-06-14

### Added

- **Custom marker rendering** — `renderMarker?: (marker: Marker) => ReactElement | null`
  on `LiveChart` and `LiveChartSeries`. Return a **React Native** element to float
  your own view at a marker's live `(time, value)` position (auto-centered, tracked
  on the UI thread); return `null`/`undefined` to keep the built-in Skia glyph.
  This lets you use non-Skia elements the canvas can't draw — e.g. an `expo-blur`
  `BlurView` glass badge — rendered crisp at native resolution. Custom-rendered
  markers skip the marker atlas (no glyph drawn behind them) and taps still fire
  `onMarkerHover`. Use sparingly: each is its own animated view, whereas built-in
  glyphs batch into one draw call. ([#118](https://github.com/brandtnewlabs/react-native-livechart/issues/118))

## [3.5.1] - 2026-06-14

### Fixed

- **Sharp markers on retina screens** — marker glyphs (trade/winner/boost
  shapes, icon/pill badges, and image stamps) are pre-rasterized into a Skia
  atlas; that texture was built at logical-pixel resolution and then upscaled
  ~3× when blitted onto a retina canvas, so markers looked blurry while text and
  lines stayed crisp. The atlas is now rasterized at the device-pixel ratio and
  scaled back down per frame, so markers render at full resolution. No API
  changes. ([#118](https://github.com/brandtnewlabs/react-native-livechart/issues/118))

## [3.5.0] - 2026-06-12

### Added

- **Threshold split** — `threshold?: ThresholdConfig` on `LiveChart` colors the
  line **above vs. below a live value** (green above, red below by default). The
  `value` is always a `SharedValue`, so the split tracks a moving benchmark on the
  UI thread without re-rendering — break-even / average cost, VWAP, the previous
  close, or a stablecoin peg. New exported types: `ThresholdConfig`,
  `ThresholdLineConfig`. Single-series, line mode only.
  - `aboveColor` / `belowColor` — stroke colors for the two halves (default the
    palette's semantic up-green / down-red). The split is a vertical hard-stop
    gradient on the line stroke; while set it supersedes `line.color` /
    `line.colors` and segment recoloring for the main stroke.
  - `fill` — tints the profit/loss band _between the line and the threshold_
    toward the above/below colors. Independent of the baseline `gradient` fill, so
    `gradient={false}` shows the band alone.
  - `line` — a dashed marker line at the threshold. `true` draws the line only
    (no text); a `ThresholdLineConfig` adds an opaque label **badge**, anchored
    flush to the plot's left edge by default (`labelPosition`, or the right
    gutter) and drawn on top of the line, with optional `showValue`.

### Changed

- The **left-edge fade** now softens only the background fills (grid, area
  gradient, threshold band); the chart line and its overlays render above the fade
  and stay crisp at the left edge instead of washing out.

## [3.4.0] - 2026-06-12

### Added

- **Order ticket (`scrubAction`)** — `scrubAction?: boolean | ScrubActionConfig`
  on `LiveChart`, paired with `onScrubAction?: (point: ScrubActionPoint) => void`,
  turns a scrub into a price-entry interaction: tap the plot to drop a persistent
  price reticle (a horizontal level line + right-gutter price badge), drag to
  fine-tune, then press the badge's `+` to fire `onScrubAction` with the chosen
  level. The `ScrubActionPoint` carries `price` (optionally `snap`-rounded),
  `time`, the reticle's canvas `x`/`y`, and — in candle mode — the `candle` OHLC
  under the reticle. It coexists with `scrub`: a press-hold drag still scrubs
  (crosshair + readout); a tap drops the reticle. New exported types:
  `ScrubActionConfig`, `ScrubActionPoint`.
  - `snap` — round the reported price to an increment (e.g. `0.01`, `0.5`).
  - `icon` (default `"+"`), `background`, `iconColor`, `lineColor` — badge/line styling.
  - `text` (default `true`) — set `false` for an icon-only badge.
  - `timeBadge` (default `false`) — also show a time pill where the reticle meets
    the x-axis, formatted by the chart's `formatTime`.
  - `dismissOnTapOutside` (default `false`) — a tap on empty plot clears the lock
    instead of re-placing it.
- **`onReferenceLinePress`** — `onReferenceLinePress?: (line: ReferenceLine, index:
  number) => void` on `LiveChart` makes reference-line badges tappable. `index`
  maps back to the `referenceLines` entry, so a working-order line can be managed
  (e.g. tapped to cancel) straight from its badge.
- **Reference-line badge config** — a reference line's `badge` is now the
  documented, exported `ReferenceLineBadgeConfig`: `icon` (leading glyph,
  font-rendered), `position` (`"left"` / `"right"` gutter), `text` (set `false`
  for an icon-only pill), `background`, `borderColor`, and `radius`.

### Fixed

- Reference lines that share the same `value` no longer collapse into one — lines
  and their badges are keyed by index, so duplicate-value entries each render.

## [3.3.0] - 2026-06-09

### Added

- **Segments** — `segments?: ChartSegment[]` on `LiveChart` labels time ranges
  (pre-market / regular / after-hours sessions, overnight windows) using a
  Robinhood-style **scrub-focus** interaction. At rest the line is one uniform
  color; while scrubbing — or when a segment is `active` — the focused segment
  (under the scrub line, or the `active` one) keeps the base color and every other
  segment is de-emphasized by recoloring the **line stroke itself** (an
  alpha-reduced color fades the line; no overlay panel). New exported type:
  `ChartSegment`. Single-series only.
  - `mutedColor` / `mutedColors` — the de-emphasis color (solid, or a ≥2-stop
    gradient) used when a segment is not the focused one.
  - `active` — force-focus a segment without scrubbing.
  - `recolorLine` (default `true`) — set `false` to opt a segment out of the
    dimming entirely (it still draws its divider/label).
  - `divider` + `label` (with `labelPosition` / `dividerColor`) — a dashed edge
    marker and caption; the label shows only with the divider.
  - All colors default to the chart palette, so a bare `{ from, to }` segment
    works without setting any color.

## [3.2.0] - 2026-06-09

### Added

- **Gradient line strokes** — `LineConfig.colors?: string[]` applies two or more
  CSS colors as a horizontal gradient along the chart line stroke (left → right),
  e.g. `line={{ colors: ["#ff0000", "#0000ff"] }}`. The existing `color?: string`
  is unchanged and still sets a solid stroke; `colors` takes precedence when both
  are set. Single-series only. The fill-gradient analogue is `GradientConfig.colors`
  (added in 3.0.0).

## [3.1.0] - 2026-06-09

### Added

- **Scrub gesture callbacks** — `onGestureStart` / `onGestureEnd` on both
  `LiveChart` and `LiveChartSeries`, fired when a scrub interaction begins and
  ends (e.g. pause a parent carousel or disable list scrolling while scrubbing).
- **`selectionDot`** on both charts — customize the dot drawn at the scrub
  position: `boolean | SelectionDotConfig` with `size`, `color`, `ring`
  (`boolean | SelectionDotRingConfig`), or a fully custom `component`
  (`ComponentType<SelectionDotProps>`). New exported types: `SelectionDotConfig`,
  `SelectionDotRingConfig`, `SelectionDotProps`.
- **Multi-color area-fill gradients** — `GradientConfig.colors?: string[]` (with
  optional `positions?: number[]`) renders a custom multi-stop fill, mirroring
  react-native-graph's `gradientFillColors`. Omit for the existing two-stop
  top/bottom fallback. Single-series only.
- **Axis labels** — `topLabel` / `bottomLabel` (`boolean | AxisLabelConfig`) on
  both charts draw labels at the high/low of the visible range (Robinhood-style),
  with `format`, `color`, `position`, or a custom `render` render-prop. New type:
  `AxisLabelConfig`.
- **`static` mode** — `static={true}` on `LiveChart` renders a non-animated,
  gesture-free sparkline, cheap enough for long lists.

### Performance

- The degen particle burst now renders through a single `drawAtlas` call instead
  of a per-particle `<Circle>` fan-out (one shared pre-rasterized sprite plus
  per-instance transforms/colors), cutting per-frame CPU on dense bursts.

## [3.0.0] - 2026-06-07

### Changed

- **BREAKING:** `@shopify/react-native-skia` **`>=2.6.0`** is now required (the
  peer dependency range moves up from `>=2.0.0`). Path construction now uses the
  `Skia.PathBuilder` API (`PathBuilder.detach()`), which Skia introduced in
  **2.6.0** — on older Skia the chart throws at runtime (`Skia.PathBuilder` is
  `undefined`). Upgrade Skia to `2.6.0`+ before upgrading this package. No
  public API of this library changed.
- All per-frame path building — line, fill, candles, badge, Y/X axes & grid,
  value lines, reference lines/bands, markers, and the loading squiggle —
  migrated from the pooled mutable-`SkPath` + ping-pong pattern to a reused
  `Skia.PathBuilder` finalized with `detach()`. This drops the two-buffer
  ping-pong and is forward-compatible with Skia's move to an immutable `SkPath`.

### Performance

- The PathBuilder migration is performance-neutral: on-device profiling
  (iPhone 17 Pro / iOS 26.4, 3-series scene) measured equivalent frame rate
  (60fps), CPU, and flat memory versus the previous pooled-path approach.

## [2.0.1] - 2026-06-07

### Documentation

- README and docs now point to the hosted docs MCP server
  (`react-native-livechart.brandtnewlabs.com/mcp`), so an AI assistant can be
  connected directly to the library's documentation. No code changes.

## [2.0.0] - 2026-06-07

### Added

- **`metrics` prop** on both `LiveChart` and `LiveChartSeries` — sizing & motion
  tokens, the geometry/feel analogue of `palette`. Namespaced (`badge`, `candle`,
  `grid`, `motion`, `emptyState`) with per-key shallow-merge overrides. Exposes
  previously-hardcoded constants: badge pill geometry, candle body bounds,
  grid/axis fade speeds, badge color + adaptive catch-up lerp speeds, and
  empty-state layout. New types: `LiveChartMetrics`, `LiveChartMetricsOverride`,
  `BadgeMetrics`, `CandleMetrics`, `GridMetrics`, `MotionMetrics`,
  `EmptyStateMetrics`.
- `dot` now accepts a boolean on both charts — `dot={false}` hides the live dot,
  `dot` / `dot={true}` uses shown defaults. Brings `dot` in line with the uniform
  `boolean | Config` feature-flag convention shared by every other overlay.

### Changed

- **BREAKING:** `LiveChartSeries` enables crosshair scrubbing by default (`scrub`
  previously defaulted to `false`, now `true`, matching `LiveChart`). Legend chips
  sit outside the scrub gesture, so taps are unaffected. Pass `scrub={false}` to
  restore the previous behavior.
- Feature-flag resolution is unified behind a single `resolveToggle` helper, so
  every overlay toggle follows the identical `boolean | Config` shape.

### Deprecated

- **BREAKING (soft):** `DotConfig.show` is deprecated in favor of `dot={false}`.
  `dot={{ show: false }}` still works and is equivalent.

### Fixed

- Crosshair overlays no longer emit React's "the final argument passed to
  useMemo/useEffect changed size between renders" error while scrubbing. With
  React Compiler enabled, Reanimated's auto-detected worklet dependencies could
  change array size when the live-dot extent changed; the affected
  `useDerivedValue`s now use explicit dependency arrays.

### Performance

- The line is now decimated to ~2 points per horizontal pixel (min/max per pixel
  column, preserving the envelope and volatility spikes). Previously every visible
  sample was rebuilt and stroked each frame, so a dense or wide time window that
  saturated over time made the per-frame cost scale with sample count rather than
  canvas width — dropping frames, most visibly while scrubbing. Sparse windows are
  unchanged. Bounds the per-frame line cost to the canvas width regardless of data
  density.

## [1.1.0] - 2026-06-05

### Added

- `LiveChart` `dot` prop — style the single-series live dot: `radius`, `ring`
  (the haloed outer ring), `show`, and `color`.
- `LiveChartSeries` `dot` gains `ring`, `show`, and `color`.
- Shared `DotConfig` type for both charts (`MultiSeriesDotConfig` extends it),
  plus `DotRingConfig`.
- `scrub.panGestureDelay` — a press-and-hold delay (ms) before scrubbing
  activates, so a quick horizontal swipe falls through to a parent gesture
  (e.g. a navigator's swipe-back-to-previous-route). Defaults to `0` (immediate).

### Changed

- Multi-series dots now render a contrasting outer ring (halo) by default,
  matching the single-series live dot. Pass `dot={{ ring: false }}` for flat
  circles.
- The single-series live dot's default outer radius is now 6.0px (was 6.5px),
  from the shared 2.5px ring width. Pass `dot={{ ring: { width: 3 } }}` to
  restore the previous size.

### Fixed

- The scrub dim now fully covers the live dot and its pulse ring while
  scrubbing (previously only the left half was dimmed), on both charts. The
  live-price badge and per-series value labels are drawn above the dim so they
  are no longer clipped, and the dim stops short of the Y-axis labels.

### Performance

- The scrub tooltip no longer calls Skia `measureText` on every frame; it sizes
  the monospace text by character count instead. Fixes a UI-thread frame-rate
  drop while scrubbing.

## [1.0.0] - 2026-06-04

Initial public release.

### Added

- `LiveChart` — single-series line/candlestick chart with scrubbing, badges, trade
  markers, momentum detection, and degen effects.
- `LiveChartSeries` — multi-series line chart with a toggleable legend, per-series live
  dots, value lines, and a crosshair.
- `LiveChartTransition` — helper for animating between chart states.
- Hooks: `useDegen`, `useTradeStream`.
- Utilities: `formatTime`, `formatValue`, `MONO_FONT_FAMILY`.
- Light/dark theming with accent-driven palettes; loading (breathing-line) and paused
  states.

### Packaging

- The package ships **TypeScript source** (`src/`); your app's Metro + Babel pipeline
  compiles it with your own Reanimated/Worklets version. `dist/` contains only `.d.ts`
  declarations — there is no precompiled runtime `dist/*.js`.

[3.10.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.10.0
[3.9.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.9.0
[3.8.2]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.8.2
[3.8.1]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.8.1
[3.8.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.8.0
[3.7.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.7.0
[3.6.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.6.0
[3.5.1]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.5.1
[3.5.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.5.0
[3.4.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.4.0
[3.3.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.3.0
[3.2.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.2.0
[3.1.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.1.0
[3.0.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.0.0
[2.0.1]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v2.0.1
[2.0.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v2.0.0
[1.1.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v1.1.0
[1.0.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v1.0.0
