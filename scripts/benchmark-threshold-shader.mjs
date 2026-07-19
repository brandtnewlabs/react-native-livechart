#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import CanvasKitInit from "canvaskit-wasm";
import ts from "typescript";

const SAMPLE_COUNT = 64;
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);
const width = Number(args.width ?? 100);
const height = Number(args.height ?? 200);
const iterations = Number(args.iterations ?? 30);
const warmup = Number(args.warmup ?? 5);

if (
  !Number.isInteger(width) ||
  !Number.isInteger(height) ||
  !Number.isInteger(iterations) ||
  !Number.isInteger(warmup) ||
  width <= 0 ||
  height <= 0 ||
  iterations <= 0 ||
  warmup < 0
) {
  throw new Error(
    "width, height, and iterations must be positive integers; warmup must be a non-negative integer",
  );
}

async function loadSourceBuilder() {
  const filename = path.resolve(
    "packages/react-native-livechart/src/components/thresholdSplitShaderSource.ts",
  );
  const source = await fs.readFile(filename, "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
  return import(moduleUrl);
}

function buildLegacySource(optimizedSource) {
  const lookupStart = optimizedSource.indexOf("float thresholdAt(float u)");
  const mainStart = optimizedSource.indexOf("half4 main(vec2 xy)");
  if (lookupStart < 0 || mainStart < 0) {
    throw new Error("Could not locate the optimized lookup in the shader source");
  }

  return (
    optimizedSource.slice(0, lookupStart) + optimizedSource.slice(mainStart)
  ).replace(
    "float thrY = thresholdAt(u);",
    `float thrY = samples[0];
  for (int j = 0; j < ${SAMPLE_COUNT - 1}; j++) {
    if (u >= float(j)) {
      thrY = mix(samples[j], samples[j + 1], clamp(u - float(j), 0.0, 1.0));
    }
  }`,
  );
}

function compile(CanvasKit, source, label) {
  let compileError = "";
  const effect = CanvasKit.RuntimeEffect.Make(source, (error) => {
    compileError = error;
  });
  if (!effect) throw new Error(`${label} shader did not compile: ${compileError}`);
  return effect;
}

function measureCompile(CanvasKit, source, label) {
  const samples = [];
  for (let index = 0; index < 10; index++) {
    // Keep each source unique so Skia's RuntimeEffect cache cannot turn this
    // into a lookup benchmark after the first compilation.
    const uniqueSource = `${source}\n// compile benchmark ${label} ${index}`;
    const start = performance.now();
    const effect = compile(CanvasKit, uniqueSource, label);
    samples.push(performance.now() - start);
    effect.delete();
  }
  return {
    mean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    minimum: Math.min(...samples),
    maximum: Math.max(...samples),
  };
}

function makeUniforms(effect) {
  const samples = Array.from(
    { length: SAMPLE_COUNT },
    (_, index) => height * (0.5 + 0.3 * Math.sin(index * 0.47)),
  );
  const uniforms = [
    0,
    width,
    width + 1,
    0.1,
    0.85,
    0.25,
    1,
    0.9,
    0.15,
    0.2,
    1,
    0.4,
    0.4,
    0.4,
    1,
    ...samples,
  ];
  if (uniforms.length !== effect.getUniformFloatCount()) {
    throw new Error(
      `Expected ${uniforms.length} uniform floats, shader requires ${effect.getUniformFloatCount()}`,
    );
  }
  return uniforms;
}

function makeRenderer(CanvasKit, source, label) {
  const surface = CanvasKit.MakeSurface(width, height);
  if (!surface) throw new Error(`Could not create the ${label} raster surface`);
  const effect = compile(CanvasKit, source, label);
  const shader = effect.makeShader(makeUniforms(effect));
  const paint = new CanvasKit.Paint();
  paint.setShader(shader);
  const canvas = surface.getCanvas();
  const rect = CanvasKit.XYWHRect(0, 0, width, height);

  return {
    draw() {
      canvas.drawRect(rect, paint);
      surface.flush();
    },
    pixels() {
      return canvas.readPixels(0, 0, {
        width,
        height,
        colorType: CanvasKit.ColorType.RGBA_8888,
        alphaType: CanvasKit.AlphaType.Premul,
        colorSpace: CanvasKit.ColorSpace.SRGB,
      });
    },
    dispose() {
      paint.delete();
      shader.delete();
      effect.delete();
      surface.delete();
    },
  };
}

function percentile(sorted, quantile) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))];
}

function measure(renderer) {
  for (let index = 0; index < warmup; index++) renderer.draw();
  const samples = [];
  for (let index = 0; index < iterations; index++) {
    const start = performance.now();
    renderer.draw();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return {
    mean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p50: percentile(samples, 0.5),
    p90: percentile(samples, 0.9),
    p99: percentile(samples, 0.99),
  };
}

function assertIdenticalPixels(a, b) {
  if (!a || !b || a.length !== b.length) {
    throw new Error("Could not read comparable shader pixels");
  }
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) {
      throw new Error(
        `Shader output differs at byte ${index}: legacy=${a[index]}, optimized=${b[index]}`,
      );
    }
  }
}

const { buildThresholdSplitShaderSource } = await loadSourceBuilder();
const optimizedSource = buildThresholdSplitShaderSource(SAMPLE_COUNT);
const legacySource = buildLegacySource(optimizedSource);
const CanvasKit = await CanvasKitInit({
  locateFile: (file) => path.resolve("node_modules/canvaskit-wasm/bin", file),
});
// Pay CanvasKit's one-time compiler initialization before comparing sources.
compile(CanvasKit, "half4 main(vec2 xy) { return half4(1); }", "warmup").delete();
const legacyCompileA = measureCompile(CanvasKit, legacySource, "legacy A");
const optimizedCompile = measureCompile(CanvasKit, optimizedSource, "optimized");
const legacyCompileB = measureCompile(CanvasKit, legacySource, "legacy B");
const legacy = makeRenderer(CanvasKit, legacySource, "legacy");
const optimized = makeRenderer(CanvasKit, optimizedSource, "optimized");

try {
  legacy.draw();
  optimized.draw();
  assertIdenticalPixels(legacy.pixels(), optimized.pixels());

  // A/B/A order limits one-time warm-up and thermal drift from favouring the
  // implementation that happens to run second.
  const legacyA = measure(legacy);
  const optimizedResult = measure(optimized);
  const legacyB = measure(legacy);
  const legacyMean = (legacyA.mean + legacyB.mean) / 2;

  console.log(
    JSON.stringify(
      {
        backend: "CanvasKit software raster",
        dimensions: { width, height, pixels: width * height },
        iterations,
        warmup,
        output: "byte-identical",
        compileMilliseconds: {
          legacyA: legacyCompileA,
          optimized: optimizedCompile,
          legacyB: legacyCompileB,
        },
        millisecondsPerFrame: {
          legacyA,
          optimized: optimizedResult,
          legacyB,
        },
        meanReductionPercent: ((legacyMean - optimizedResult.mean) / legacyMean) * 100,
      },
      null,
      2,
    ),
  );
} finally {
  legacy.dispose();
  optimized.dispose();
}
