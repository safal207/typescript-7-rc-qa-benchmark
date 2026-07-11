import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const profile = process.env.CI_SIGNAL_PROFILE ?? "stable";
const context = process.env.CI_SIGNAL_CONTEXT ?? process.platform;
const outputDir = path.resolve(process.env.CI_SIGNAL_OUTPUT_DIR ?? "results");

function statusFromOutcome(value) {
  if (value === "success") return "pass";
  if (value === "skipped") return "skipped";
  return "fail";
}

async function countEvidenceFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      const child = path.join(directory, entry.name);
      count += entry.isDirectory() ? await countEvidenceFiles(child) : 1;
    }
    return count;
  } catch {
    return 0;
  }
}

const signals = [];

if (profile === "stable") {
  const installStatus = statusFromOutcome(process.env.LOCKED_INSTALL_OUTCOME);
  const compilerStatus = statusFromOutcome(process.env.COMPILER_SELECTION_OUTCOME);
  const qaStatus = statusFromOutcome(process.env.STABLE_QA_OUTCOME);
  const evidenceFileCount = await countEvidenceFiles(outputDir);

  signals.push(
    {
      id: "locked-install",
      context,
      status: installStatus,
      detail: `npm ci outcome: ${process.env.LOCKED_INSTALL_OUTCOME ?? "unknown"}`
    },
    {
      id: "compiler-selection",
      context,
      status: compilerStatus,
      detail: `compiler-selection outcome: ${process.env.COMPILER_SELECTION_OUTCOME ?? "unknown"}`,
      blockedBy: ["locked-install"]
    },
    {
      id: "stable-qa",
      context,
      status: qaStatus,
      detail: `stable QA outcome: ${process.env.STABLE_QA_OUTCOME ?? "unknown"}`,
      blockedBy: ["locked-install", "compiler-selection"]
    },
    {
      id: "report-artifacts",
      context,
      status: evidenceFileCount > 0 ? "pass" : "fail",
      detail: `${evidenceFileCount} evidence files found under results/`,
      blockedBy: ["stable-qa"]
    }
  );
} else if (profile === "production") {
  signals.push(
    {
      id: "production-install",
      context,
      status: statusFromOutcome(process.env.PRODUCTION_INSTALL_OUTCOME),
      detail: `npm ci --omit=dev outcome: ${process.env.PRODUCTION_INSTALL_OUTCOME ?? "unknown"}`
    },
    {
      id: "qa-fail-closed",
      context,
      status: statusFromOutcome(process.env.QA_GUARD_OUTCOME),
      detail: `fail-closed contract outcome: ${process.env.QA_GUARD_OUTCOME ?? "unknown"}`,
      blockedBy: ["production-install"]
    }
  );
} else if (profile === "checker") {
  signals.push(
    {
      id: "locked-install",
      context,
      status: statusFromOutcome(process.env.LOCKED_INSTALL_OUTCOME),
      detail: `checker npm ci outcome: ${process.env.LOCKED_INSTALL_OUTCOME ?? "unknown"}`
    },
    {
      id: "checker-compiler-selection",
      context,
      status: statusFromOutcome(process.env.COMPILER_SELECTION_OUTCOME),
      detail: `checker compiler-selection outcome: ${process.env.COMPILER_SELECTION_OUTCOME ?? "unknown"}`,
      blockedBy: ["locked-install"]
    }
  );
} else {
  throw new Error(`Unknown CI_SIGNAL_PROFILE: ${profile}`);
}

await mkdir(outputDir, { recursive: true });
const safeContext = context.replace(/[^a-zA-Z0-9._-]+/g, "-");
const outputFile = path.join(outputDir, `ci-signals-${profile}-${safeContext}.json`);
await writeFile(
  outputFile,
  JSON.stringify(
    {
      schemaVersion: 1,
      profile,
      context,
      generatedAt: new Date().toISOString(),
      signals
    },
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(`Wrote ${signals.length} causal CI signals to ${outputFile}`);
