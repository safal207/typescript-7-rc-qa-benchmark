# Permanent CI causal graph

## What it does

The CI causal graph turns separate job failures into an ordered explanation:

```text
visible alarm -> root cause -> consequence -> first fix
```

It is deterministic. It does not call an AI model and it does not guess from log prose. Workflows emit small versioned JSON signal files, and the graph maps each known signal to a reviewed root cause in [`config/ci-causal-graph.json`](../config/ci-causal-graph.json).

## Why it exists

Ordinary CI often shows many red checks at once. Some are only downstream effects:

```text
npm ci failed
  -> compiler verification was skipped
  -> QA was skipped
  -> reports were missing
```

Without a causal graph, those can look like four independent problems. With the graph, the three downstream alarms are marked as blocked and the first action is the locked installation failure.

## Explain it to a child

Imagine a toy robot with eleven blinking red lights.

Without a map, we may try to repair all eleven lights.

With the map, we open five real boxes inside the robot. Four lights are only red because an earlier box has no power. Fixing the first broken box can make several lights green together.

## Permanent CI flow

### Stable QA workflow

Each Ubuntu, Windows, and macOS job records:

- locked `npm ci` installation;
- compiler identity verification;
- stable QA completion;
- presence of machine-readable evidence artifacts.

The production-install job records:

- `npm ci --omit=dev` installation;
- the explicit QA fail-closed safety contract.

The final `causal-graph` job always runs, even when an earlier job fails. It:

1. validates the graph schema and references;
2. runs the permanent A/B comparison fixture;
3. downloads all available signal artifacts;
4. detects missing expected contexts;
5. produces baseline and causal explanations;
6. writes the child-friendly summary to the GitHub Actions job summary;
7. uploads the complete causal report for 90 days.

### Checker-scaling workflow

Every operating system records:

- locked installation;
- compiler identity verification;
- checker-scaling benchmark completion.

Each matrix job creates its own causal report and child-friendly summary.

## Permanent A/B contract

[`fixtures/ci-causal-comparison.json`](../fixtures/ci-causal-comparison.json) contains a reviewed failure story based on the TypeScript 7 stable review council.

Expected and first validated result:

| View | What the reader sees |
|---|---:|
| Without graph | 11 separate alarms |
| With graph | 5 actionable root causes |
| Downstream alarms suppressed | 4 |
| Separate questions saved | 6 |
| Noise reduction | 55% |

The first permanent validation completed in stable QA run `29139225752`. The live run collected 14 checks across Ubuntu, Windows, macOS, and the production-only contract; all 14 passed and the graph reported zero active root causes. The permanent A/B fixture matched every expected value exactly.

Evidence artifact:

- artifact `8244612806`;
- digest `sha256:6a2b7eb79075d867f3ca0ede13f3aa727836b133d9c31dd0831458bd372d2cf7`;
- retained for 90 days.

CI fails if the fixture values change unexpectedly. This prevents the graph from becoming decorative documentation that no longer reduces noise.

## Generated files

The permanent A/B job writes:

- `results/causal-comparison/without-graph.md`;
- `results/causal-comparison/with-graph.md`;
- `results/causal-comparison/child-summary.md`;
- `results/causal-comparison/graph.mmd`;
- `results/causal-comparison/comparison.json`;
- `results/causal-comparison/analysis.json`.

The live run writes the same report shape under `results/causal-run/`.

Checker-scaling writes its local report under `results/causal-checker/`.

## Commands

```bash
npm run causal:validate
npm run causal:compare
node scripts/ci-causal-graph.mjs report causal-input results/causal-run
```

## Safety rules

- Unknown signal IDs fail validation instead of being silently ignored.
- Missing root, consequence, or fix references fail validation.
- Downstream alarms are suppressed only when their declared blocker failed in the same CI context.
- A green run still validates the graph contract.
- The graph explains evidence; it does not approve or merge a pull request.
- New CI checks that affect release confidence must add a reviewed signal-to-root mapping.
