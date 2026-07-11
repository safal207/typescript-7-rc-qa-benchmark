# Faith, Hope, and Love as an engineering resilience layer

## Purpose

This layer adds human meaning and safety to the permanent CI causal graph without weakening technical truth.

It does **not** change test status, suppress evidence, approve a pull request, or turn a failing check green.

It answers three additional questions after the causal graph identifies a root cause:

1. **Faith:** what assumption makes the next experiment worth running?
2. **Hope:** what measurable healthy state are we trying to reach?
3. **Love:** who or what must not be harmed while we fix the system?

Engineering aliases are used alongside the human names:

| Principle | Engineering role | Main question |
|---|---|---|
| Faith | Assumption contract | What do we treat as possible enough to test? |
| Hope | Target-state contract | What does a healthy future state look like? |
| Love | Care and safety constraint | Who or what must not be harmed while we fix it? |

## Boundaries

### Faith is not permission to ignore evidence

Faith starts an experiment:

```text
This system can become more trustworthy
        ↓
run a bounded test
        ↓
collect evidence
        ↓
keep, revise, or reject the assumption
```

The healthy formula is:

> Faith starts the experiment; data corrects faith.

### Hope is not a vague wish

Hope defines a measurable target state and a next step:

```text
current state
    ↓
observable gap
    ↓
root-level action
    ↓
rerun affected signals
    ↓
measurable green state
```

The healthy formula is:

> Hope is a future state converted into a route.

### Love is not permission to weaken discipline

Love constrains how the system reaches green:

- do not hide raw failures;
- do not blame a person for a system defect;
- do not waste effort fixing downstream symptoms first;
- do not force production users to install benchmark-only tools;
- do not publish persuasive claims from ambiguous evidence;
- do not trade safety or truth for a green badge.

The healthy formula is:

> Love is the optimization constraint that keeps the system useful to people.

## Complete execution loop

```text
Faith = testable assumption
        ↓
Experiment = CI execution
        ↓
Evidence = observed signals
        ↓
Hope = measurable target state
        ↓
Action = smallest root-level fix
        ↓
Feedback = rerun and compare immutable evidence
        ↺
Love surrounds the loop as a value and safety constraint
```

## Root contracts

Every root cause in [`config/ci-causal-graph.json`](../config/ci-causal-graph.json) must define all three fields.

### Dependency resolution

- **Faith:** a committed dependency graph can reproduce the same reviewed toolchain.
- **Hope:** all supported runners install the same graph and produce comparable evidence.
- **Love:** preserve logs, avoid blind retries, and do not waste compute on downstream work before installation is fixed.

### Compiler identity

- **Faith:** compiler identity can be verified before measurement.
- **Hope:** every label executes the intended exact compiler version.
- **Love:** fail closed rather than publish a convincing but false speedup.

### Install lifecycle

- **Faith:** production installation and benchmark QA can be separate explicit contracts.
- **Hope:** `--omit=dev` succeeds while explicit QA refuses to fake confidence without its toolchain.
- **Love:** do not burden production users with benchmark dependencies and do not weaken QA for convenience.

### Evidence generation

- **Faith:** a failed evidence pipeline can be repaired and rerun deterministically.
- **Hope:** checks complete, parity is measured, and artifacts are preserved.
- **Love:** raw failures and outliers remain visible; summaries and retries must not hide the original signal.

### Evidence provenance

- **Faith:** every claim can be tied to immutable evidence identities.
- **Hope:** a reader can trace a conclusion to the exact commit, run, artifact, and finding.
- **Love:** do not overstate results or let mutable documentation rewrite history.

## CI enforcement

`scripts/ci-human-resilience.mjs` validates that:

- Faith, Hope, and Love are all defined;
- each principle has an engineering role, question, global rule, and child explanation;
- every technical root has all three contracts;
- no contract points to an unknown root;
- action and feedback rules are present.

CI generates:

- `resilience.json` — machine-readable contract output;
- `resilience-summary.md` — engineering explanation;
- `resilience-child-summary.md` — child-friendly explanation;
- `resilience-graph.mmd` — Mermaid system loop.

These files are produced for:

- the live stable CI run;
- the permanent A/B failure fixture;
- every checker-scaling operating-system job.

## Explain it to a child

Imagine CI is a toy robot.

- **Faith:** “The robot can probably be fixed, so let us test one idea.”
- **Hope:** “We know which lights should become green.”
- **Love:** “We will not hit the robot, blame the child, or paint a red light green.”
- **Action:** “Open the first broken box.”
- **Feedback:** “Turn the robot on again and see what changed.”

Without action this is philosophy.

With evidence, action, and feedback it becomes an engineering architecture for sustainable work.
