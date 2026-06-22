import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resultsDir = path.join(root, "results");
const metadata = JSON.parse(await readFile(path.join(root, "test-cases", ".generated-metadata.json"), "utf8"));
const isWindows = process.platform === "win32";

function executable(name) {
  return path.join(root, "node_modules", ".bin", `${name}${isWindows ? ".cmd" : ""}`);
}

function parseMetrics(output) {
  const metrics = {};
  for (const line of output.replace(/\r\n/g, "\n").split("\n")) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) metrics[match[1].trim()] = match[2].trim();
  }
  return metrics;
}

function run(binary, args) {
  const result = spawnSync(executable(binary), args, {
    cwd: root,
    encoding: "utf8",
    shell: isWindows
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.error || result.status !== 0) {
    const details = result.error?.message ?? output;
    throw new Error(`${binary} ${args.join(" ")} failed: ${details}`);
  }
  return { binary, args, output, metrics: parseMetrics(output) };
}

async function cleanProjectOutputs() {
  for (let index = 0; index < metadata.projectReferences.packageCount; index += 1) {
    const suffix = String(index).padStart(2, "0");
    const packageDir = path.join(root, "test-cases", "project-references", `pkg-${suffix}`);
    await rm(path.join(packageDir, "lib"), { recursive: true, force: true });
    await rm(path.join(packageDir, "tsconfig.tsbuildinfo"), { force: true });
  }
}

const checks = [];
for (const workload of [
  { id: "many-files", label: "Many small files", config: "tsconfig.json" },
  { id: "type-heavy", label: "Type-heavy types", config: "tsconfig.type-heavy.json" }
]) {
  for (const compiler of [
    { id: "ts6", binary: "tsc6", label: "TypeScript 6" },
    { id: "ts7", binary: "tsc", label: "TypeScript 7" }
  ]) {
    checks.push({
      workload: workload.id,
      workloadLabel: workload.label,
      compiler: compiler.id,
      compilerLabel: compiler.label,
      ...run(compiler.binary, ["-p", workload.config, "--noEmit", "--pretty", "false", "--extendedDiagnostics"])
    });
  }
}

for (const compiler of [
  { id: "ts6", binary: "tsc6", label: "TypeScript 6" },
  { id: "ts7", binary: "tsc", label: "TypeScript 7" }
]) {
  await cleanProjectOutputs();
  checks.push({
    workload: "project-references",
    workloadLabel: "Project references",
    compiler: compiler.id,
    compilerLabel: compiler.label,
    ...run(compiler.binary, ["-b", "test-cases/project-references/tsconfig.json", "--force", "--pretty", "false", "--extendedDiagnostics"])
  });
}

const report = {
  collectedAt: new Date().toISOString(),
  warning: "Compiler-provided extended diagnostics are supplementary. Metric names and implementations may differ between the JavaScript and Go compilers and should not be treated as identical OS-level measurements.",
  checks
};

const preferredMetrics = [
  "Files",
  "Lines of Library",
  "Lines of TypeScript",
  "Identifiers",
  "Symbols",
  "Types",
  "Instantiations",
  "Memory used",
  "Parse time",
  "Bind time",
  "Check time",
  "Emit time",
  "Total time"
];

const sections = [];
for (const workload of ["many-files", "type-heavy", "project-references"]) {
  const entries = checks.filter((check) => check.workload === workload);
  if (entries.length === 0) continue;
  const metricNames = preferredMetrics.filter((name) => entries.some((entry) => entry.metrics[name] !== undefined));
  const rows = metricNames.map((name) =>
    `| ${name} | ${entries.find((entry) => entry.compiler === "ts6")?.metrics[name] ?? "n/a"} | ${entries.find((entry) => entry.compiler === "ts7")?.metrics[name] ?? "n/a"} |`
  );
  sections.push(`## ${entries[0].workloadLabel}\n\n| Compiler-reported metric | TypeScript 6 | TypeScript 7 |\n|---|---:|---:|\n${rows.join("\n")}`);
}

const markdown = `# Extended compiler diagnostics\n\n> Supplementary evidence only. Metric names and implementations may differ between the JavaScript and Go compilers; these are not guaranteed to be equivalent OS-level memory or CPU measurements.\n\n${sections.join("\n\n")}\n`;

await mkdir(resultsDir, { recursive: true });
await writeFile(path.join(resultsDir, "extended-diagnostics.latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.join(resultsDir, "extended-diagnostics.latest.md"), markdown, "utf8");
console.log(markdown);
