import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resultsDir = path.join(root, "results");
const isWindows = process.platform === "win32";

function normalizeDiagnosticOutput(output) {
  return output.replace(/\r\n/g, "\n");
}

function runCompiler(name) {
  const executable = path.join(root, "node_modules", ".bin", `${name}${isWindows ? ".cmd" : ""}`);
  const result = spawnSync(
    executable,
    ["-p", "tsconfig.diagnostics.json", "--pretty", "false"],
    { cwd: root, encoding: "utf8", shell: isWindows }
  );

  if (result.error) {
    throw result.error;
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  const codes = [...output.matchAll(/error TS(\d+):/g)]
    .map((match) => Number(match[1]))
    .sort((left, right) => left - right);

  if (result.status === 0 || codes.length === 0) {
    throw new Error(`${name} did not produce the expected diagnostics. Output:\n${output}`);
  }

  return { exitCode: result.status, codes, output };
}

const ts6 = runCompiler("tsc6");
const ts7 = runCompiler("tsc");
const diagnosticCodesCompatible = JSON.stringify(ts6.codes) === JSON.stringify(ts7.codes);
const diagnosticTextCompatible =
  normalizeDiagnosticOutput(ts6.output) === normalizeDiagnosticOutput(ts7.output);
const exitCodeCompatible = ts6.exitCode === ts7.exitCode;
const compatible = diagnosticCodesCompatible && diagnosticTextCompatible;
const report = {
  compatible,
  diagnosticCodesCompatible,
  diagnosticTextCompatible,
  exitCodeCompatible,
  textNormalization: "CRLF and LF line endings are treated as equivalent",
  comparedAt: new Date().toISOString(),
  ts6,
  ts7
};

await mkdir(resultsDir, { recursive: true });
await writeFile(
  path.join(resultsDir, "diagnostics.latest.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);

console.log(`TypeScript 6 diagnostic codes: ${ts6.codes.join(", ")}`);
console.log(`TypeScript 7 diagnostic codes: ${ts7.codes.join(", ")}`);
console.log(`Diagnostic code compatibility: ${diagnosticCodesCompatible ? "PASS" : "FAIL"}`);
console.log(`Diagnostic text compatibility: ${diagnosticTextCompatible ? "PASS" : "FAIL"}`);
console.log(`Exit codes: TypeScript 6=${ts6.exitCode}, TypeScript 7=${ts7.exitCode}`);
console.log(`Exit-code compatibility: ${exitCodeCompatible ? "PASS" : "OBSERVED DIFFERENCE"}`);

if (!compatible) {
  process.exitCode = 1;
}
