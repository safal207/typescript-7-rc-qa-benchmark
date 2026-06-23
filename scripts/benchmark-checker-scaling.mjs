import { mkdir, readFile, writeFile } from "node:fs/promises";
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

function readCheckerCounts() {
  const raw = process.env.CHECKER_COUNTS ?? "1,2,4,8,16";
  const values = raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value));

  if (values.length === 0 || values.some((value) => value < 1 || value > 256)) {
    throw new Error(`CHECKER_COUNTS must be a comma-separated list of integers from 1 to 256; received ${raw}`);
  }

  return [...new Set(values)];
}

const runCount = readInteger("CHECKER_BENCHMARK_RUNS", 7, 2, 100);
const warmupCount = readInteger("CHECKER_BENCHMARK_WARMUPS", 1, 0, 10);
const randomSeed = readInteger("CHECKER_BENCHMARK_SEED", 20260624, 1, 2_147_483_646);
const checkerCounts = readCheckerCounts();
const workload = JSON.parse(await readFile(metadataPath, "utf8"));

function executable(name) {
  return path.join(root, "node_modules", ".bin", `${name}${isWindows ? ".cmd" : ""}`);
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

function percentile(values, probability) {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function summarize(samples) {
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;
  return {
    runs: samples.length,
    meanMs: mean,
    medianMs: percentile(samples, 0.5),
    p90Ms: percentile(samples, 0.9),
    p95Ms: percentile(samples, 0.95),
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
    standardDeviationMs: Math.sqrt(variance)
  };
}

function scenario(id, label, binary, args, baseline = false) {
  return { id, label, binary, args, baseline };
}

function typecheckArgs(config) {
  return ["-p", config, "--noEmit", "--pretty", "false"];
}

function checkerScenarios(config) {
  return [
    scenario("ts6-default", "TypeScript 6 default", "tsc6", typecheckArgs(config), true),
    scenario("ts7-default", "TypeScript 7 default", "tsc", typecheckArgs(config)),
    ...checkerCounts.map((count) =>
      scenario(
        `ts7-checkers-${count}`,
        `TypeScript 7 checkers=${count}`,
        "tsc",
        [...typecheckArgs(config), "--checkers", String(count)]
      )
    )
  ];
}

const suites = [
  {
    id: "many-files-typecheck",
    label: "Many small files: checker scaling",
    config: "tsconfig.json"
  },
  {
    id: "type-heavy-typecheck",
    label: "Type-heavy mapped and conditional types: checker scaling",
    config: "tsconfig.type-heavy.json"
  }
];

const random = createRandom(randomSeed);
const measuredSuites = [];

for (const suite of suites) {
  const scenarios = checkerScenarios(suite.config);
  const samplesByScenario = new Map(scenarios.map((entry) => [entry.id, []]));

  console.log(`\n## ${suite.label}`);

  for (let warmup = 1; warmup <= warmupCount; warmup += 1) {
    for (const entry of shuffle(scenarios, random)) {
      process.stdout.write(`Warm-up ${warmup}/${warmupCount}: ${entry.label}... `);
      runProcess(entry.binary, entry.args);
      console.log("done");
    }
  }

  const orderByRound = [];
  for (let round = 1; round <= runCount; round += 1) {
    const roundOrder = shuffle(scenarios, random);
    orderByRound.push(roundOrder.map((entry) => entry.id));

    for (const entry of roundOrder) {
      const durationMs = runProcess(entry.binary, entry.args);
      samplesByScenario.get(entry.id).push(durationMs);
      console.log(`${entry.label} round ${round}/${runCount}: ${durationMs.toFixed(2)} ms`);
    }
  }

  const ts6Median = summarize(samplesByScenario.get("ts6-default")).medianMs;
  const ts7DefaultMedian = summarize(samplesByScenario.get("ts7-default")).medianMs;

  measuredSuites.push({
    id: suite.id,
    label: suite.label,
    config: suite.config,
    orderByRound,
    scenarios: scenarios.map((entry) => {
      const samplesMs = samplesByScenario.get(entry.id);
      const summary = summarize(samplesMs);
      return {
        id: entry.id,
        label: entry.label,
        samplesMs,
        summary,
        speedupVsTs6Median: ts6Median / summary.medianMs,
        ratioVsTs7DefaultMedian: summary.medianMs / ts7DefaultMedian
      };
    })
  });
}

const report = {
  measuredAt: new Date().toISOString(),
  methodology: {
    purpose: "Second-round checker scaling requested after upstream feedback",
    checkerCounts,
    warmupRunsPerScenario: warmupCount,
    measuredRunsPerScenario: runCount,
    randomizedInterleavedRounds: true,
    randomSeed,
    measurement: "wall-clock duration of a fresh compiler process"
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

const sections = report.suites.map((suite) => {
  const rows = suite.scenarios.map((entry) =>
    `| ${entry.label} | ${entry.summary.medianMs.toFixed(2)} | ${entry.summary.p95Ms.toFixed(2)} | ${entry.summary.standardDeviationMs.toFixed(2)} | ${entry.speedupVsTs6Median.toFixed(2)}x | ${entry.ratioVsTs7DefaultMedian.toFixed(3)}x |`
  );

  return `## ${suite.label}\n\n| Scenario | Median (ms) | P95 (ms) | Std dev (ms) | Speedup vs TS6 | Time vs TS7 default |\n|---|---:|---:|---:|---:|---:|\n${rows.join("\n")}`;
});

const markdown = `# TypeScript 7 checker scaling — round 2\n\n- Measured: ${report.measuredAt}\n- OS: ${report.environment.os} (${report.environment.architecture})\n- CPU: ${report.environment.cpuModel} × ${report.environment.logicalCpuCount}\n- Node: ${report.environment.node}\n- TypeScript 6: ${report.compilers.ts6}\n- TypeScript 7: ${report.compilers.ts7}\n- Checker counts: ${checkerCounts.join(", ")}\n- Measured runs per scenario: ${runCount}\n- Warm-ups per scenario: ${warmupCount}\n- Random seed: ${randomSeed}\n\n${sections.join("\n\n")}\n\n> Scenarios are fresh compiler processes executed in deterministic randomized order. Values above the host logical CPU count intentionally measure oversubscription behavior.\n`;

await mkdir(resultsDir, { recursive: true });
await writeFile(path.join(resultsDir, "checker-scaling.latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.join(resultsDir, "checker-scaling.latest.md"), markdown, "utf8");
console.log(`\n${markdown}`);
