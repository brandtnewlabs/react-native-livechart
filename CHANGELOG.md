# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/brandtnewlabs/react-native-livechart/releases/tag/v1.0.0
