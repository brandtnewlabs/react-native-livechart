/** Adaptive value formatter with compact suffixes. Worklet-safe. */
export function formatValue(v: number): string {
  "worklet";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return (
      sign +
      (m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2)) +
      "M"
    );
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return (
      sign +
      (k >= 100 ? k.toFixed(0) : k >= 10 ? k.toFixed(1) : k.toFixed(2)) +
      "K"
    );
  }
  if (abs >= 100) return sign + abs.toFixed(1);
  if (abs >= 1) return sign + abs.toFixed(2);
  if (abs === 0) return "0";
  return sign + abs.toPrecision(4);
}

/** HH:MM:SS time formatter. Worklet-safe. */
export function formatTime(t: number): string {
  "worklet";
  const d = new Date(t * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
