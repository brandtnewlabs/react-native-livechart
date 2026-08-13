import {
  PHANTOM_ROUND_MS,
  formatPhantomCountdown,
  nextPhantomClockDelay,
  phantomCountdownAccessibilityLabel,
  phantomRoundSecondsRemaining,
  resolvePhantomTargetPlacement,
  resolvePhantomRound,
} from "./phantomRound";

describe("resolvePhantomRound", () => {
  it("aligns rounds to five-minute epoch boundaries", () => {
    const now = Date.parse("2026-08-13T16:38:31.250Z");
    const round = resolvePhantomRound(now);

    expect(round.startMs).toBe(Date.parse("2026-08-13T16:35:00.000Z"));
    expect(round.endMs).toBe(Date.parse("2026-08-13T16:40:00.000Z"));
    expect(round.endMs - round.startMs).toBe(PHANTOM_ROUND_MS);
  });

  it("moves directly to the current round after a multi-round gap", () => {
    const before = resolvePhantomRound(Date.parse("2026-08-13T16:38:31.250Z"));
    const after = resolvePhantomRound(Date.parse("2026-08-13T16:51:02.000Z"));

    expect(after.id - before.id).toBe(3);
    expect(after.startMs).toBe(Date.parse("2026-08-13T16:50:00.000Z"));
  });
});

describe("resolvePhantomTargetPlacement", () => {
  it("centers an in-range target on its projected Y", () => {
    expect(resolvePhantomTargetPlacement(75, 70, 80, 120, 18, 262)).toEqual({
      edge: "in",
      pillY: 108,
      connectorY: 120,
    });
  });

  it("pins an above-range target below the top caret clearance", () => {
    expect(resolvePhantomTargetPlacement(81, 70, 80, -10, 18, 262)).toEqual({
      edge: "above",
      pillY: 24,
      connectorY: 36,
    });
  });

  it("pins a below-range target above the bottom caret clearance", () => {
    expect(resolvePhantomTargetPlacement(69, 70, 80, 300, 18, 262)).toEqual({
      edge: "below",
      pillY: 232,
      connectorY: 244,
    });
  });

  it("keeps the dashed connector centered on the pinned pill", () => {
    const above = resolvePhantomTargetPlacement(81, 70, 80, -10, 18, 262);
    const below = resolvePhantomTargetPlacement(69, 70, 80, 300, 18, 262);

    expect(above.connectorY - above.pillY).toBe(12);
    expect(below.connectorY - below.pillY).toBe(12);
  });
});

describe("phantom countdown", () => {
  it("rounds remaining time up and never becomes negative", () => {
    const end = Date.parse("2026-08-13T16:40:00.000Z");
    expect(
      phantomRoundSecondsRemaining(Date.parse("2026-08-13T16:38:31.250Z"), end),
    ).toBe(89);
    expect(phantomRoundSecondsRemaining(end + 20_000, end)).toBe(0);
  });

  it("formats timer and accessibility copy", () => {
    expect(formatPhantomCountdown(89)).toBe("01:29");
    expect(formatPhantomCountdown(300)).toBe("05:00");
    expect(phantomCountdownAccessibilityLabel(61)).toBe(
      "Round ends in 1 minute 1 second",
    );
  });

  it("schedules against the next whole second", () => {
    expect(nextPhantomClockDelay(12_250)).toBe(750);
    expect(nextPhantomClockDelay(12_000)).toBe(1000);
  });
});
