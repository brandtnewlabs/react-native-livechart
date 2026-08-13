export const PHANTOM_ROUND_MS = 5 * 60 * 1000;

export interface PhantomRound {
  id: number;
  startMs: number;
  endMs: number;
}

export type PhantomTargetEdge = "above" | "in" | "below";

export interface PhantomTargetPlacement {
  edge: PhantomTargetEdge;
  /** Top Y of the fixed-height target pill. */
  pillY: number;
  /** Y where the dashed target connector meets the pill. */
  connectorY: number;
}

/**
 * Place the target pill at its projected Y while in range, or pin it just inside
 * the corresponding plot edge with room for an outward caret when off-axis.
 */
export function resolvePhantomTargetPlacement(
  target: number,
  rangeMin: number,
  rangeMax: number,
  projectedY: number,
  plotTop: number,
  plotBottom: number,
  pillHeight = 24,
  indicatorClearance = 6,
): PhantomTargetPlacement {
  "worklet";
  const edge: PhantomTargetEdge =
    target > rangeMax ? "above" : target < rangeMin ? "below" : "in";
  const maxPillY = Math.max(plotTop, plotBottom - pillHeight);
  let pillY: number;

  if (edge === "above") {
    pillY = Math.min(maxPillY, plotTop + indicatorClearance);
  } else if (edge === "below") {
    pillY = Math.max(plotTop, maxPillY - indicatorClearance);
  } else {
    pillY = Math.max(
      plotTop,
      Math.min(maxPillY, projectedY - pillHeight / 2),
    );
  }

  return { edge, pillY, connectorY: pillY + pillHeight / 2 };
}

/** Resolve the epoch-aligned five-minute market round containing `nowMs`. */
export function resolvePhantomRound(nowMs: number): PhantomRound {
  const safeNow = Number.isFinite(nowMs) ? nowMs : 0;
  const id = Math.floor(safeNow / PHANTOM_ROUND_MS);
  const startMs = id * PHANTOM_ROUND_MS;
  return { id, startMs, endMs: startMs + PHANTOM_ROUND_MS };
}

/** Whole seconds left, rounded up so the UI does not show 00:00 early. */
export function phantomRoundSecondsRemaining(
  nowMs: number,
  endMs: number,
): number {
  if (!Number.isFinite(nowMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.ceil((endMs - nowMs) / 1000));
}

export function formatPhantomCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

/** Delay to the next wall-clock second boundary, never a zero-delay loop. */
export function nextPhantomClockDelay(nowMs: number): number {
  const safeNow = Number.isFinite(nowMs) ? Math.max(0, nowMs) : 0;
  const remainder = safeNow % 1000;
  return remainder === 0 ? 1000 : 1000 - remainder;
}

export function phantomCountdownAccessibilityLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  const minuteLabel = `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const secondLabel = `${remainder} second${remainder === 1 ? "" : "s"}`;
  return `Round ends in ${minuteLabel} ${secondLabel}`;
}
