import { render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue } from "react-native-reanimated";
import { DEGEN_STRIDE } from "../../src/constants";
import { DegenParticlesOverlay } from "../../src/components/DegenParticlesOverlay";
import type { ChartEngineLayout } from "../../src/core/useLiveChartEngine";
import { resolveTheme } from "../../src/theme";
import { withSharedValueAccessors } from "../support/sharedValueMock";

const palette = resolveTheme("#3b82f6", "dark");

function engine(now: number): ChartEngineLayout {
  return withSharedValueAccessors({
    displayMin: { value: 0 },
    displayMax: { value: 100 },
    displayWindow: { value: 30 },
    canvasWidth: { value: 400 },
    canvasHeight: { value: 300 },
    timestamp: { value: now },
  }) as unknown as ChartEngineLayout;
}

const SLOTS = 8;

/** Buffer with `count` active particles spawned at t0=0. */
function packBuffer(count: number): Float64Array<ArrayBuffer> {
  const buf = new Float64Array(SLOTS * DEGEN_STRIDE);
  for (let i = 0; i < count; i++) {
    const b = i * DEGEN_STRIDE;
    buf[b + 0] = 100 + i * 5; // x
    buf[b + 1] = 150; // y
    buf[b + 4] = 0; // t0
    buf[b + 5] = 1; // active
    buf[b + 6] = 2; // size
    buf[b + 7] = i; // colorIndex
  }
  return buf;
}

describe("DegenParticlesOverlay", () => {
  it("renders the atlas for an active-particle burst", () => {
    function Fixture() {
      const pack = useSharedValue<Float64Array<ArrayBuffer>>(packBuffer(4));
      const packRevision = useSharedValue(1);
      return (
        <DegenParticlesOverlay
          pack={pack}
          packRevision={packRevision}
          engine={engine(0.3)}
          palette={palette}
          particleSlotCount={SLOTS}
          particleBurstDurationSec={1}
          particleOpacity={0.8}
          colors={["#16a34a", "#dc2626"]}
        />
      );
    }
    render(<Fixture />);
  });

  it("renders without throwing for an empty (no active particles) buffer", () => {
    function Fixture() {
      const pack = useSharedValue<Float64Array<ArrayBuffer>>(packBuffer(0));
      const packRevision = useSharedValue(0);
      return (
        <DegenParticlesOverlay
          pack={pack}
          packRevision={packRevision}
          engine={engine(0)}
          palette={palette}
          particleSlotCount={SLOTS}
          particleBurstDurationSec={1}
          particleOpacity={0.8}
          colors={null}
        />
      );
    }
    render(<Fixture />);
  });

  it("emits nothing while uninitialized (packRevision < 0)", () => {
    function Fixture() {
      const pack = useSharedValue<Float64Array<ArrayBuffer>>(packBuffer(4));
      const packRevision = useSharedValue(-1);
      return (
        <DegenParticlesOverlay
          pack={pack}
          packRevision={packRevision}
          engine={engine(0.3)}
          palette={palette}
          particleSlotCount={SLOTS}
          particleBurstDurationSec={1}
          particleOpacity={0.8}
          colors={["#16a34a"]}
        />
      );
    }
    render(<Fixture />);
  });
});
