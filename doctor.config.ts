import type { ReactDoctorConfig } from "react-doctor/api";

/**
 * react-native-livechart is a Reanimated + Skia library: data and live values
 * flow through `SharedValue`s and are drawn on the UI thread. The findings
 * suppressed below are genuine false positives for that architecture (or for
 * intentional demo code) — each is scoped to the specific files where the
 * pattern is deliberate, with the reason inline, so every rule keeps protecting
 * the rest of the codebase. Everything else react-doctor flagged was fixed in
 * code (see the PR stack): the `.value`→`.get()/.set()` migration, removing
 * redundant manual memoization, dead-code cleanup, ref/purity/effect fixes,
 * direct imports, stable keys, FlatList, and lazy ref init.
 */
const config: ReactDoctorConfig = {
  ignore: {
    overrides: [
      {
        // Fixed-size render-slot pools (particle slots, trade-tape labels): the
        // array index IS the stable slot identity, not reorderable user data.
        files: [
          "**/components/DegenParticlesOverlay.tsx",
          "**/components/TradeStreamOverlay.tsx",
        ],
        rules: ["react-doctor/no-array-index-as-key"],
      },
      {
        // LiveChart / LiveChartSeries are the top-level composition roots; their
        // size is inherent to a fully-featured chart component. The optional
        // `tooltipBody` slot intentionally accepts JSX content as a prop (a
        // standard slot-style API); React Compiler handles its memoization.
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
        // Timed cross-fade: mounting/unmounting children on an `active` prop
        // change via a duration timer is exactly what an effect is for.
        files: ["**/components/LiveChartTransition.tsx"],
        rules: [
          "react-doctor/no-cascading-set-state",
          "react-doctor/no-effect-event-handler",
        ],
      },
      {
        // The gesture is built with Gesture.Tap() and its worklet runs on the UI
        // thread; the latest-value ref it reaches is touched on tap, not in render.
        files: ["**/hooks/useMarkers.ts"],
        rules: ["react-hooks-js/refs"],
      },
      {
        // Degen effects are driven by the frame loop / SharedValue signatures, not
        // user events; deps are deliberately narrowed to avoid re-arming the loop.
        files: ["**/hooks/useDegen.ts", "**/hooks/useMultiSeriesDegen.ts"],
        rules: [
          "react-doctor/exhaustive-deps",
          "react-doctor/no-event-handler",
        ],
      },
      {
        // Demo trend input: the displayed text mirrors a Reanimated SharedValue
        // via a reaction; the formatter-change re-format can't be derived during
        // render (the value updates off the render path). The Intl formatter and
        // its callbacks are deliberately memoized (js-hoist-intl + stable effect /
        // reaction deps), which conflicts with the redundant-memoization rule.
        files: ["**/AnimatedTrendTextInput.tsx"],
        rules: [
          "react-doctor/exhaustive-deps",
          "react-doctor/no-derived-state",
          "react-doctor/no-pass-data-to-parent",
          "react-doctor/react-compiler-no-manual-memoization",
        ],
      },
      {
        // Demo simulation hook: history is fed through a callback by design and
        // its side effects are reaction/timer-driven, not user-event-driven.
        files: ["**/useSimulatedChartData.ts"],
        rules: [
          "react-doctor/no-event-handler",
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
        // react-doctor is a CLI dev tool, never imported — it flags itself.
        files: ["package.json", "**/package.json"],
        rules: ["deslop/unused-dev-dependency"],
      },
    ],
  },
};

export default config;
