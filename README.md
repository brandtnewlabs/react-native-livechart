# react-native-livechart

High-performance **live** line and candlestick charts for React Native, built with **@shopify/react-native-skia**, **react-native-reanimated**, and **react-native-gesture-handler**. Data and live values are driven through Reanimated `SharedValue`s so the UI thread can animate without per-frame JS bridge traffic.

This repository contains the **library** (`packages/react-native-livechart`) and an **Expo example app** at the repo root.

## Requirements

Install the library’s **peer dependencies** in your app (versions should match your React Native / Expo SDK):

| Peer                           | Role                                |
| ------------------------------ | ----------------------------------- |
| `react`                        | UI                                  |
| `react-native`                 | Host                                |
| `@shopify/react-native-skia`   | Canvas rendering                    |
| `react-native-reanimated`      | Shared values, animations, worklets |
| `react-native-worklets`        | Required by Reanimated 4+           |
| `react-native-gesture-handler` | Pan / scrub gestures                |

Follow Skia, Reanimated, and Gesture Handler install docs for your toolchain (Babel plugin, `GestureHandlerRootView`, etc.).

## Install

### From npm (when published)

```bash
npm install react-native-livechart
```

Set `"private": false` on `packages/react-native-livechart/package.json` and publish when you are ready.

### Private GitHub repo (no public npm)

The example app depends on the library via a local workspace link. In **another** project, use one of these patterns:

**A. Tarball from a clone**

```bash
git clone git@github.com:brandtnewlabs/react-native-livechart.git
cd react-native-livechart/packages/react-native-livechart
npm install
npm pack
# In your app:
npm install /path/to/react-native-livechart-0.1.0.tgz
```

The package `prepare` script runs the full `build` (per-file Babel compile of `src/` into `dist/`, including the Worklets plugin, plus `tsc --emitDeclarationOnly` for types) so published `dist/` matches what Metro would transform and is safe for any normal resolver.

**B. `file:` dependency**

After cloning the monorepo:

```json
"dependencies": {
  "react-native-livechart": "file:../react-native-livechart/packages/react-native-livechart"
}
```

**C. SSH git URL (npm / Yarn / pnpm)**

If your package manager supports installing a **subdirectory** of a git repo, point it at `packages/react-native-livechart`. Syntax varies by tool and version; tarball or `file:` is the most portable.

You need **read access** to the private repository (SSH key or HTTPS token).

## Quick start

```tsx
import { LiveChart } from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

const data = useSharedValue<{ time: number; value: number }[]>([]);
const value = useSharedValue(0);

<LiveChart data={data} value={value} />;
```

## API overview

### `LiveChart` (single series)

Key props (see TypeScript types and JSDoc in the source for the full list):

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

Shared props (both components) include `font`, `insets`, `xAxis`, `yAxis`, `referenceLine`, `leftEdgeFade`, `line`, `formatValue`, `formatTime`, `emptyText`, etc.

## Examples (Expo app in this repo)

Run the example from the repository root:

```bash
npm install
npm start
```

Screens demonstrate candlestick mode, multi-series, scrub, momentum tuning, degen mode, loading / paused states, and more.

## How it works

- **Skia** draws grid, line, candles, badges, and overlays on the GPU.
- **Reanimated** owns timeline layout, smoothing, and scrub state; hooks feed a small engine API on the UI thread.
- **Gesture Handler** drives scrubbing and chart interactions.

## Acknowledgments

Math utilities in this project are adapted from **liveline** by **Benji Taylor** (MIT): <https://github.com/benjitaylor/liveline>

Chart rendering, engine design, and React Native + Skia components are separate implementations.

## License

MIT — see [LICENSE](LICENSE).
