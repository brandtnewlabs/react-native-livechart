import {
  buildThresholdLookupTree,
  buildThresholdSplitShaderSource,
} from "../../src/components/thresholdSplitShaderSource";
import { THRESHOLD_SAMPLE_COUNT } from "../../src/math/threshold";

const THRESHOLD_SPLIT_SKSL = buildThresholdSplitShaderSource(
  THRESHOLD_SAMPLE_COUNT,
);

describe("ThresholdSplitShader lookup", () => {
  it("builds one constant-index interpolation leaf per sample segment", () => {
    const tree = buildThresholdLookupTree(5);

    expect(tree.match(/return mix\(samples\[/g)).toHaveLength(4);
    expect(tree).toContain("if (u < float(2))");
    expect(tree).toContain("if (u < float(1))");
    expect(tree).toContain("if (u < float(3))");

    for (let segment = 0; segment < 4; segment++) {
      expect(tree).toContain(
        `return mix(samples[${segment}], samples[${segment + 1}], clamp(u - float(${segment}), 0.0, 1.0));`,
      );
    }
  });

  it("uses a balanced lookup instead of the previous per-fragment loop", () => {
    const leaves = [
      ...THRESHOLD_SPLIT_SKSL.matchAll(
        /return mix\(samples\[(\d+)]\s*,\s*samples\[(\d+)]/g,
      ),
    ];

    expect(THRESHOLD_SPLIT_SKSL).not.toContain("for (");
    expect(THRESHOLD_SPLIT_SKSL).toContain("float thrY = thresholdAt(u);");
    expect(leaves).toHaveLength(THRESHOLD_SAMPLE_COUNT - 1);
    const maximumComparisons = Math.max(
      ...THRESHOLD_SPLIT_SKSL.split("\n")
        .filter((line) => line.trimStart().startsWith("return mix(samples["))
        .map((line) => line.length - line.trimStart().length)
        // The function body starts with one indentation level; each additional
        // two spaces represents one comparison on the route to that leaf.
        .map((spaces) => spaces / 2 - 1),
    );
    expect(maximumComparisons).toBe(6);
    expect(
      leaves.map((match) => [Number(match[1]), Number(match[2])]),
    ).toEqual(
      Array.from({ length: THRESHOLD_SAMPLE_COUNT - 1 }, (_, index) => [
        index,
        index + 1,
      ]),
    );
  });

  it("rejects an invalid sample count", () => {
    expect(() => buildThresholdLookupTree(1)).toThrow(
      "Threshold shader needs at least two samples",
    );
    expect(() => buildThresholdLookupTree(2.5)).toThrow(
      "Threshold shader needs at least two samples",
    );
  });
});
