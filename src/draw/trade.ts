import type { TradeEvent } from "../types";

// ── Output type consumed by the overlay ────────────────────────────────────────

export interface TradeMarker {
  y: number;
  label: string;
  green: boolean;
  alpha: number;
}

// ── Internal state for the scrolling tape ──────────────────────────────────────

export interface StreamLabel {
  y: number;
  text: string;
  green: boolean;
  life: number;
  maxLife: number;
  intensity: number;
}

export interface TradeStreamState {
  labels: StreamLabel[];
  spawnTimer: number;
  smoothSpeed: number;
  lastSeenTime: number;
}

export function createTradeStreamState(): TradeStreamState {
  return {
    labels: [],
    spawnTimer: 0,
    smoothSpeed: BASE_SPEED,
    lastSeenTime: 0,
  };
}

// ── Constants (matching reference) ─────────────────────────────────────────────

export const MAX_LABELS = 50;
export const LABEL_LIFETIME = 6;
const SPAWN_INTERVAL = 40;
const MIN_LABEL_GAP = 22;
const BASE_SPEED = 60;
const MAX_SPEED = 160;

// ── Size formatter ─────────────────────────────────────────────────────────────

function formatSize(size: number): string {
  "worklet";
  if (size >= 10) return `$${Math.round(size)}`;
  if (size >= 1) return `$${size.toFixed(1)}`;
  return `$${size.toFixed(2)}`;
}

// ── Tick: spawn, move, expire ──────────────────────────────────────────────────

/**
 * Advance the trade stream state by one frame.
 * Spawns labels from new trades at `chartBottom`, scrolls them upward with
 * deceleration, and expires labels that reach the top or run out of life.
 *
 * Pure worklet — no Skia imports. Mutates `state` in place.
 */
export function tickTradeStream(
  state: TradeStreamState,
  trades: TradeEvent[],
  dtMs: number,
  chartTop: number,
  chartBottom: number,
): void {
  "worklet";
  const dtSec = dtMs / 1000;
  const range = chartBottom - chartTop;
  if (range <= 0) return;

  const newCount = trades.length;
  const newestTime =
    newCount > 0 ? trades[newCount - 1].time : /* istanbul ignore next */ 0;
  const hasNewTrades = newestTime > state.lastSeenTime && newCount > 0;

  // Count how many trades arrived since last seen time
  let newTradesDelta = 0;
  if (hasNewTrades) {
    for (let i = newCount - 1; i >= 0; i--) {
      if (trades[i].time <= state.lastSeenTime) break;
      newTradesDelta++;
    }
  }
  const activity = Math.min(newTradesDelta / 5, 1);

  // Smooth speed lerp (fast attack, slow decay)
  const targetSpeed = BASE_SPEED + activity * (MAX_SPEED - BASE_SPEED);
  const speedLerp = activity > 0 ? 0.3 : 0.05;
  state.smoothSpeed += (targetSpeed - state.smoothSpeed) * speedLerp;
  const speed = state.smoothSpeed;

  // Find max size among recent trades for intensity normalisation
  let maxSize = 0;
  const recentStart = Math.max(0, newCount - 20);
  for (let i = recentStart; i < newCount; i++) {
    if (trades[i].size > maxSize) maxSize = trades[i].size;
  }

  // Spawn new labels at bottom
  state.spawnTimer += dtMs;
  while (
    state.spawnTimer >= SPAWN_INTERVAL &&
    hasNewTrades &&
    state.labels.length < MAX_LABELS
  ) {
    state.spawnTimer -= SPAWN_INTERVAL;

    // Overlap check
    let tooClose = false;
    for (let j = 0; j < state.labels.length; j++) {
      if (Math.abs(state.labels[j].y - chartBottom) < MIN_LABEL_GAP) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) break;

    // Pick a recent trade (weighted random by size)
    const windowStart = Math.max(0, newCount - 10);
    let totalWeight = 0;
    for (let i = windowStart; i < newCount; i++) totalWeight += trades[i].size;
    let r = Math.random() * totalWeight;
    let picked = trades[newCount - 1];
    for (let i = windowStart; i < newCount; i++) {
      r -= trades[i].size;
      if (r <= 0) {
        picked = trades[i];
        break;
      }
    }

    const sizeRatio =
      maxSize > 0 ? picked.size / maxSize : /* istanbul ignore next */ 0.5;

    state.labels.push({
      y: chartBottom,
      text: `${picked.side === "buy" ? "+" : "-"} ${formatSize(picked.size)}`,
      green: picked.side === "buy",
      life: LABEL_LIFETIME,
      maxLife: LABEL_LIFETIME,
      intensity: 0.5 + sizeRatio * 0.5,
    });
  }

  state.lastSeenTime = newestTime;

  // Move labels upward with deceleration + expire
  let writeIdx = 0;
  for (let i = 0; i < state.labels.length; i++) {
    const l = state.labels[i];
    l.life -= dtSec;
    if (l.life <= 0) continue;
    const yProgress = (l.y - chartTop) / range; // 1 at bottom, 0 at top
    l.y -= speed * (0.7 + 0.3 * yProgress) * dtSec;
    if (l.y < chartTop - 14) continue;
    state.labels[writeIdx++] = l;
  }
  state.labels.length = writeIdx;
}

// ── Project labels for the overlay ─────────────────────────────────────────────

/**
 * Convert internal StreamLabel state to TradeMarker array for the overlay.
 * Computes per-label alpha from fadeIn, fadeOut, and intensity.
 */
export function projectLabels(
  state: TradeStreamState,
  chartTop: number,
  chartH: number,
): TradeMarker[] {
  "worklet";
  const out: TradeMarker[] = [];
  for (let i = 0; i < state.labels.length; i++) {
    const l = state.labels[i];
    const lifeRatio = l.life / l.maxLife;
    const fadeIn = Math.min((1 - lifeRatio) * 10, 1);
    const yRatio =
      chartH > 0 ? (l.y - chartTop) / chartH : /* istanbul ignore next */ 1;
    const fadeOut = yRatio < 0.45 ? yRatio / 0.45 : 1;
    const alpha = l.intensity * fadeIn * fadeOut;

    out.push({
      y: l.y,
      label: l.text,
      green: l.green,
      alpha: Math.max(0, Math.min(1, alpha)),
    });
  }
  return out;
}
