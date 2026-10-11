import { useEffect, useState, type ReactNode } from "react";

/** Let the chart's first native commit paint before mounting the demo's control panel. */
export function DeferredControls({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setReady(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return ready ? children : null;
}
