import type { ReactDoctorConfig } from "react-doctor/api";

/**
 * react-native-livechart is a Reanimated + Skia library: data and live values
 * flow through `SharedValue`s and are drawn on the UI thread.
 *
 * There are no rule suppressions: every finding react-doctor raised was fixed in
 * code rather than ignored (see the PR stack) — the `.value`→`.get()/.set()`
 * migration, removing redundant manual memoization, dead-code cleanup,
 * ref/purity/effect fixes, direct imports, stable keys, FlatList, lazy ref init,
 * children-based composition over JSX-as-prop, stable slot keys, unconditional
 * external-store syncs in place of prop-watching effects, and splitting the two
 * chart roots into a controller hook + presentational subcomponents.
 *
 * The config is kept (with an empty override list) as the project's react-doctor
 * entry point — run `npm run doctor` to verify it stays clean.
 */
const config: ReactDoctorConfig = {
  ignore: {
    overrides: [],
  },
};

export default config;
