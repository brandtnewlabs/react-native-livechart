import type { RenderResult } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

type HostComponent = unknown;

/**
 * RNTL 14 exposes host elements only. Skia's Jest mock maps its primitives to
 * React Native host views, so these assertions can still inspect the rendered
 * host tree without relying on the removed composite `UNSAFE_*ByType` APIs.
 */
export function getAllByHostType(
  screen: RenderResult,
  component: HostComponent,
): TestInstance[] {
  const candidate = component as { displayName?: unknown; name?: unknown };
  const type =
    typeof component === "string"
      ? component
      : typeof candidate?.displayName === "string"
        ? candidate.displayName
        : typeof candidate?.name === "string"
          ? candidate.name
          : undefined;

  if (!type) {
    throw new Error("Expected a named host component");
  }

  return screen.container.queryAll((instance) => instance.type === type);
}
