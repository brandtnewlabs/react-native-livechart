#!/usr/bin/env node
// Compare this checkout with a Git baseline without creating another checkout.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import ts from "typescript";

const baseline = process.argv[2] ?? "origin/main";
const root = process.cwd();
const baselineCommit = execFileSync("git", ["rev-parse", baseline], {
  encoding: "utf8",
}).trim();
const nodeRequire = createRequire(import.meta.url);
function loader(ref) {
  const loaded = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const source = ref
      ? execFileSync(
          "git",
          ["show", `${ref}:${path.relative(root, filename)}`],
          { encoding: "utf8" },
        )
      : fs.readFileSync(filename, "utf8");
    const js = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const mod = { exports: {} };
    loaded.set(filename, mod);
    const require = (specifier) =>
      specifier.startsWith(".")
        ? load(path.resolve(path.dirname(filename), `${specifier}.ts`))
        : nodeRequire(specifier);
    new Function("require", "module", "exports", js)(require, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
const oldLoad = loader(baselineCommit);
const newLoad = loader();
const tickPath =
  "packages/react-native-livechart/src/core/liveChartEngineTick.ts";
const before = oldLoad(tickPath).tickLiveChartEngineFrame;
const after = newLoad(tickPath).tickLiveChartEngineFrame;
const makeCache = newLoad(
  "packages/react-native-livechart/src/core/historyRangeCache.ts",
).makeHistoryRangeCache;
const frames = 1200;
const rounds = 7;
function fixture(scenario, counted = false) {
  let reads = 0;
  const points = Array.from({ length: 6000 }, (_, i) => {
    const p = { time: i, value: 100 + Math.sin(i / 31) * 20 };
    if (counted) {
      let v = p.value;
      Object.defineProperty(p, "value", {
        get() {
          reads++;
          return v;
        },
        set(n) {
          v = n;
        },
      });
    }
    return p;
  });
  const candles = points.map((p) => ({
    time: p.time,
    open: 100,
    close: 100,
    low: p.value - 2,
    high: p.value + 3,
  }));
  const state = {
    displayValue: 100,
    displayMin: 70,
    displayMax: 130,
    displayWindow: 6000,
    timestamp: 5999,
    liveEdge: 5999,
    edgeValue: 100,
    extremaMinValue: NaN,
    extremaMaxValue: NaN,
    extremaMinTime: NaN,
    extremaMaxTime: NaN,
  };
  const input = {
    dt: 16.67,
    canvasWidth: 400,
    canvasHeight: 300,
    timeWindow: 6000,
    smoothing: 0.08,
    exaggerate: false,
    referenceValue: undefined,
    targetValue: 100,
    points,
    candles,
    nowSeconds: 5999,
    historyRevision: {},
    mode: scenario === "live-candle" ? "candle" : "line",
  };
  reads = 0;
  return {
    state,
    input,
    cache: makeCache(),
    reads: () => reads,
    frame(f) {
      input.targetValue = 100 + Math.sin(f / 20) * 5;
      if (scenario === "pan") {
        input.nowSeconds = 7000;
        input.viewEnd = 5990 + f / 600;
      }
      if ((scenario === "12hz" && f % 5 === 0) || scenario === "60hz") {
        points[3000].value = 100 + (f % 31);
        input.historyRevision = {};
      }
      if (scenario === "live-candle")
        input.liveCandle = {
          time: 5999,
          open: 100,
          close: input.targetValue,
          low: 90 - (f % 13),
          high: 130 + (f % 17),
        };
    },
  };
}
function run(tick, scenario, counted = false) {
  const f = fixture(scenario, counted);
  const start = performance.now();
  for (let i = 0; i < frames; i++) {
    f.frame(i);
    tick(f.state, f.input, f.cache);
  }
  return { ms: performance.now() - start, reads: f.reads() };
}
const results = [];
for (const scenario of ["animation", "pan", "12hz", "60hz", "live-candle"]) {
  const a = fixture(scenario),
    b = fixture(scenario);
  for (let i = 0; i < frames; i++) {
    a.frame(i);
    b.frame(i);
    before(a.state, a.input);
    after(b.state, b.input, b.cache);
    assert.deepEqual(b.state, a.state, `${scenario}, frame ${i}`);
  }
  run(before, scenario);
  run(after, scenario);
  const oldTimes = [],
    newTimes = [];
  for (let r = 0; r < rounds; r++) {
    const pair =
      r % 2
        ? [
            [after, newTimes],
            [before, oldTimes],
          ]
        : [
            [before, oldTimes],
            [after, newTimes],
          ];
    for (const [tick, times] of pair) times.push(run(tick, scenario).ms);
  }
  const median = (xs) =>
    [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const oldMs = median(oldTimes),
    newMs = median(newTimes);
  results.push({
    scenario,
    identicalFrames: frames,
    beforeMedianMs: oldMs,
    afterMedianMs: newMs,
    speedup: oldMs / newMs,
    beforeSamplesMs: oldTimes,
    afterSamplesMs: newTimes,
  });
}
// Getter instrumentation runs only after every timing round, avoiding shape/JIT
// changes in later timed scenarios.
for (const result of results) {
  if (result.scenario !== "live-candle") {
    result.beforeValueReads = run(before, result.scenario, true).reads;
    result.afterValueReads = run(after, result.scenario, true).reads;
  }
}
console.log(
  JSON.stringify(
    {
      baselineCommit,
      node: process.version,
      points: 6000,
      frames,
      rounds,
      note: "Node full-tick microbenchmark; not device CPU, FPS, GPU or battery. Value-read counts are separate instrumented runs and include edge-value lookup.",
      results,
    },
    null,
    2,
  ),
);
