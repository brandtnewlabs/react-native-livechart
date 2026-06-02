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
        // LiveChart / LiveChartSeries are the top-level composition roots; their
        // size is inherent to a fully-featured chart component. (The `tooltipBody`
        // JSX-as-prop slot is suppressed inline at its call site in LiveChart.tsx.)
        files: [
          "**/components/LiveChart.tsx",
          "**/components/LiveChartSeries.tsx",
        ],
        rules: ["react-doctor/no-giant-component"],
      },
      {
        // `emitShake` notifies the consumer when a momentum shake is detected on
        // the UI thread (in the frame worklet, via runOnJS) — there's no React
        // event to move the side effect into, so no-event-handler doesn't apply.
        files: ["**/hooks/useDegen.ts", "**/hooks/useMultiSeriesDegen.ts"],
        rules: ["react-doctor/no-event-handler"],
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
        // react-doctor is a CLI dev tool, never imported — it flags itself.
        files: ["package.json", "**/package.json"],
        rules: ["deslop/unused-dev-dependency"],
      },
    ],
  },
};

export default config;
