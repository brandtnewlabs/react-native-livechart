import type { ReactDoctorConfig } from "react-doctor/api";

/**
 * react-native-livechart is a Reanimated + Skia library: data and live values
 * flow through `SharedValue`s and are drawn on the UI thread. Several
 * React-purity lint rules assume an idiomatic React app and fire on patterns
 * that are deliberate (and load-bearing) here.
 *
 * The two rules below are turned off globally because they conflict with the
 * library's core model everywhere it appears. Everything more localized is
 * suppressed per-file in `ignore.overrides` (so the rule keeps protecting the
 * rest of the codebase), each with the reason it's intentional at that spot.
 */
const config: ReactDoctorConfig = {
  rules: {
    // The library deliberately uses internal barrels (`../hooks`, `../components`)
    // for organization; public consumers import from the package root barrel.
    "react-doctor/no-barrel-import": "off",

    // Every flagged list here is a fixed-size render-slot pool (particle slots,
    // trade-tape labels) or static reference-line config — the array index is the
    // genuine stable identity, never reorderable user data.
    "react-doctor/no-array-index-as-key": "off",
    "react-doctor/no-array-index-key": "off",
  },
  ignore: {
    overrides: [
      {
        // LiveChart / LiveChartSeries are the top-level composition roots; their
        // size is inherent to a fully-featured chart. The conditional tooltip JSX
        // prop is fine under React Compiler.
        files: [
          "**/components/LiveChart.tsx",
          "**/components/LiveChartSeries.tsx",
        ],
        rules: [
          "react-doctor/no-giant-component",
          "react-doctor/jsx-no-jsx-as-prop",
        ],
      },
      {
        // `seriesMetaSig` is a worklet helper intentionally exported for tests.
        files: ["**/components/SeriesToggleChips.tsx"],
        rules: ["react-doctor/only-export-components"],
      },
      {
        // Timed cross-fade: mounting/unmounting children on an `active` prop
        // change via a duration timer is exactly what an effect is for.
        files: ["**/components/LiveChartTransition.tsx"],
        rules: [
          "react-doctor/no-cascading-set-state",
          "react-doctor/no-effect-event-handler",
        ],
      },
      {
        // The gesture is built in useMemo and its worklet runs on the UI thread;
        // the latest-value ref it reaches is touched on tap, not during render.
        files: ["**/hooks/useMarkers.ts"],
        rules: ["react-hooks-js/refs"],
      },
      {
        // Degen effects are driven by the frame loop / SharedValue signatures, not
        // user events; deps are deliberately narrowed to avoid re-arming the loop.
        files: [
          "**/hooks/useDegen.ts",
          "**/hooks/useMultiSeriesDegen.ts",
        ],
        rules: [
          "react-doctor/exhaustive-deps",
          "react-doctor/no-event-handler",
        ],
      },
      {
        // Demo trend input: the displayed text mirrors a Reanimated SharedValue
        // via a reaction; when the formatter changes we re-format the latest
        // value in an effect. It can't be derived during render (the value
        // updates asynchronously off the render path), so the derived-state /
        // pass-data effect rules don't apply here. The Intl formatter and the
        // `format`/`onValue` callbacks are deliberately memoized (js-hoist-intl
        // + stable effect/reaction deps), so the redundant-manual-memoization
        // rule — which conflicts with those — is also waived for this file.
        files: ["**/AnimatedTrendTextInput.tsx"],
        rules: [
          "react-doctor/exhaustive-deps",
          "react-doctor/no-derived-state",
          "react-doctor/no-pass-data-to-parent",
          "react-doctor/react-compiler-no-manual-memoization",
        ],
      },
      {
        // Demo simulation hook: RNG/bonding state seeded once, history fed through
        // a callback by design; side effects are reaction-driven, not event-driven.
        files: ["**/useSimulatedChartData.ts"],
        rules: [
          "react-doctor/no-event-handler",
          "react-doctor/rerender-lazy-ref-init",
          "react-doctor/no-pass-data-to-parent",
        ],
      },
      {
        // Demo: the time band is pinned once (to the current clock) when enabled,
        // so it scrolls with the chart instead of re-pinning every tick.
        files: ["**/demo/horizontal-lines.tsx"],
        rules: ["react-hooks-js/set-state-in-effect"],
      },
      {
        // Demo home screen: a short, static list of links — a ScrollView is fine.
        files: ["app/index.tsx", "**/app/index.tsx"],
        rules: ["react-doctor/rn-no-scrollview-mapped-list"],
      },
      {
        // react-doctor is a CLI dev tool, never imported — flagging itself.
        files: ["package.json", "**/package.json"],
        rules: ["deslop/unused-dev-dependency"],
      },
    ],
  },
};

export default config;
