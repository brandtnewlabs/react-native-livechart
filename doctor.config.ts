import type { ReactDoctorConfig } from "react-doctor/api";

/**
 * react-native-livechart is a Reanimated + Skia library: data and live values
 * flow through `SharedValue`s and are drawn on the UI thread. A few React-purity
 * lint rules assume an idiomatic React app and fire heavily on patterns that are
 * deliberate (and load-bearing) here. We disable only those, with the rationale
 * documented per rule, rather than contorting the engine to satisfy a rule that
 * does not apply. Everything else stays on.
 */
const config: ReactDoctorConfig = {
  rules: {
    // Manual memoization is intentional throughout the library. `useMemo` gives
    // stable identity to the mutable Skia path / double-buffer caches (the
    // SkPath-reuse optimization — see CLAUDE.md) and to the worklet/gesture
    // callbacks that are consumed off the React render path. React Compiler
    // cannot auto-memoize these: it detects their in-place mutation (the same
    // reason the react-hooks-js/immutability findings fire), so the manual memo
    // is load-bearing, not redundant. Removing it would allocate a fresh cache
    // every render and break the buffering.
    "react-doctor/react-compiler-no-manual-memoization": "off",
  },
};

export default config;
