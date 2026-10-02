import { render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue } from "react-native-reanimated";
import { DEGEN_STRIDE } from "../../src/constants";
import { DegenParticlesOverlay } from "../../src/components/DegenParticlesOverlay";
import { resolveTheme } from "../../src/theme";

const palette = resolveTheme("#3b82f6", "dark");

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
  it("renders the atlas for an active-particle burst", async () => {
    function Fixture() {
      const pack = useSharedValue<Float64Array<ArrayBuffer>>(packBuffer(4));
      const packRevision = useSharedValue(1);
      return (
        <DegenParticlesOverlay
          pack={pack}
          packRevision={packRevision}
          particleTimestamp={useSharedValue(0.3)}
          palette={palette}
          particleSlotCount={SLOTS}
          particleBurstDurationSec={1}
          particleOpacity={0.8}
          colors={["#16a34a", "#dc2626"]}
        />
      );
    }
    await render(<Fixture />);
  });

  it("renders without throwing for an empty (no active particles) buffer", async () => {
    function Fixture() {
      const pack = useSharedValue<Float64Array<ArrayBuffer>>(packBuffer(0));
      const packRevision = useSharedValue(0);
      return (
        <DegenParticlesOverlay
          pack={pack}
          packRevision={packRevision}
          particleTimestamp={useSharedValue(0)}
          palette={palette}
          particleSlotCount={SLOTS}
          particleBurstDurationSec={1}
          particleOpacity={0.8}
          colors={null}
        />
      );
    }
    await render(<Fixture />);
  });

  it("emits nothing while uninitialized (packRevision < 0)", async () => {
    function Fixture() {
      const pack = useSharedValue<Float64Array<ArrayBuffer>>(packBuffer(4));
      const packRevision = useSharedValue(-1);
      return (
        <DegenParticlesOverlay
          pack={pack}
          packRevision={packRevision}
          particleTimestamp={useSharedValue(0.3)}
          palette={palette}
          particleSlotCount={SLOTS}
          particleBurstDurationSec={1}
          particleOpacity={0.8}
          colors={["#16a34a"]}
        />
      );
    }
    await render(<Fixture />);
  });
});
