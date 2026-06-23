import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resultsDir = path.join(root, "results");
const metadataPath = path.join(root, "test-cases", "real-world-type-fest", ".metadata.json");
const configPath = "tsconfig.real-world-type-fest.json";
const isWindows = process.platform === "win32";

function readInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name] ?? String(fallback);
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}; received ${raw}`);
  }
  return value;
}

const runCount = readInteger("BENCHMARK_RUNS", 7, 2, 100);
const warmupCount = readInteger("BENCHMARK_WARMUPS", 1, 0, 10);
const bootstrapResamples = readInteger("BOOTSTRAP_RESAMPLES", 1_000, 100, 20_000);
const randomSeed = readInteger("BENCHMARK_SEED", 20260622, 1, 2_147_483_646) + 10_000;
const workload = JSON.parse(await readFile(metadataPath, "utf8"));

function executable(name) {
  return path.join(root, "node_modules", ".bin", `${name}${isWindows ? ".cmd" : ""}`);
}

function runProcess(binary, args) {
  const startedAt = performance.now();
  const result = spawnSync(executable(binary), args, {
    cwd: root,
    encoding: "utf8",
    shell: isWindows
  });
  const durationMs = performance.now() - startedAt;
  if (result.error || result.status !== 0) {
    const details = result.error?.message ?? result.stderr ?? result.stdout;
    throw new Error(`${binary} ${args.join(" ")} failed: ${details}`);
  }
  return durationMs;
}

function compilerVersion(binary) {
  const result = spawnSync(executable(binary), ["--version"], {
    cwd: root,
    encoding: "utf8",
    shell: isWindows
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Could not read ${binary} version`);
  }
  return result.stdout.trim();
}

function createRandom(seed) {
  let state = seed % 2_147_483_647;
  return () => {
    state = (state * 48_271) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  };
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random() * (index + 1));
    [result[index], result[selected]] = [result[selected], result[index]];
  }
  return result;
}

function percentile(sorted, probability) {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function median(values) {
  return percentile([...values].sort((left, right) => left - right), 0.5);
}

function bootstrapMedianInterval(samples, resamples, seed) {
  const random = createRandom(seed);
  const medians = [];
  for (let iteration = 0; iteration < resamples; iteration += 1) {
    const resample = Array.from({ length: samples.length }, () => samples[Math.floor(random() * samples.length)]);
    medians.push(median(resample));
  }
  medians.sort((left, right) => left - right);
  return {
    lowMs: percentile(medians, 0.025),
    highMs: percentile(medians, 0.975)
  };
}

function summarize(samples, seed) {
  const sorted = [...samples].sort((left, right) => left - right);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;
  const standardDeviation = Math.sqrt(variance);
  const medianValue = percentile(sorted, 0.5);
  const absoluteDeviations = samples.map((value) => Math.abs(value - medianValue));
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  return {
    runs: samples.length,
    meanMs: mean,
    medianMs: medianValue,
    p90Ms: percentile(sorted, 0.9),
    p95Ms: percentile(sorted, 0.95),
    minMs: sorted[0],
    maxMs: sorted.at(-1),
    standardDeviationMs: standardDeviation,
    coefficientOfVariation: mean === 0 ? 0 : standardDeviation / mean,
    medianAbsoluteDeviationMs: median(absoluteDeviations),
    outlierCountIqr: samples.filter((value) => value < lowerFence || value > upperFence).length,
    medianConfidenceInterval95: bootstrapMedianInterval(samples, bootstrapResamples, seed)
  };
}

const args = ["-p", configPath, "--noEmit", "--pretty", "false"];
const scenarios = [
  { id: "ts6-default", label: "TypeScript 6 default", binary: "tsc6", baseline: true },
  { id: "ts7-default", label: "TypeScript 7 default", binary: "tsc", baseline: false }
];
const random = createRandom(randomSeed);
const samplesByScenario = new Map(scenarios.map((scenario) => [scenario.id, []]));

console.log(`\n## Real-world dependency: ${workload.packageName} ${workload.packageVersion}`);
for (let warmup = 1; warmup <= warmupCount; warmup += 1) {
  for (const scenario of shuffle(scenarios, random)) {
    process.stdout.write(`Warm-up ${warmup}/${warmupCount}: ${scenario.label}... `);
    runProcess(scenario.binary, args);
    console.log("done");
  }
}

const orderByRound = [];
for (let round = 1; round <= runCount; round += 1) {
  const roundOrder = shuffle(scenarios, random);
  orderByRound.push(roundOrder.map((scenario) => scenario.id));
  for (const scenario of roundOrder) {
    const durationMs = runProcess(scenario.binary, args);
    samplesByScenario.get(scenario.id).push(durationMs);
    console.log(`${scenario.label} round ${round}/${runCount}: ${durationMs.toFixed(2)} ms`);
  }
}

const baselineMedian = median(samplesByScenario.get("ts6-default"));
const measuredScenarios = scenarios.map((scenario, index) => {
  const samplesMs = samplesByScenario.get(scenario.id);
  const summary = summarize(samplesMs, randomSeed + index + 1);
  return {
    id: scenario.id,
    label: scenario.label,
    samplesMs,
    summary,
    speedupVsTs6Median: baselineMedian / summary.medianMs
  };
});

const report = {
  measuredAt: new Date().toISOString(),
  methodology: {
    warmupRunsPerScenario: warmupCount,
    measuredRunsPerScenario: runCount,
    randomizedInterleavedRounds: true,
    randomSeed,
    bootstrapResamples,
    outlierPolicy: "IQR outliers are reported but never removed",
    measurement: "wall-clock duration of a fresh compiler process with a warm filesystem"
  },
  environment: {
    node: process.version,
    platform: process.platform,
    os: `${os.type()} ${os.release()}`,
    architecture: os.arch(),
    cpuModel: os.cpus()[0]?.model ?? "unknown",
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem()
  },
  compilers: {
    ts6: compilerVersion("tsc6"),
    ts7: compilerVersion("tsc")
  },
  workload,
  orderByRound,
  scenarios: measuredScenarios
};

const rows = measuredScenarios.map((scenario) => {
  const ci = scenario.summary.medianConfidenceInterval95;
  return `| ${scenario.label} | ${scenario.summary.medianMs.toFixed(2)} | ${ci.lowMs.toFixed(2)}–${ci.highMs.toFixed(2)} | ${scenario.summary.p95Ms.toFixed(2)} | ${(scenario.summary.coefficientOfVariation * 100).toFixed(1)}% | ${scenario.summary.outlierCountIqr} | ${scenario.speedupVsTs6Median.toFixed(2)}x |`;
});

const markdown = `# Real-world dependency benchmark: ${workload.packageName} ${workload.packageVersion}\n\n- Measured: ${report.measuredAt}\n- Upstream: ${workload.upstreamRepository} (${workload.upstreamRelease})\n- Consumer files: ${workload.generatedConsumerFiles}\n- Imported public utility types: ${workload.importedTypes.length}\n- OS: ${report.environment.os} (${report.environment.architecture})\n- CPU: ${report.environment.cpuModel} × ${report.environment.logicalCpuCount}\n- Node: ${report.environment.node}\n- TypeScript 6: ${report.compilers.ts6}\n- TypeScript 7: ${report.compilers.ts7}\n- Measured runs per scenario: ${runCount}\n- Warm-ups per scenario: ${warmupCount}\n- Randomized round seed: ${randomSeed}\n- Bootstrap resamples: ${bootstrapResamples}\n\n| Scenario | Median (ms) | Median 95% CI | P95 (ms) | CV | IQR outliers | Speedup vs TS6 |\n|---|---:|---:|---:|---:|---:|---:|\n${rows.join("\n")}\n\n> This suite compiles generated consumers against the pinned declarations of a real-world package. It is stronger than a purely synthetic checker workload, but it is not equivalent to compiling the package's complete upstream repository or test suite.\n`;

await mkdir(resultsDir, { recursive: true });
await writeFile(path.join(resultsDir, "real-world-type-fest.latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.join(resultsDir, "real-world-type-fest.latest.md"), markdown, "utf8");
console.log(`\n${markdown}`);
