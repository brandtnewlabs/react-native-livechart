# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[3.2.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.2.0
[3.1.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v3.1.0
[2.0.1]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v2.0.1
[2.0.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v2.0.0
[1.0.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v1.0.0
