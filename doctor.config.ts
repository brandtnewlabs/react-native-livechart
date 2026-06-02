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
        // react-doctor is a CLI dev tool, never imported — it flags itself.
        files: ["package.json", "**/package.json"],
        rules: ["deslop/unused-dev-dependency"],
      },
    ],
  },
};

export default config;
