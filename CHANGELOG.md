# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-03

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
