import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resultsDir = path.join(root, "results");
const metadataPath = path.join(root, "test-cases", "generated", ".metadata.json");
const isWindows = process.platform === "win32";
const requestedRuns = process.env.BENCHMARK_RUNS ?? "5";
const runCount = Number.parseInt(requestedRuns, 10);

if (!Number.isInteger(runCount) || runCount < 1 || runCount > 100) {
  throw new Error(`BENCHMARK_RUNS must be an integer from 1 to 100; received ${requestedRuns}`);
}

const workload = JSON.parse(await readFile(metadataPath, "utf8"));

function executable(name) {
  return path.join(root, "node_modules", ".bin", `${name}${isWindows ? ".cmd" : ""}`);
}

function invoke(name, args) {
  const startedAt = performance.now();
  const result = spawnSync(executable(name), args, {
    cwd: root,
    encoding: "utf8",
    shell: isWindows
  });
  const durationMs = performance.now() - startedAt;

  if (result.error || result.status !== 0) {
    const details = result.error?.message ?? result.stderr ?? result.stdout;
    throw new Error(`${name} failed: ${details}`);
  }

  return durationMs;
}

function compilerVersion(name) {
  const result = spawnSync(executable(name), ["--version"], {
    cwd: root,
    encoding: "utf8",
    shell: isWindows
  });

  if (result.error || result.status !== 0) {
    throw new Error(`Could not read ${name} version`);
  }

  return result.stdout.trim();
}

function summarize(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;

  return {
    runs: samples.length,
    meanMs: mean,
    medianMs: median,
    minMs: sorted[0],
    maxMs: sorted.at(-1),
    standardDeviationMs: Math.sqrt(variance)
  };
}

const commonArgs = ["-p", "tsconfig.json", "--noEmit", "--pretty", "false"];
const scenarios = [
  { id: "ts6-default", label: "TypeScript 6 default", binary: "tsc6", args: commonArgs },
  { id: "ts7-default", label: "TypeScript 7 default", binary: "tsc", args: commonArgs },
  { id: "ts7-single-threaded", label: "TypeScript 7 single-threaded", binary: "tsc", args: [...commonArgs, "--singleThreaded"] },
  { id: "ts7-checkers-1", label: "TypeScript 7 checkers=1", binary: "tsc", args: [...commonArgs, "--checkers", "1"] },
  { id: "ts7-checkers-2", label: "TypeScript 7 checkers=2", binary: "tsc", args: [...commonArgs, "--checkers", "2"] },
  { id: "ts7-checkers-4", label: "TypeScript 7 checkers=4", binary: "tsc", args: [...commonArgs, "--checkers", "4"] }
];

const measured = [];
for (const scenario of scenarios) {
  process.stdout.write(`Warming up ${scenario.label}... `);
  invoke(scenario.binary, scenario.args);
  console.log("done");

  const samples = [];
  for (let run = 1; run <= runCount; run += 1) {
    const durationMs = invoke(scenario.binary, scenario.args);
    samples.push(durationMs);
    console.log(`${scenario.label} run ${run}/${runCount}: ${durationMs.toFixed(2)} ms`);
  }

  measured.push({ ...scenario, samplesMs: samples, summary: summarize(samples) });
}

const baselineMedian = measured[0].summary.medianMs;
for (const scenario of measured) {
  scenario.speedupVsTs6Median = baselineMedian / scenario.summary.medianMs;
}

const report = {
  measuredAt: new Date().toISOString(),
  methodology: {
    warmupRunsPerScenario: 1,
    measuredRunsPerScenario: runCount,
    measurement: "wall-clock process duration with warm filesystem cache"
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
  scenarios: measured.map(({ binary, args, ...scenario }) => scenario)
};

const tableRows = report.scenarios.map((scenario) =>
  `| ${scenario.label} | ${scenario.summary.medianMs.toFixed(2)} | ${scenario.summary.meanMs.toFixed(2)} | ${scenario.summary.minMs.toFixed(2)} | ${scenario.summary.maxMs.toFixed(2)} | ${scenario.speedupVsTs6Median.toFixed(2)}x |`
);
const markdown = `# Latest benchmark\n\n- Measured: ${report.measuredAt}\n- OS: ${report.environment.os} (${report.environment.architecture})\n- CPU: ${report.environment.cpuModel} × ${report.environment.logicalCpuCount}\n- Node: ${report.environment.node}\n- TypeScript 6: ${report.compilers.ts6}\n- TypeScript 7: ${report.compilers.ts7}\n- Generated modules: ${report.workload.moduleCount}\n- Measured runs per scenario: ${runCount}\n\n| Scenario | Median (ms) | Mean (ms) | Min (ms) | Max (ms) | Speedup vs TS6 median |\n|---|---:|---:|---:|---:|---:|\n${tableRows.join("\n")}\n\n> These are warm-filesystem wall-clock measurements. Treat CI results as comparative signals, not universal performance claims.\n`;

await mkdir(resultsDir, { recursive: true });
await writeFile(path.join(resultsDir, "benchmark.latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.join(resultsDir, "benchmark.latest.md"), markdown, "utf8");

console.log("\n" + markdown);
