# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A high-performance live charting library for React Native, built on `@shopify/react-native-skia`, `react-native-reanimated`, and `react-native-gesture-handler`. All data and live values flow through Reanimated `SharedValue`s so animations run on the UI thread without JS bridge traffic.

This is a **monorepo** with npm workspaces:
- `packages/react-native-livechart/` — the publishable library
- Root — an Expo example app that demos the library via `app/demo/` screens

## Commands

```bash
npm test                # run all tests (Jest + jest-expo)
npm run test:lib        # library tests only
npx jest path/to/file   # single test file
npm run typecheck       # tsc --noEmit
npm run lint            # eslint (expo flat config)
npm run verify          # typecheck + lint + test (all three)
npm run build:lib       # emit .d.ts only into packages/.../dist/
npm start               # expo start (dev server for the example app)
npm run ios             # expo run:ios
```

The **pre-commit hook** (husky) runs `npm test` — all tests must pass before committing.

## Architecture

### Engine (UI-thread tick loop)

The chart's core is a **frame-callback engine** that runs on the UI thread via `useFrameCallback`. Each frame, a pure tick function updates mutable state (display min/max, time window, smoothed value) and writes results to SharedValues.

- `src/core/liveChartEngineTick.ts` — pure tick function for single-series (`tickLiveChartEngineFrame`)
- `src/core/liveChartSeriesEngineTick.ts` — pure tick function for multi-series (`tickMultiSeriesFrame`)
- `src/core/useLiveChartEngine.ts` — React hook wrapping the single-series frame callback
- `src/core/useLiveChartSeriesEngine.ts` — React hook wrapping the multi-series frame callback

The tick functions are **pure** (no hooks, no SharedValues) — they take mutable state + input and return void after mutating. This makes them unit-testable without Reanimated.

### Two chart components

- `LiveChart` — single-series line/candle chart with scrubbing, badges, trade markers, degen effects
- `LiveChartSeries` — multi-series line chart with toggleable series, per-series dots, and crosshair

Both compose from a shared set of overlay components and hooks in `src/components/` and `src/hooks/`.

### Drawing layer

`src/draw/` contains Skia path-building functions (`line.ts`, `candle.ts`, `grid.ts`, `trade.ts`) that construct `SkPath` objects from data arrays. These run inside `useDerivedValue` on the UI thread.

### Math utilities

`src/math/` has pure functions for interpolation, splines, color blending, momentum detection, and candle aggregation. All are worklet-safe (no closures over JS-thread state).

### Config resolution

`src/core/resolveConfig.ts` normalizes user-facing props (booleans, partial objects) into fully resolved config objects with defaults. The `resolve*` functions are called once at render time, not per frame.

## Key patterns

- **SharedValue-driven**: Data enters as `SharedValue<LiveChartPoint[]>`. The engine, path builders, and overlays all read SharedValues — React re-renders are minimal.
- **Worklets**: Functions tagged `"worklet"` or used inside `useDerivedValue`/`useFrameCallback` run on the UI thread. Keep them free of JS-thread closures and non-worklet imports.
- **SkPath reuse**: Drawing functions accept and `.rewind()` existing SkPath instances rather than allocating new ones each frame (iOS memory optimization).
- **Library ships TypeScript source**: The package's `main`/`exports` point at `src/index.ts`. The consumer's Metro + Babel compiles it. `dist/` only contains `.d.ts` files.

## Testing

Tests use `jest-expo` with a Skia mock and a Reanimated/Worklets stub (see `jest-setup.js`). SharedValues in tests are plain `{ value }` objects — full UI-thread round-trips don't work under Jest.

Coverage thresholds: branches 90%, functions 95%, lines 95%, statements 95%.

The `sim/` directory contains simulation hooks (`useSimulatedChartData`) used by the demo app, with their own tests.

## Babel configuration

`react-native-worklets/plugin` must be **last** in the Babel plugins array. Reordering breaks worklet compilation at build or runtime.
