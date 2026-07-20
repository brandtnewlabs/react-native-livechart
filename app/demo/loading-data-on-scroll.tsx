import { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import {
  LiveChart,
  type LiveChartPoint,
  type VisibleRange,
} from "react-native-livechart";
import { useSharedValue } from "react-native-reanimated";

import { Chip, ControlRow, ToggleChip } from "../../demo-lib/ChipRow";
import { DemoScreen } from "../../demo-lib/DemoScreen";
import { ACCENT } from "../../demo-lib/shared";
import { demoStyles } from "../../demo-lib/styles";
import { APP_THEME } from "../../demo-lib/theme";

export const options = { title: "Loading data on scroll" };

const TIME_WINDOW_SEC = 60;
const ARCHIVE_STEP_SEC = 2;
const ARCHIVE_ROWS = 480;
const PAGE_ROWS = 45;
const MAX_RETAINED_ROWS = 700;
const PAGE_DELAY_MS = 350;

type HistoryPage = {
  rows: LiveChartPoint[];
  nextCursor: string | null;
};

type HistoryState = "loading" | "ready" | "error" | "exhausted";

function valueAt(time: number): number {
  return (
    100 +
    Math.sin(time / 17) * 5 +
    Math.sin(time / 5.5) * 1.4 +
    Math.cos(time / 31) * 2
  );
}

function createArchive(endSec: number): LiveChartPoint[] {
  return Array.from({ length: ARCHIVE_ROWS }, (_, index) => {
    const time = endSec - (ARCHIVE_ROWS - 1 - index) * ARCHIVE_STEP_SEC;
    return { time, value: valueAt(time) };
  });
}

function abortError(): Error {
  const error = new Error("History request aborted");
  error.name = "AbortError";
  return error;
}

function waitForPage(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }

    const timeout = setTimeout(resolve, PAGE_DELAY_MS);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(abortError());
      },
      { once: true },
    );
  });
}

async function fetchHistoryPage(
  archive: LiveChartPoint[],
  cursor: string | null,
  signal: AbortSignal,
): Promise<HistoryPage> {
  await waitForPage(signal);

  // The demo cursor is an exclusive row index. A real API should sign and scope
  // this value so callers can treat it as opaque.
  const parsedCursor = cursor === null ? archive.length : Number(cursor);
  const end = Number.isFinite(parsedCursor)
    ? Math.max(0, Math.min(parsedCursor, archive.length))
    : archive.length;
  const start = Math.max(0, end - PAGE_ROWS);

  return {
    rows: archive.slice(start, end),
    nextCursor: start > 0 ? String(start) : null,
  };
}

function mergeByTime(
  current: LiveChartPoint[],
  incoming: LiveChartPoint[],
): LiveChartPoint[] {
  const byTime = new Map<number, LiveChartPoint>();
  for (const row of current) byTime.set(row.time, row);
  for (const row of incoming) byTime.set(row.time, row);
  return [...byTime.values()]
    .sort((a, b) => a.time - b.time)
    .slice(-MAX_RETAINED_ROWS);
}

function formatRange(range: VisibleRange | null): string {
  if (!range) return "Waiting for the first visible-range callback";
  const width = Math.max(0, range.endSec - range.startSec);
  return `${width.toFixed(0)}s visible · ${range.following ? "following live" : "scrolled back"}`;
}

export default function LoadingDataOnScrollScreen() {
  const [archive] = useState(() =>
    createArchive(Math.floor(Date.now() / 1000)),
  );
  const initialValue = archive[archive.length - 1]?.value ?? 100;
  const data = useSharedValue<LiveChartPoint[]>([]);
  const value = useSharedValue(initialValue);

  const visibleRange = useRef<VisibleRange | null>(null);
  const cursor = useRef<string | null>(null);
  const loading = useRef(false);
  const exhausted = useRef(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);

  const [historyState, setHistoryState] = useState<HistoryState>("loading");
  const [pageCount, setPageCount] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [rangeLabel, setRangeLabel] = useState(formatRange(null));
  const [liveEnabled, setLiveEnabled] = useState(true);

  const fetchUntil = useCallback(
    async (targetStartSec: number, reset = false) => {
      if (reset) {
        generation.current += 1;
        request.current?.abort();
        loading.current = false;
        exhausted.current = false;
        cursor.current = null;
        data.set([]);
        setPageCount(0);
        setRowCount(0);
      }
      if (loading.current || exhausted.current) return;

      loading.current = true;
      setHistoryState("loading");
      const run = generation.current;

      try {
        while (!exhausted.current) {
          const controller = new AbortController();
          request.current = controller;
          const previousCursor = cursor.current;
          const page = await fetchHistoryPage(
            archive,
            previousCursor,
            controller.signal,
          );
          if (run !== generation.current) return;

          const merged = mergeByTime(data.get(), page.rows);
          data.set(merged);
          cursor.current = page.nextCursor;
          setPageCount((count) => count + 1);
          setRowCount(merged.length);

          const latest = merged[merged.length - 1];
          if (latest) value.set(latest.value);

          if (page.nextCursor === previousCursor && page.nextCursor !== null) {
            throw new Error("History cursor did not advance");
          }
          if (page.nextCursor === null) {
            exhausted.current = true;
            setHistoryState("exhausted");
            break;
          }
          if ((merged[0]?.time ?? Number.POSITIVE_INFINITY) <= targetStartSec) {
            setHistoryState("ready");
            break;
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") setHistoryState("error");
      } finally {
        if (run === generation.current) {
          loading.current = false;
          request.current = null;
        }
      }
    },
    [archive, data, value],
  );

  const resetHistory = useCallback(() => {
    void fetchUntil(Date.now() / 1000 - TIME_WINDOW_SEC * 2, true);
  }, [fetchUntil]);

  const loadOlderHistory = useCallback(() => {
    const range = visibleRange.current;
    const retainedStart = data.get()[0]?.time ?? Date.now() / 1000;
    const windowSec = range
      ? Math.max(1, range.endSec - range.startSec)
      : TIME_WINDOW_SEC;
    const targetStart = (range?.startSec ?? retainedStart) - windowSec;
    void fetchUntil(targetStart);
  }, [data, fetchUntil]);

  useEffect(() => {
    const kickoff = setTimeout(resetHistory, 0);
    return () => {
      clearTimeout(kickoff);
      generation.current += 1;
      request.current?.abort();
    };
  }, [resetHistory]);

  // Simulates a scoped subscribeBars callback. Realtime appends use modify so
  // the retained array is not cloned across the JS/UI boundary on every tick.
  useEffect(() => {
    if (!liveEnabled) return;

    const interval = setInterval(() => {
      const time = Date.now() / 1000;
      const point = { time, value: valueAt(time) };
      data.modify((rows) => {
        "worklet";
        const last = rows[rows.length - 1];
        if (!last || point.time > last.time) rows.push(point);
        else if (point.time === last.time) rows[rows.length - 1] = point;
        if (rows.length > MAX_RETAINED_ROWS) rows.shift();
        return rows;
      });
      value.set(point.value);
      setRowCount(data.get().length);
    }, 1000);

    return () => clearInterval(interval);
  }, [data, liveEnabled, value]);

  const stateLabel =
    historyState === "loading"
      ? "Fetching history…"
      : historyState === "error"
        ? "Page failed — tap Retry"
        : historyState === "exhausted"
          ? "Beginning of history reached"
          : "Ready to load the next page";

  return (
    <DemoScreen
      title="Loading data on scroll"
      docs="guides/loading-data-on-scroll"
      description={`Pan left to trigger older REST pages. ${pageCount} page${pageCount === 1 ? "" : "s"} · ${rowCount} rows · ${stateLabel}`}
      chart={
        <LiveChart
          data={data}
          value={value}
          accentColor={ACCENT}
          theme={APP_THEME}
          timeWindow={TIME_WINDOW_SEC}
          timeScroll
          zoom
          loading={historyState === "loading" && rowCount === 0}
          badge={{ followViewEdge: true }}
          onVisibleRangeChange={(range) => {
            visibleRange.current = range;
            setRangeLabel(formatRange(range));
          }}
          onReachStart={loadOlderHistory}
          scrub={false}
        />
      }
    >
      <Text style={demoStyles.sectionLabel}>Visible demand</Text>
      <Text style={[demoStyles.chipText, { opacity: 0.6, marginBottom: 8 }]}>
        {rangeLabel}. onReachStart drains cursor pages until at least one more
        visible window is covered.
      </Text>

      <ControlRow label="Data source">
        <ToggleChip
          label="Live subscription"
          value={liveEnabled}
          onChange={setLiveEnabled}
        />
        <Chip
          label={historyState === "error" ? "Retry" : "Load older now"}
          active={historyState === "loading"}
          disabled={historyState === "loading" || historyState === "exhausted"}
          onPress={loadOlderHistory}
        />
        <Chip label="Reset history" active={false} onPress={resetHistory} />
      </ControlRow>
    </DemoScreen>
  );
}
