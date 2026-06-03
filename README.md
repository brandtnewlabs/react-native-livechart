# react-native-livechart

[![npm version](https://img.shields.io/npm/v/react-native-livechart.svg)](https://www.npmjs.com/package/react-native-livechart)
[![CI](https://github.com/brandtnewlabs/react-native-livechart/actions/workflows/test.yml/badge.svg)](https://github.com/brandtnewlabs/react-native-livechart/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/npm/l/react-native-livechart.svg)](LICENSE)

High-performance **live** line and candlestick charts for React Native, built on **[@shopify/react-native-skia](https://shopify.github.io/react-native-skia/)**, **[react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/)**, and **[react-native-gesture-handler](https://docs.swmansion.com/react-native-gesture-handler/)**. Data and live values flow through Reanimated `SharedValue`s, so the UI thread animates without per-frame JS bridge traffic.

<!-- TODO(hero): replace this comment with a demo GIF/screenshot, e.g.:
     <p align="center"><img src="assets/images/demo.gif" alt="react-native-livechart demo" width="320" /></p>
     Capture from the Expo example app (npm start). -->

> The design, feature set, and API shape are **conceptually inspired by [liveline](https://github.com/benjitaylor/liveline)** — Benji Taylor's real-time canvas chart for React — reimagined for React Native. This is **not** a fork; see [Acknowledgments](#acknowledgments).

## Features

- 📈 **Line & candlestick** modes (with line/candle morph) in a single component
- 🧬 **Multi-series** charts with a toggleable legend and per-series live dots
- 🔍 **Scrubbing** with a crosshair and worklet-friendly `onScrub` payloads
- ⚡ **Momentum** detection and **degen** effects (particle bursts + shake on big swings)
- 🏷️ **Trade markers** driven by a `SharedValue` trade stream
- 🎨 **Theming** with light/dark modes and an accent-driven palette
- ⏳ **Loading** (breathing-line shell) and **paused** states out of the box
- 🧵 **SharedValue-driven** rendering — history and live values stay on the UI thread

## Install

```bash
npm install react-native-livechart
```

### Peer dependencies

Install the library's **peer dependencies** in your app (versions should match your React Native / Expo SDK):

| Peer                           | Role                                |
| ------------------------------ | ----------------------------------- |
| `react`                        | UI                                  |
| `react-native`                 | Host                                |
| `@shopify/react-native-skia`   | Canvas rendering                    |
| `react-native-reanimated`      | Shared values, animations, worklets |
| `react-native-worklets`        | Required by Reanimated 4+           |
| `react-native-gesture-handler` | Pan / scrub gestures                |

Follow the Skia, Reanimated, and Gesture Handler install docs for your toolchain (Babel plugin, `GestureHandlerRootView`, etc.).

### Babel (required)

The package ships **TypeScript source**; your app's bundler compiles it with the same stack as a typical **Expo / Reanimated 4** project. In practice that means:

- **`babel-preset-expo`** (or an equivalent that includes Reanimated's Babel plugin), and
- **`react-native-worklets/plugin`** — keep it **last** in the `plugins` array, matching this repo's root [`babel.config.js`](babel.config.js).

If you omit Worklets or reorder plugins, worklets in the chart may fail at build or runtime.

### Metro / `package.json` exports

From **Expo SDK 53+**, Metro resolves `import` using `package.json` **`exports`**, including the **`react-native`** condition (see [Expo Metro: ES Module resolution](https://docs.expo.dev/versions/latest/config/metro/#es-module-resolution)). This library's runtime entry is **`src/index.ts`** under that condition. If you disabled package exports (`unstable_enablePackageExports: false`), align your resolver or re-enable exports so resolution matches the published map.

## Quick start

```tsx
import { useEffect } from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { LiveChart, type LiveChartPoint } from "react-native-livechart";

function LivePrice() {
  const data = useSharedValue<LiveChartPoint[]>([]);
  const value = useSharedValue(100);

  useEffect(() => {
    const id = setInterval(() => {
      const next = value.get() + (Math.random() - 0.5) * 2;
      // Reanimated 4: append in place on the UI thread + set the scalar — never `data.value = ...`
      data.modify((arr) => {
        "worklet";
        arr.push({ time: Date.now() / 1000, value: next });
        if (arr.length > 600) arr.shift();
        return arr;
      });
      value.set(next);
    }, 100);
    return () => clearInterval(id);
  }, [data, value]);

  return (
    <View style={{ height: 240 }}>
      <LiveChart data={data} value={value} accentColor="#3b82f6" />
    </View>
  );
}
```

Candlestick mode is a prop away:

```tsx
<LiveChart data={data} value={value} mode="candle" />
```

Multi-series with a legend:

```tsx
import { LiveChartSeries, type SeriesConfig } from "react-native-livechart";

const series = useSharedValue<SeriesConfig[]>([
  { id: "btc", label: "BTC", color: "#f7931a", data: [], value: 0 },
  { id: "eth", label: "ETH", color: "#627eea", data: [], value: 0 },
]);

<LiveChartSeries series={series} legend dot />;
```

## API overview

The tables below are a **highlight** — the **canonical, full reference is the TypeScript types and JSDoc** shipped in the source (your editor surfaces them on hover and autocomplete).

### `LiveChart` (single series)

| Prop                                     | Description                                                         |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `data`                                   | `SharedValue<LiveChartPoint[]>` — history                           |
| `value`                                  | `SharedValue<number>` — live value for interpolation                |
| `theme`                                  | `"light"` or `"dark"`                                               |
| `accentColor`                            | Primary accent; palette is derived from it                          |
| `timeWindow`                             | Visible window in seconds (default `30`)                            |
| `paused`                                 | Freeze scrolling                                                    |
| `loading`                                | Breathing-line shell until data is ready                            |
| `mode`                                   | `"line"` (default) or `"candle"`                                    |
| `candles` / `liveCandle` / `candleWidth` | Candlestick mode                                                    |
| `tradeStream`                            | `SharedValue<TradeEvent[]>` for trade markers                       |
| `degen`                                  | Particle burst + shake on momentum swings                           |
| `scrub`                                  | Crosshair scrubbing                                                 |
| `momentum`                               | `true` / `false` / `"up"`, `"down"`, or `"flat"` / `MomentumConfig` |
| `onScrub`                                | Callback: `ScrubPoint` or `null`                                    |

### `LiveChartSeries` (multi-series)

| Prop             | Description                                 |
| ---------------- | ------------------------------------------- |
| `series`         | `SharedValue<SeriesConfig[]>`               |
| `legend`         | Toggle chips / compact legend               |
| `dot`            | Per-series live dots, pulse, value lines    |
| `onSeriesToggle` | Chip tap                                    |
| `onScrub`        | Worklet-friendly multi-series scrub payload |

Shared props (both components) include `font`, `insets`, `xAxis`, `yAxis`, `referenceLine`, `leftEdgeFade`, `line`, `formatValue`, `formatTime`, `emptyText`, and more — see the types for the complete set.

## Examples (Expo app in this repo)

Run the example from the repository root:

```bash
npm install
npm start
```

The example app bundles the library from **`src/`**; Metro's [`watchFolders`](metro.config.js) include the package so Fast Refresh sees edits without a separate library bundler. Optionally run **`npm run build:lib:types:watch`** if you want **`dist/*.d.ts`** regenerated continuously for editor/tsconfig consumers.

Screens demonstrate candlestick mode, multi-series, scrub, momentum tuning, degen mode, loading / paused states, and more.

## How it works

- **Skia** draws grid, line, candles, badges, and overlays on the GPU.
- **Reanimated** owns timeline layout, smoothing, and scrub state; hooks feed a small engine API on the UI thread.
- **Gesture Handler** drives scrubbing and chart interactions.

A frame-callback engine (`useFrameCallback`) runs a pure tick function on the UI thread each frame, updating display range, time window, and smoothed values, then writing results to `SharedValue`s. Path builders and overlays read those `SharedValue`s inside `useDerivedValue`, so React re-renders stay minimal.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the dev setup, the `npm run verify` gate, and the worklets-plugin rule. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Acknowledgments

**[liveline](https://github.com/benjitaylor/liveline)** by **Benji Taylor** (MIT) is the **primary inspiration** for this project: live updating charts, line and candlestick modes (including line/candle morph ideas), multi-series behavior, momentum and degen effects, scrubbing, loading and paused states, theme plus accent-driven palettes, and the overall prop vocabulary — even though names differ here (for example `accentColor` vs `color`, `timeWindow` vs `window`, and `SharedValue` streams instead of React state).

This package is a **React Native reimplementation** using **Skia**, **Reanimated**, and **Gesture Handler**. It is **not** the web canvas component ported line-for-line. The codebase **diverged** over time toward more hooks, layout options, and customizability for mobile.

**Third-party / adapted code:** math utilities used for chart geometry and smoothing (including Fritsch–Carlson monotone spline tangents, momentum detection, range/lerp helpers, and related pieces) are **adapted from liveline** under the MIT license. See the [LICENSE](LICENSE) file for the formal notice.

### Compared to liveline

- **Rendering:** liveline uses a DOM `<canvas>` and `requestAnimationFrame`; this library uses **Skia** on the UI thread.
- **Data flow:** liveline takes plain `data` / `value` props; here history and live values are **`SharedValue`s** so worklets avoid per-frame JS bridge work.
- **Input:** scrubbing uses **pan gestures** instead of canvas hover.
- **Scope:** liveline includes features this repo does not (for example **orderbook** visualization and built-in time-window controls); this repo adds **React Native–specific** pieces (for example trade markers via `tradeStream`) and a more decomposed hook API.

## License

MIT — see [LICENSE](LICENSE).
