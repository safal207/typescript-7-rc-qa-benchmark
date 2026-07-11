import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const graphFile = path.join(repositoryRoot, "config", "ci-causal-graph.json");
const fixtureFile = path.join(repositoryRoot, "fixtures", "ci-causal-comparison.json");

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function uniqueMap(items, kind) {
  const map = new Map();
  for (const item of items) {
    if (!item?.id) throw new Error(`${kind} entry is missing id`);
    if (map.has(item.id)) throw new Error(`Duplicate ${kind} id: ${item.id}`);
    map.set(item.id, item);
  }
  return map;
}

function validateGraph(graph) {
  if (graph.version !== 1) throw new Error(`Unsupported causal graph version: ${graph.version}`);

  const roots = uniqueMap(graph.roots ?? [], "root");
  const consequences = uniqueMap(graph.consequences ?? [], "consequence");
  const fixes = uniqueMap(graph.fixes ?? [], "fix");
  const signals = uniqueMap(graph.signals ?? [], "signal");

  for (const root of roots.values()) {
    if (!consequences.has(root.consequenceId)) {
      throw new Error(`Root ${root.id} references missing consequence ${root.consequenceId}`);
    }
    if (!fixes.has(root.fixId)) {
      throw new Error(`Root ${root.id} references missing fix ${root.fixId}`);
    }
    if (!root.childExplanation) {
      throw new Error(`Root ${root.id} is missing childExplanation`);
    }
  }

  for (const signal of signals.values()) {
    if (!roots.has(signal.rootId)) {
      throw new Error(`Signal ${signal.id} references missing root ${signal.rootId}`);
    }
    if (!signal.childSymptom) {
      throw new Error(`Signal ${signal.id} is missing childSymptom`);
    }
  }

  return { roots, consequences, fixes, signals };
}

function normalizeStatus(status) {
  if (status === "pass" || status === "fail" || status === "skipped") return status;
  throw new Error(`Unsupported CI signal status: ${status}`);
}

function recordKey(record) {
  return `${record.context}::${record.id}`;
}

function analyze(records, graphIndex) {
  const normalized = records.map((record) => {
    if (!graphIndex.signals.has(record.id)) {
      throw new Error(`CI signal ${record.id} is not declared in config/ci-causal-graph.json`);
    }
    return {
      ...record,
      context: record.context ?? "unknown",
      status: normalizeStatus(record.status),
      blockedBy: Array.isArray(record.blockedBy) ? record.blockedBy : []
    };
  });

  const byKey = new Map(normalized.map((record) => [recordKey(record), record]));
  const failures = normalized.filter((record) => record.status !== "pass");
  const suppressed = [];
  const actionable = [];

  for (const record of failures) {
    const blockers = record.blockedBy
      .map((id) => byKey.get(`${record.context}::${id}`))
      .filter(Boolean)
      .filter((blocker) => blocker.status !== "pass");

    if (blockers.length > 0) {
      suppressed.push({ ...record, suppressedBy: blockers.map((item) => item.id) });
    } else {
      actionable.push(record);
    }
  }

  const rootGroups = new Map();
  for (const record of actionable) {
    const signal = graphIndex.signals.get(record.id);
    const root = graphIndex.roots.get(signal.rootId);
    const existing = rootGroups.get(root.id) ?? { root, records: [] };
    existing.records.push({ record, signal });
    rootGroups.set(root.id, existing);
  }

  const roots = [...rootGroups.values()].sort(
    (a, b) => (a.root.priority ?? 99) - (b.root.priority ?? 99) || a.root.id.localeCompare(b.root.id)
  );
  const rawAlarms = failures.length;
  const actionableRootCauses = roots.length;
  const separateQuestionsSaved = Math.max(0, rawAlarms - actionableRootCauses);
  const reductionPercent = rawAlarms === 0 ? 0 : Math.round((separateQuestionsSaved / rawAlarms) * 100);

  return {
    records: normalized,
    failures,
    suppressed,
    actionable,
    roots,
    metrics: {
      totalChecks: normalized.length,
      passedChecks: normalized.filter((record) => record.status === "pass").length,
      rawAlarms,
      suppressedDownstreamAlarms: suppressed.length,
      actionableSignals: actionable.length,
      actionableRootCauses,
      separateQuestionsSaved,
      reductionPercent
    }
  };
}

function escapeMermaid(text) {
  return String(text).replace(/["\n\r]/g, " ").replace(/\[/g, "(").replace(/\]/g, ")");
}

function mermaidId(prefix, value) {
  return `${prefix}_${String(value).replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function buildMermaid(analysis, graphIndex) {
  const lines = ["flowchart LR"];
  if (analysis.roots.length === 0) {
    lines.push('  OK["All observed CI checks passed"]');
    lines.push('  OK --> SAFE["No active causal path"]');
    return lines.join("\n") + "\n";
  }

  for (const group of analysis.roots) {
    const rootId = mermaidId("ROOT", group.root.id);
    const consequence = graphIndex.consequences.get(group.root.consequenceId);
    const fix = graphIndex.fixes.get(group.root.fixId);
    const consequenceId = mermaidId("CONSEQUENCE", consequence.id);
    const fixId = mermaidId("FIX", fix.id);

    lines.push(`  ${rootId}["Cause: ${escapeMermaid(group.root.label)}"]`);
    lines.push(`  ${consequenceId}["Then: ${escapeMermaid(consequence.label)}"]`);
    lines.push(`  ${fixId}["Fix first: ${escapeMermaid(fix.label)}"]`);
    lines.push(`  ${rootId} --> ${consequenceId} --> ${fixId}`);

    group.records.forEach(({ record, signal }, index) => {
      const signalNode = mermaidId("SIGNAL", `${record.context}_${signal.id}_${index}`);
      lines.push(`  ${signalNode}["Alarm: ${escapeMermaid(signal.label)} (${escapeMermaid(record.context)})"] --> ${rootId}`);
    });
  }

  return lines.join("\n") + "\n";
}

function buildBaselineMarkdown(title, analysis) {
  const lines = [
    `# ${title} — without causal graph`,
    "",
    "This view behaves like a wall of blinking lights. Each failed or skipped check is listed separately.",
    ""
  ];

  if (analysis.failures.length === 0) {
    lines.push("No alarms. All collected checks passed.");
  } else {
    analysis.failures.forEach((record, index) => {
      lines.push(`${index + 1}. **${record.context} / ${record.id}** — ${record.status}: ${record.detail ?? "no detail"}`);
    });
  }

  lines.push("", `Separate alarms to understand: **${analysis.metrics.rawAlarms}**.`);
  return lines.join("\n") + "\n";
}

function buildCausalMarkdown(title, analysis, graphIndex) {
  const lines = [
    `# ${title} — with causal graph`,
    "",
    `The graph turns **${analysis.metrics.rawAlarms} alarms** into **${analysis.metrics.actionableRootCauses} root causes**.`,
    `It hides **${analysis.metrics.suppressedDownstreamAlarms} downstream alarms** that cannot be fixed before their blocker.`,
    ""
  ];

  if (analysis.roots.length === 0) {
    lines.push("## Result", "", "All collected checks passed. The causal map was still validated, so a future failure can be explained immediately.");
  } else {
    for (const group of analysis.roots) {
      const consequence = graphIndex.consequences.get(group.root.consequenceId);
      const fix = graphIndex.fixes.get(group.root.fixId);
      lines.push(
        `## ${group.root.label}`,
        "",
        `**Like a child would say:** ${group.root.childExplanation}`,
        "",
        `**Visible alarms:** ${group.records.map(({ signal, record }) => `${signal.label} (${record.context})`).join(", ")}.`,
        "",
        `**Why it matters:** ${consequence.label}.`,
        "",
        `**Fix first:** ${fix.label}.`,
        ""
      );
    }
  }

  if (analysis.suppressed.length > 0) {
    lines.push("## Downstream alarms that should not distract us", "");
    for (const record of analysis.suppressed) {
      lines.push(`- ${record.context} / ${record.id} waits for: ${record.suppressedBy.join(", ")}.`);
    }
    lines.push("");
  }

  lines.push("## Causal graph", "", "```mermaid", buildMermaid(analysis, graphIndex).trimEnd(), "```", "");
  return lines.join("\n") + "\n";
}

function buildChildSummary(title, analysis) {
  const metrics = analysis.metrics;
  const lines = [
    `# ${title} — explain it to a child`,
    "",
    "Imagine a toy robot with many blinking lights.",
    ""
  ];

  if (metrics.rawAlarms === 0) {
    lines.push(
      `- We checked **${metrics.totalChecks} things**.`,
      `- All **${metrics.totalChecks} checks passed**.`,
      "- The map is still useful: when one light turns red later, it will point to the first box to open."
    );
  } else {
    lines.push(
      `- Without the map, we see **${metrics.rawAlarms} red lights** and may try to fix every light.`,
      `- With the map, we see only **${metrics.actionableRootCauses} real boxes** that can contain the problem.`,
      `- **${metrics.suppressedDownstreamAlarms} lights** are only red because another box failed first.`,
      `- We save **${metrics.separateQuestionsSaved} separate questions**, which is **${metrics.reductionPercent}% less noise**.`,
      "- So we fix the first broken box, then many lights can turn green together."
    );
  }

  return lines.join("\n") + "\n";
}

async function findSignalFiles(directory) {
  const found = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (/^ci-signals-.*\.json$/.test(entry.name)) found.push(child);
    }
  }
  await walk(directory);
  return found.sort();
}

async function writeAnalysis(outputDir, title, analysis, graphIndex) {
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, "analysis.json"), JSON.stringify({ title, ...analysis.metrics, failures: analysis.failures, suppressed: analysis.suppressed, roots: analysis.roots.map(({ root, records }) => ({ root, signals: records })) }, null, 2) + "\n"),
    writeFile(path.join(outputDir, "without-graph.md"), buildBaselineMarkdown(title, analysis)),
    writeFile(path.join(outputDir, "with-graph.md"), buildCausalMarkdown(title, analysis, graphIndex)),
    writeFile(path.join(outputDir, "child-summary.md"), buildChildSummary(title, analysis)),
    writeFile(path.join(outputDir, "graph.mmd"), buildMermaid(analysis, graphIndex))
  ]);
}

async function runValidate(graph, graphIndex) {
  console.log(
    `Causal graph valid: ${graphIndex.signals.size} signals -> ${graphIndex.roots.size} roots -> ${graphIndex.consequences.size} consequences -> ${graphIndex.fixes.size} fixes.`
  );
  if (!graph.title) throw new Error("Causal graph is missing title");
}

async function runCompare(graphIndex) {
  const fixture = await readJson(fixtureFile);
  const analysis = analyze(fixture.signals, graphIndex);
  const actual = {
    rawAlarms: analysis.metrics.rawAlarms,
    suppressedDownstreamAlarms: analysis.metrics.suppressedDownstreamAlarms,
    actionableRootCauses: analysis.metrics.actionableRootCauses,
    separateQuestionsSaved: analysis.metrics.separateQuestionsSaved,
    reductionPercent: analysis.metrics.reductionPercent
  };

  for (const [key, expected] of Object.entries(fixture.expected)) {
    if (actual[key] !== expected) {
      throw new Error(`Causal comparison regression for ${key}: expected ${expected}, got ${actual[key]}`);
    }
  }

  const outputDir = path.join(repositoryRoot, "results", "causal-comparison");
  await writeAnalysis(outputDir, "Causal graph A/B fixture", analysis, graphIndex);
  await writeFile(
    path.join(outputDir, "comparison.json"),
    JSON.stringify({ fixture: fixture.name, expected: fixture.expected, actual, passed: true }, null, 2) + "\n"
  );
  console.log(
    `A/B comparison passed: ${actual.rawAlarms} raw alarms -> ${actual.actionableRootCauses} root causes (${actual.reductionPercent}% less noise).`
  );
}

async function runReport(inputDir, outputDir, graphIndex) {
  const files = await findSignalFiles(inputDir);
  const records = [];
  for (const file of files) {
    const payload = await readJson(file);
    if (!Array.isArray(payload.signals)) throw new Error(`Signal file has no signals array: ${file}`);
    records.push(...payload.signals);
  }

  const expectedContexts = (process.env.EXPECTED_CI_CONTEXTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const actualContexts = new Set(records.map((record) => record.context));

  for (const context of expectedContexts) {
    if (actualContexts.has(context)) continue;
    records.push({
      id: context === "production" ? "production-install" : "report-artifacts",
      context,
      status: "fail",
      detail: `No causal signal artifact was found for expected context ${context}`
    });
  }

  const analysis = analyze(records, graphIndex);
  await writeAnalysis(outputDir, "Current CI run", analysis, graphIndex);
  console.log(
    `Current CI causal report: ${analysis.metrics.passedChecks}/${analysis.metrics.totalChecks} checks passed; ${analysis.metrics.actionableRootCauses} active root causes.`
  );
}

const command = process.argv[2] ?? "validate";
const graph = await readJson(graphFile);
const graphIndex = validateGraph(graph);

if (command === "validate") {
  await runValidate(graph, graphIndex);
} else if (command === "compare") {
  await runValidate(graph, graphIndex);
  await runCompare(graphIndex);
} else if (command === "report") {
  const inputDir = path.resolve(process.argv[3] ?? "causal-input");
  const outputDir = path.resolve(process.argv[4] ?? "results/causal-run");
  await runValidate(graph, graphIndex);
  await runReport(inputDir, outputDir, graphIndex);
} else {
  throw new Error(`Unknown command: ${command}. Use validate, compare, or report.`);
}
