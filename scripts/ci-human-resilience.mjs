import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const graphFile = path.join(repositoryRoot, "config", "ci-causal-graph.json");

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function validateHumanResilience(graph) {
  const layer = graph.humanResilience;
  if (!layer || layer.version !== 1) {
    throw new Error("humanResilience version 1 is required");
  }

  requireText(layer.title, "humanResilience.title");
  requireText(layer.rule, "humanResilience.rule");

  for (const principleId of ["faith", "hope", "love"]) {
    const principle = layer.principles?.[principleId];
    if (!principle) throw new Error(`Missing human resilience principle: ${principleId}`);
    requireText(principle.engineeringName, `${principleId}.engineeringName`);
    requireText(principle.question, `${principleId}.question`);
    requireText(principle.global, `${principleId}.global`);
    requireText(principle.child, `${principleId}.child`);
  }

  requireText(layer.execution?.action, "humanResilience.execution.action");
  requireText(layer.execution?.feedback, "humanResilience.execution.feedback");

  const rootIds = new Set((graph.roots ?? []).map((root) => root.id));
  const contracts = layer.rootContracts ?? {};

  for (const rootId of rootIds) {
    const contract = contracts[rootId];
    if (!contract) throw new Error(`Missing human resilience contract for root: ${rootId}`);
    for (const field of ["faith", "hope", "love"]) {
      requireText(contract[field], `${rootId}.${field}`);
    }
  }

  for (const rootId of Object.keys(contracts)) {
    if (!rootIds.has(rootId)) {
      throw new Error(`Human resilience contract references unknown root: ${rootId}`);
    }
  }

  return layer;
}

function escapeMermaid(text) {
  return String(text).replace(/["\n\r]/g, " ").replace(/\[/g, "(").replace(/\]/g, ")");
}

function mermaidId(prefix, value) {
  return `${prefix}_${String(value).replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function rootMaps(graph) {
  return {
    roots: new Map((graph.roots ?? []).map((root) => [root.id, root])),
    fixes: new Map((graph.fixes ?? []).map((fix) => [fix.id, fix]))
  };
}

function activeRootIds(analysis) {
  return (analysis.roots ?? [])
    .map((entry) => entry?.root?.id)
    .filter((id) => typeof id === "string");
}

function buildResilienceGraph(graph, layer, analysis) {
  const maps = rootMaps(graph);
  const ids = activeRootIds(analysis);
  const lines = ["flowchart LR"];

  if (ids.length === 0) {
    lines.push(`  F["Faith / ${escapeMermaid(layer.principles.faith.engineeringName)}"]`);
    lines.push('  E["Evidence: all observed checks passed"]');
    lines.push(`  H["Hope / ${escapeMermaid(layer.principles.hope.engineeringName)}"]`);
    lines.push(`  L["Love / ${escapeMermaid(layer.principles.love.engineeringName)}"]`);
    lines.push('  FB["Feedback: keep measuring and revise assumptions when data changes"]');
    lines.push("  F --> E --> H --> FB");
    lines.push("  L -. guards .-> E");
    return lines.join("\n") + "\n";
  }

  ids.forEach((rootId, index) => {
    const root = maps.roots.get(rootId);
    const contract = layer.rootContracts[rootId];
    const fix = maps.fixes.get(root.fixId);
    const suffix = `${rootId}_${index}`;
    const faithId = mermaidId("FAITH", suffix);
    const evidenceId = mermaidId("EVIDENCE", suffix);
    const hopeId = mermaidId("HOPE", suffix);
    const loveId = mermaidId("LOVE", suffix);
    const actionId = mermaidId("ACTION", suffix);
    const feedbackId = mermaidId("FEEDBACK", suffix);

    lines.push(`  ${faithId}["Faith: ${escapeMermaid(contract.faith)}"]`);
    lines.push(`  ${evidenceId}["Data: ${escapeMermaid(root.label)}"]`);
    lines.push(`  ${hopeId}["Hope: ${escapeMermaid(contract.hope)}"]`);
    lines.push(`  ${loveId}["Love: ${escapeMermaid(contract.love)}"]`);
    lines.push(`  ${actionId}["Action: ${escapeMermaid(fix?.label ?? layer.execution.action)}"]`);
    lines.push(`  ${feedbackId}["Feedback: rerun affected signals and compare immutable evidence"]`);
    lines.push(`  ${faithId} --> ${evidenceId} --> ${hopeId} --> ${actionId} --> ${feedbackId}`);
    lines.push(`  ${loveId} -. safety constraint .-> ${actionId}`);
    lines.push(`  ${feedbackId} -. revise assumption .-> ${faithId}`);
  });

  return lines.join("\n") + "\n";
}

function buildMarkdown(graph, layer, analysis) {
  const maps = rootMaps(graph);
  const ids = activeRootIds(analysis);
  const lines = [
    "# Faith, Hope, and Love — engineering resilience layer",
    "",
    `> ${layer.rule}`,
    "",
    "| Principle | Engineering role | Question |",
    "|---|---|---|",
    `| Faith | ${layer.principles.faith.engineeringName} | ${layer.principles.faith.question} |`,
    `| Hope | ${layer.principles.hope.engineeringName} | ${layer.principles.hope.question} |`,
    `| Love | ${layer.principles.love.engineeringName} | ${layer.principles.love.question} |`,
    ""
  ];

  if (ids.length === 0) {
    lines.push(
      "## Current state",
      "",
      "All observed CI checks passed, so there is no active root cause to repair.",
      "",
      `**Faith / assumption:** ${layer.principles.faith.global}`,
      "",
      `**Hope / target state:** ${layer.principles.hope.global}`,
      "",
      `**Love / safety constraint:** ${layer.principles.love.global}`,
      "",
      `**Action:** ${layer.execution.action}`,
      "",
      `**Feedback:** ${layer.execution.feedback}`,
      ""
    );
  } else {
    lines.push(`## Active root contracts (${ids.length})`, "");
    for (const rootId of ids) {
      const root = maps.roots.get(rootId);
      const contract = layer.rootContracts[rootId];
      const fix = maps.fixes.get(root.fixId);
      lines.push(
        `### ${root.label}`,
        "",
        `**Faith / assumption:** ${contract.faith}`,
        "",
        `**Hope / target state:** ${contract.hope}`,
        "",
        `**Love / safety constraint:** ${contract.love}`,
        "",
        `**Action:** ${fix?.label ?? layer.execution.action}.`,
        "",
        `**Feedback:** ${layer.execution.feedback}`,
        ""
      );
    }
  }

  lines.push(
    "## System loop",
    "",
    "```text",
    "Faith (testable assumption)",
    "        ↓",
    "Experiment and evidence",
    "        ↓",
    "Hope (measurable target state)",
    "        ↓",
    "Action (smallest root-level fix)",
    "        ↓",
    "Feedback (rerun and compare)",
    "        ↺",
    "Love surrounds the loop as a safety and value constraint",
    "```",
    ""
  );

  return lines.join("\n") + "\n";
}

function buildChildSummary(layer, analysis) {
  const count = activeRootIds(analysis).length;
  const lines = [
    "# Faith, Hope, and Love — explain it to a child",
    "",
    "Imagine the CI system is a toy robot.",
    "",
    `- **Faith:** ${layer.principles.faith.child}`,
    `- **Hope:** ${layer.principles.hope.child}`,
    `- **Love:** ${layer.principles.love.child}`,
    "- **Action:** We open the first broken box instead of hitting every blinking light.",
    "- **Feedback:** We turn the robot on again and check whether the right lights became green.",
    ""
  ];

  if (count === 0) {
    lines.push("Today the robot has no active broken boxes. We still keep the map ready for the next red light.");
  } else {
    lines.push(`Today the map found **${count} real box${count === 1 ? "" : "es"}** to inspect first.`);
  }

  return lines.join("\n") + "\n";
}

async function writeReport(graph, layer, analysisFile, outputDir) {
  const analysis = await readJson(analysisFile);
  await mkdir(outputDir, { recursive: true });

  const ids = activeRootIds(analysis);
  const payload = {
    schemaVersion: 1,
    sourceAnalysis: path.relative(repositoryRoot, analysisFile),
    activeRootCauses: ids.length,
    principles: layer.principles,
    execution: layer.execution,
    activeContracts: ids.map((id) => ({ id, ...layer.rootContracts[id] }))
  };

  await Promise.all([
    writeFile(path.join(outputDir, "resilience.json"), JSON.stringify(payload, null, 2) + "\n", "utf8"),
    writeFile(path.join(outputDir, "resilience-summary.md"), buildMarkdown(graph, layer, analysis), "utf8"),
    writeFile(path.join(outputDir, "resilience-child-summary.md"), buildChildSummary(layer, analysis), "utf8"),
    writeFile(path.join(outputDir, "resilience-graph.mmd"), buildResilienceGraph(graph, layer, analysis), "utf8")
  ]);

  console.log(`Human resilience report written for ${ids.length} active root causes.`);
}

const command = process.argv[2] ?? "validate";
const graph = await readJson(graphFile);
const layer = validateHumanResilience(graph);

if (command === "validate") {
  console.log(
    `Human resilience contract valid: 3 principles, ${(graph.roots ?? []).length} root contracts, evidence remains authoritative.`
  );
} else if (command === "report") {
  const analysisFile = path.resolve(process.argv[3] ?? "results/causal-run/analysis.json");
  const outputDir = path.resolve(process.argv[4] ?? path.dirname(analysisFile));
  await writeReport(graph, layer, analysisFile, outputDir);
} else {
  throw new Error(`Unknown command: ${command}. Use validate or report.`);
}
