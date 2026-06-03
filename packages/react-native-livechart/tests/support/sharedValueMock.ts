/**
 * Augment an already-constructed mock object whose properties are bare
 * `{ value }` SharedValue doubles, adding `.get()/.set()` (delegating to
 * `.value`) to each so hook code using the React-Compiler accessors works.
 * Library code was migrated from `.value` to `.get()/.set()`; these doubles
 * must expose both so unit tests that hand-build engines/inputs keep working.
 * Returns the same object for convenient inline use:
 *   `return withSharedValueAccessors({ canvasWidth: { value: w }, ... }) as EngineState;`
 */
export function withSharedValueAccessors<T extends Record<string, unknown>>(
  obj: T,
): T {
  for (const key of Object.keys(obj)) {
    const prop = obj[key] as { value?: unknown; get?: unknown } | null;
    if (
      prop &&
      typeof prop === "object" &&
      "value" in prop &&
      typeof prop.get !== "function"
    ) {
      Object.assign(prop, {
        get() {
          return (prop as { value: unknown }).value;
        },
        set(next: unknown) {
          (prop as { value: unknown }).value = next;
        },
      });
    }
  }
  return obj;
}
