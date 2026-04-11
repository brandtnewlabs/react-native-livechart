# react-native-livechart

High-performance **live** line and candlestick charts for React Native, built with **@shopify/react-native-skia**, **react-native-reanimated**, and **react-native-gesture-handler**. Data and live values are driven through Reanimated `SharedValue`s so the UI thread can animate without per-frame JS bridge traffic.

The design, feature set, and API shape are **conceptually inspired by [liveline](https://github.com/benjitaylor/liveline)** — Benji Taylor’s real-time canvas chart for React — reimagined for React Native (this is not a fork; see [Acknowledgments](#acknowledgments)).

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

### Babel (required)

The package ships **TypeScript source**; your app’s bundler must compile it with the same stack as a typical **Expo / Reanimated 4** project. In practice that means:

- **`babel-preset-expo`** (or an equivalent that includes Reanimated’s Babel plugin), and
- **`react-native-worklets/plugin`** — keep it **last** in the `plugins` array, matching this repo’s root [`babel.config.js`](babel.config.js).

If you omit Worklets or reorder plugins, worklets in the chart may fail at build or runtime.

### Metro / `package.json` exports

From **Expo SDK 53+**, Metro resolves `import` using `package.json` **`exports`**, including the **`react-native`** condition (see [Expo Metro: ES Module resolution](https://docs.expo.dev/versions/latest/config/metro/#es-module-resolution)). This library’s runtime entry is **`src/index.ts`** under that condition. If you disabled package exports (`unstable_enablePackageExports: false`), align your resolver or re-enable exports so resolution matches the published map.

## Install

### Migrating from 0.1.x

**1.0.0** is a **breaking** packaging change: runtime code is no longer precompiled in **`dist/*.js`**. Metro (or your bundler) compiles **`src/`** with **your** Babel + Worklets version, so there is no baked-in `__pluginVersion` in a published JS artifact.

- Remove any dependency on **deep imports** of `react-native-livechart/dist/...` or other internal paths; import only from **`react-native-livechart`**.
- Ensure your app meets **Babel** requirements above.
- After `npm install`, the package’s **`prepare`** script emits **declaration files** only under `dist/` (for TypeScript); you do not consume those `.js` files at runtime.

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
npm install /path/to/react-native-livechart-1.0.0.tgz
```

On install, **`prepare`** runs **`npm run build`** in the package, which is **`tsc --emitDeclarationOnly`** into **`dist/`** (types only). Runtime code is **`src/**/\*.ts(x)`**, compiled by **your** Metro + Babel pipeline — there is no precompiled `dist/index.js` anymore.

**Jest:** The repo root uses a small Jest resolver plus a minimal Worklets native proxy in [`jest-setup.js`](jest-setup.js) so `react-native-reanimated` / `react-native-worklets` 0.7+ can load without JSI. A few unit tests that depend on full shared-value round-trips from layout effects or chained toggles are skipped; exercise those flows in the Expo app or E2E.

### Packaging (maintainers)

[`packages/react-native-livechart/package.json`](packages/react-native-livechart/package.json) points **`react-native`**, **`main`**, **`module`**, and **`exports`** (except **`types`**) at **`./src/index.ts`**. **`dist/`** contains only **`.d.ts`** (+ maps) from [`tsconfig.build.json`](packages/react-native-livechart/tsconfig.build.json). [`babel.lib.config.cjs`](packages/react-native-livechart/babel.lib.config.cjs) remains available if you ever need a local Babel build for debugging; it is not part of the default publish path.

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

The example app bundles the library from **`src/`**; Metro’s [`watchFolders`](metro.config.js) include the package so Fast Refresh sees edits without a separate library bundler. Optionally run **`npm run build:lib:types:watch`** if you want **`dist/*.d.ts`** regenerated continuously for editor/tsconfig consumers.

Screens demonstrate candlestick mode, multi-series, scrub, momentum tuning, degen mode, loading / paused states, and more.

## How it works

- **Skia** draws grid, line, candles, badges, and overlays on the GPU.
- **Reanimated** owns timeline layout, smoothing, and scrub state; hooks feed a small engine API on the UI thread.
- **Gesture Handler** drives scrubbing and chart interactions.

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
