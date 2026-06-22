import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resultsDir = path.join(root, "results");
const verificationDir = path.join(resultsDir, "verification");
const metadata = JSON.parse(await readFile(path.join(root, "test-cases", ".generated-metadata.json"), "utf8"));
const isWindows = process.platform === "win32";
const strict = (process.env.VERIFY_OUTPUT_STRICT ?? "true").toLowerCase() !== "false";

function executable(name) {
  return path.join(root, "node_modules", ".bin", `${name}${isWindows ? ".cmd" : ""}`);
}

function invoke(binary, args) {
  const result = spawnSync(executable(binary), args, {
    cwd: root,
    encoding: "utf8",
    shell: isWindows
  });
  if (result.error || result.status !== 0) {
    const details = result.error?.message ?? result.stderr ?? result.stdout;
    throw new Error(`${binary} ${args.join(" ")} failed: ${details}`);
  }
}

async function listFiles(directory, baseDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(absolute, baseDirectory));
    } else if (!entry.name.endsWith(".tsbuildinfo")) {
      files.push(path.relative(baseDirectory, absolute).split(path.sep).join("/"));
    }
  }
  return files.sort();
}

function normalizeOutput(buffer) {
  return buffer.toString("utf8").replace(/\r\n/g, "\n");
}

async function snapshot(directory) {
  const files = await listFiles(directory);
  const fileHashes = {};
  for (const relativePath of files) {
    const content = normalizeOutput(await readFile(path.join(directory, relativePath)));
    fileHashes[relativePath] = createHash("sha256").update(content).digest("hex");
  }
  const aggregateHash = createHash("sha256")
    .update(files.map((relativePath) => `${relativePath}\0${fileHashes[relativePath]}`).join("\n"))
    .digest("hex");
  return { files, fileHashes, aggregateHash };
}

function compareSnapshots(ts6, ts7) {
  const ts6Files = new Set(ts6.files);
  const ts7Files = new Set(ts7.files);
  const onlyTs6 = ts6.files.filter((file) => !ts7Files.has(file));
  const onlyTs7 = ts7.files.filter((file) => !ts6Files.has(file));
  const changed = ts6.files
    .filter((file) => ts7Files.has(file) && ts6.fileHashes[file] !== ts7.fileHashes[file]);
  return {
    compatible: onlyTs6.length === 0 && onlyTs7.length === 0 && changed.length === 0,
    onlyTs6,
    onlyTs7,
    changed,
    ts6AggregateHash: ts6.aggregateHash,
    ts7AggregateHash: ts7.aggregateHash,
    ts6FileCount: ts6.files.length,
    ts7FileCount: ts7.files.length
  };
}

async function cleanProjectOutputs() {
  for (let index = 0; index < metadata.projectReferences.packageCount; index += 1) {
    const suffix = String(index).padStart(2, "0");
    const packageDir = path.join(root, "test-cases", "project-references", `pkg-${suffix}`);
    await rm(path.join(packageDir, "lib"), { recursive: true, force: true });
    await rm(path.join(packageDir, "tsconfig.tsbuildinfo"), { force: true });
  }
}

async function projectSnapshot() {
  const files = [];
  const fileHashes = {};
  for (let index = 0; index < metadata.projectReferences.packageCount; index += 1) {
    const suffix = String(index).padStart(2, "0");
    const libDir = path.join(root, "test-cases", "project-references", `pkg-${suffix}`, "lib");
    const packageSnapshot = await snapshot(libDir);
    for (const relativePath of packageSnapshot.files) {
      const qualified = `pkg-${suffix}/${relativePath}`;
      files.push(qualified);
      fileHashes[qualified] = packageSnapshot.fileHashes[relativePath];
    }
  }
  files.sort();
  const aggregateHash = createHash("sha256")
    .update(files.map((relativePath) => `${relativePath}\0${fileHashes[relativePath]}`).join("\n"))
    .digest("hex");
  return { files, fileHashes, aggregateHash };
}

async function verifySimpleEmit(id, config, label) {
  const ts6Dir = path.join(verificationDir, id, "ts6");
  const ts7Dir = path.join(verificationDir, id, "ts7");
  await rm(path.join(verificationDir, id), { recursive: true, force: true });
  invoke("tsc6", ["-p", config, "--outDir", path.relative(root, ts6Dir), "--pretty", "false"]);
  invoke("tsc", ["-p", config, "--outDir", path.relative(root, ts7Dir), "--pretty", "false"]);
  return { id, label, ...compareSnapshots(await snapshot(ts6Dir), await snapshot(ts7Dir)) };
}

async function verifyProjectReferences() {
  await cleanProjectOutputs();
  invoke("tsc6", ["-b", "test-cases/project-references/tsconfig.json", "--force", "--pretty", "false"]);
  const ts6 = await projectSnapshot();
  await cleanProjectOutputs();
  invoke("tsc", ["-b", "test-cases/project-references/tsconfig.json", "--force", "--pretty", "false"]);
  const ts7 = await projectSnapshot();
  return {
    id: "project-references",
    label: "Project-reference JavaScript and declarations",
    ...compareSnapshots(ts6, ts7)
  };
}

await mkdir(verificationDir, { recursive: true });
const checks = [
  await verifySimpleEmit("javascript", "tsconfig.emit.json", "JavaScript emit"),
  await verifySimpleEmit("declarations", "tsconfig.declarations.json", "Declaration-only emit"),
  await verifyProjectReferences()
];
const compatible = checks.every((check) => check.compatible);
const report = {
  verifiedAt: new Date().toISOString(),
  strict,
  normalization: "CRLF is normalized to LF before SHA-256 hashing; .tsbuildinfo files are excluded",
  compatible,
  checks
};

const rows = checks.map((check) =>
  `| ${check.label} | ${check.compatible ? "PASS" : "DIFF"} | ${check.ts6FileCount} | ${check.ts7FileCount} | ${check.changed.length} | ${check.onlyTs6.length} | ${check.onlyTs7.length} |`
);
const details = checks
  .filter((check) => !check.compatible)
  .map((check) => `### ${check.label}\n\n- Changed: ${check.changed.slice(0, 50).join(", ") || "none"}\n- TS6 only: ${check.onlyTs6.slice(0, 50).join(", ") || "none"}\n- TS7 only: ${check.onlyTs7.slice(0, 50).join(", ") || "none"}`)
  .join("\n\n");
const markdown = `# Compiler output compatibility\n\nOverall: **${compatible ? "PASS" : "DIFFERENCES FOUND"}**\n\n| Output | Result | TS6 files | TS7 files | Changed | TS6 only | TS7 only |\n|---|---:|---:|---:|---:|---:|---:|\n${rows.join("\n")}\n\nNormalization: CRLF is treated as LF. Incremental build-info files are excluded.\n\n${details}\n`;

await writeFile(path.join(resultsDir, "output-compatibility.latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.join(resultsDir, "output-compatibility.latest.md"), markdown, "utf8");
console.log(markdown);

if (strict && !compatible) {
  process.exitCode = 1;
}
