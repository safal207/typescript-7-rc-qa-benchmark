import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resultsDir = path.join(root, "results");
const metadataPath = path.join(root, "test-cases", ".generated-metadata.json");
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
const randomSeed = readInteger("BENCHMARK_SEED", 20260622, 1, 2_147_483_646);
const selectedSuiteIds = new Set(
  (process.env.BENCHMARK_SUITES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

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

async function cleanDirectory(relativePath) {
  await rm(path.join(root, relativePath), { recursive: true, force: true });
}

async function cleanProjectReferenceOutputs() {
  const packageCount = workload.projectReferences.packageCount;
  for (let packageIndex = 0; packageIndex < packageCount; packageIndex += 1) {
    const suffix = String(packageIndex).padStart(2, "0");
    await cleanDirectory(path.join("test-cases", "project-references", `pkg-${suffix}`, "lib"));
    await rm(
      path.join(root, "test-cases", "project-references", `pkg-${suffix}`, "tsconfig.tsbuildinfo"),
      { force: true }
    );
  }
}

function compilerScenario(id, label, binary, args, options = {}) {
  return { id, label, binary, args, baseline: false, ...options };
}

const typecheckArgs = (config) => ["-p", config, "--noEmit", "--pretty", "false"];
const suites = [
  {
    id: "many-files-typecheck",
    label: "Many small files: type-check only",
    scenarios: [
      compilerScenario("ts6-default", "TypeScript 6 default", "tsc6", typecheckArgs("tsconfig.json"), { baseline: true }),
      compilerScenario("ts7-default", "TypeScript 7 default", "tsc", typecheckArgs("tsconfig.json")),
      compilerScenario("ts7-single-threaded", "TypeScript 7 single-threaded", "tsc", [...typecheckArgs("tsconfig.json"), "--singleThreaded"]),
      compilerScenario("ts7-checkers-1", "TypeScript 7 checkers=1", "tsc", [...typecheckArgs("tsconfig.json"), "--checkers", "1"]),
      compilerScenario("ts7-checkers-2", "TypeScript 7 checkers=2", "tsc", [...typecheckArgs("tsconfig.json"), "--checkers", "2"]),
      compilerScenario("ts7-checkers-4", "TypeScript 7 checkers=4", "tsc", [...typecheckArgs("tsconfig.json"), "--checkers", "4"])
    ]
  },
  {
    id: "type-heavy-typecheck",
    label: "Type-heavy mapped and conditional types",
    scenarios: [
      compilerScenario("ts6-default", "TypeScript 6 default", "tsc6", typecheckArgs("tsconfig.type-heavy.json"), { baseline: true }),
      compilerScenario("ts7-default", "TypeScript 7 default", "tsc", typecheckArgs("tsconfig.type-heavy.json")),
      compilerScenario("ts7-single-threaded", "TypeScript 7 single-threaded", "tsc", [...typecheckArgs("tsconfig.type-heavy.json"), "--singleThreaded"]),
      compilerScenario("ts7-checkers-1", "TypeScript 7 checkers=1", "tsc", [...typecheckArgs("tsconfig.type-heavy.json"), "--checkers", "1"]),
      compilerScenario("ts7-checkers-2", "TypeScript 7 checkers=2", "tsc", [...typecheckArgs("tsconfig.type-heavy.json"), "--checkers", "2"]),
      compilerScenario("ts7-checkers-4", "TypeScript 7 checkers=4", "tsc", [...typecheckArgs("tsconfig.type-heavy.json"), "--checkers", "4"])
    ]
  },
  {
    id: "javascript-emit",
    label: "JavaScript emit",
    scenarios: [
      compilerScenario("ts6-default", "TypeScript 6 default", "tsc6", ["-p", "tsconfig.emit.json", "--outDir", "results/benchmark-output/js-ts6", "--pretty", "false"], {
        baseline: true,
        beforeEach: () => cleanDirectory("results/benchmark-output/js-ts6")
      }),
      compilerScenario("ts7-default", "TypeScript 7 default", "tsc", ["-p", "tsconfig.emit.json", "--outDir", "results/benchmark-output/js-ts7", "--pretty", "false"], {
        beforeEach: () => cleanDirectory("results/benchmark-output/js-ts7")
      })
    ]
  },
  {
    id: "declaration-emit",
    label: "Declaration-only emit",
    scenarios: [
      compilerScenario("ts6-default", "TypeScript 6 default", "tsc6", ["-p", "tsconfig.declarations.json", "--outDir", "results/benchmark-output/dts-ts6", "--pretty", "false"], {
        baseline: true,
        beforeEach: () => cleanDirectory("results/benchmark-output/dts-ts6")
      }),
      compilerScenario("ts7-default", "TypeScript 7 default", "tsc", ["-p", "tsconfig.declarations.json", "--outDir", "results/benchmark-output/dts-ts7", "--pretty", "false"], {
        beforeEach: () => cleanDirectory("results/benchmark-output/dts-ts7")
      })
    ]
  },
  {
    id: "project-references-clean-build",
    label: "Project references: clean forced build",
    scenarios: [
      compilerScenario("ts6-default", "TypeScript 6 default", "tsc6", ["-b", "test-cases/project-references/tsconfig.json", "--force", "--pretty", "false"], {
        baseline: true,
        beforeEach: cleanProjectReferenceOutputs
      }),
      compilerScenario("ts7-default", "TypeScript 7 default", "tsc", ["-b", "test-cases/project-references/tsconfig.json", "--force", "--pretty", "false"], {
        beforeEach: cleanProjectReferenceOutputs
      }),
      compilerScenario("ts7-builders-1", "TypeScript 7 builders=1", "tsc", ["-b", "test-cases/project-references/tsconfig.json", "--force", "--pretty", "false", "--builders", "1"], {
        beforeEach: cleanProjectReferenceOutputs
      }),
      compilerScenario("ts7-builders-2", "TypeScript 7 builders=2", "tsc", ["-b", "test-cases/project-references/tsconfig.json", "--force", "--pretty", "false", "--builders", "2"], {
        beforeEach: cleanProjectReferenceOutputs
      }),
      compilerScenario("ts7-builders-4", "TypeScript 7 builders=4", "tsc", ["-b", "test-cases/project-references/tsconfig.json", "--force", "--pretty", "false", "--builders", "4"], {
        beforeEach: cleanProjectReferenceOutputs
      })
    ]
  }
].filter((suite) => selectedSuiteIds.size === 0 || selectedSuiteIds.has(suite.id));

if (suites.length === 0) {
  throw new Error(`BENCHMARK_SUITES did not match any known suite: ${[...selectedSuiteIds].join(", ")}`);
}

const random = createRandom(randomSeed);
const measuredSuites = [];
for (const suite of suites) {
  console.log(`\n## ${suite.label}`);
  const samplesByScenario = new Map(suite.scenarios.map((scenario) => [scenario.id, []]));

  for (let warmup = 1; warmup <= warmupCount; warmup += 1) {
    for (const scenario of shuffle(suite.scenarios, random)) {
      await scenario.beforeEach?.();
      process.stdout.write(`Warm-up ${warmup}/${warmupCount}: ${scenario.label}... `);
      runProcess(scenario.binary, scenario.args);
      console.log("done");
    }
  }

  const orderByRound = [];
  for (let round = 1; round <= runCount; round += 1) {
    const roundOrder = shuffle(suite.scenarios, random);
    orderByRound.push(roundOrder.map((scenario) => scenario.id));
    for (const scenario of roundOrder) {
      await scenario.beforeEach?.();
      const durationMs = runProcess(scenario.binary, scenario.args);
      samplesByScenario.get(scenario.id).push(durationMs);
      console.log(`${scenario.label} round ${round}/${runCount}: ${durationMs.toFixed(2)} ms`);
    }
  }

  const baselineScenario = suite.scenarios.find((scenario) => scenario.baseline);
  if (!baselineScenario) throw new Error(`Suite ${suite.id} has no baseline scenario`);
  const baselineSamples = samplesByScenario.get(baselineScenario.id);
  const baselineMedian = median(baselineSamples);

  const scenarios = suite.scenarios.map((scenario, scenarioIndex) => {
    const samplesMs = samplesByScenario.get(scenario.id);
    const summary = summarize(samplesMs, randomSeed + measuredSuites.length * 100 + scenarioIndex + 1);
    return {
      id: scenario.id,
      label: scenario.label,
      samplesMs,
      summary,
      speedupVsTs6Median: baselineMedian / summary.medianMs
    };
  });

  measuredSuites.push({ id: suite.id, label: suite.label, orderByRound, scenarios });
}

const report = {
  measuredAt: new Date().toISOString(),
  methodology: {
    warmupRunsPerScenario: warmupCount,
    measuredRunsPerScenario: runCount,
    randomizedInterleavedRounds: true,
    randomSeed,
    bootstrapResamples,
    outlierPolicy: "IQR outliers are reported but never removed",
    measurement: "wall-clock duration of a fresh compiler process; setup and output cleanup occur outside the timer"
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
  suites: measuredSuites
};

const markdownSections = report.suites.map((suite) => {
  const rows = suite.scenarios.map((scenario) => {
    const ci = scenario.summary.medianConfidenceInterval95;
    return `| ${scenario.label} | ${scenario.summary.medianMs.toFixed(2)} | ${ci.lowMs.toFixed(2)}–${ci.highMs.toFixed(2)} | ${scenario.summary.p95Ms.toFixed(2)} | ${(scenario.summary.coefficientOfVariation * 100).toFixed(1)}% | ${scenario.summary.outlierCountIqr} | ${scenario.speedupVsTs6Median.toFixed(2)}x |`;
  });
  return `## ${suite.label}\n\n| Scenario | Median (ms) | Median 95% CI | P95 (ms) | CV | IQR outliers | Speedup vs TS6 |\n|---|---:|---:|---:|---:|---:|---:|\n${rows.join("\n")}`;
});

const markdown = `# Latest benchmark V2\n\n- Measured: ${report.measuredAt}\n- OS: ${report.environment.os} (${report.environment.architecture})\n- CPU: ${report.environment.cpuModel} × ${report.environment.logicalCpuCount}\n- Node: ${report.environment.node}\n- TypeScript 6: ${report.compilers.ts6}\n- TypeScript 7: ${report.compilers.ts7}\n- Measured runs per scenario: ${runCount}\n- Warm-ups per scenario: ${warmupCount}\n- Randomized round seed: ${randomSeed}\n- Bootstrap resamples: ${bootstrapResamples}\n\n${markdownSections.join("\n\n")}\n\n> Scenarios are interleaved in a deterministic randomized order. Outliers are reported and retained. Confidence intervals are non-parametric bootstrap intervals for the median.\n`;

await mkdir(resultsDir, { recursive: true });
await writeFile(path.join(resultsDir, "benchmark-v2.latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.join(resultsDir, "benchmark-v2.latest.md"), markdown, "utf8");
console.log(`\n${markdown}`);
