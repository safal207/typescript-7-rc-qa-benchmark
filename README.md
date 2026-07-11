# TypeScript 7 QA Benchmark

Independent QA research comparing **classic TypeScript 6.0** with the native Go-based **TypeScript 7.0** compiler across compatibility, diagnostics, performance, parallelization, emit correctness, real-world declaration dependencies, and CI environments.

> Current phase: TypeScript 7.0 stable validation. Historical RC reports remain preserved as the evidence baseline and are not relabelled as stable results.

## Stable validation

The stable branch pins and locks:

- `typescript@7.0.2`;
- `@typescript/typescript6@6.0.2`, exposing the classic TypeScript 6.0.3 compiler as `tsc6`;
- `@typescript/old` explicitly to `typescript@6.0.3`;
- `type-fest@5.7.0`;
- the complete npm dependency graph through `package-lock.json`.

Evidence workflows use `npm ci`. A compiler-selection preflight guards against npm bin-link collisions: when stable and classic packages are installed together, the root `.bin/tsc` command can otherwise resolve to the classic compiler. The guard recreates the stable `tsc` shim and fails unless `tsc` selects TypeScript 7 while `tsc6` selects the classic TypeScript 6 baseline.

Production-only installs are also supported: `npm ci --omit=dev` skips shim repair because the benchmark toolchain is absent, while an explicit QA verification still fails closed.

Read the [stable validation contract](docs/stable-validation-2026-07.md), the [full stable evidence report](docs/results/2026-07-10-typescript-7-stable-full.md), and the [three-reviewer causal adjudication](docs/review-council-2026-07-10.md).

## Permanent CI causal graph

CI now maintains a deterministic causal graph that converts separate red checks into:

```text
visible alarm -> root cause -> consequence -> first fix
```

Every stable QA runner records locked installation, compiler identity, QA completion, and report-artifact signals. The production-install job records omit-dev installation and the fail-closed safety contract. Checker-scaling records its own installation, compiler identity, and benchmark signals.

The final causal job always runs and publishes two views:

- **without graph:** every failed or skipped check appears as a separate alarm;
- **with graph:** downstream alarms are suppressed and grouped under the first actionable cause.

A permanent A/B fixture protects the behavior: **11 alarms must collapse to 5 root causes**, saving 6 separate questions and reducing explanation noise by **55%**. CI fails if that comparison changes unexpectedly.

The generated job summary also explains the result using a toy-robot analogy so a child can understand which box should be opened first.

Read the [permanent CI causal graph contract](docs/ci-causal-graph.md).

## TypeScript 7.0.2 stable result

The 2026-07-10 full evidence run used 2 warm-ups and 15 measured randomized rounds per scenario on GitHub-hosted Ubuntu, Windows, and macOS runners.

- Many-small-files checking: **5.20×–6.14× faster**.
- Type-heavy checking: **4.78×–5.87× faster**.
- JavaScript emit: **4.60×–6.18× faster**.
- Declaration-only emit: **4.51×–6.08× faster**.
- Clean project-reference builds: **5.29×–6.06× faster**.
- Pinned `type-fest@5.7.0` consumers: **4.95×–5.54× faster**.
- Normalized output hashes matched for 1,501 JavaScript files, 1,501 declaration files, and 1,464 project-reference files on every operating system.
- The known `--noEmit` CLI difference remained: TypeScript 6.0.3 returned `2`, TypeScript 7.0.2 returned `1` with matching diagnostic codes and normalized text.

The defensible aggregate claim is **4.51×–6.18× faster for the documented workloads and protocol**, not a universal speed guarantee.

## Historical Benchmark V2 result

The 2026-06-22 RC evidence run tested TypeScript 6.0.3 and TypeScript 7.0.1 RC on GitHub-hosted Ubuntu, Windows, and macOS runners using five generated workloads, 2 warm-up rounds, and 15 measured rounds per scenario.

- Many-small-files checking: **5.57×–6.31× faster** with TS7 default.
- Type-heavy checking: **4.98×–6.05× faster**.
- JavaScript emit: **4.59×–6.40× faster**.
- Declaration-only emit: **4.58×–6.51× faster**.
- Clean project-reference builds: **4.66×–6.20× faster**.
- Normalized output hashes matched for 1,501 JavaScript files, 1,501 declaration files, and 1,464 project-reference files on every operating system.
- The known CLI exit-status difference reproduced consistently and remains tracked in [issue #2](../../issues/2).

Read the full [Benchmark V2 evidence report](docs/results/2026-06-22-benchmark-v2-full.md) and the [V2.1 methodology](docs/benchmark-methodology-v2.md).

The earlier, simpler baseline remains available in the [first cross-platform report](docs/results/2026-06-22-full-benchmark.md).

## Benchmark V2.1 addition

V2.1 adds a real-world declaration dependency suite using the exact npm release `type-fest@5.7.0`. The harness generates deterministic consumer modules that instantiate public utility types from the installed package and compiles them with both compilers under the same fresh-process, randomized-round protocol.

This strengthens the evidence by exercising maintained third-party declarations and NodeNext package resolution. It is intentionally described as a **real-world dependency consumer benchmark**, not as a benchmark of the complete upstream `type-fest` repository or its test suite.

## Evidence model

The harness contains six independent suites:

1. many-small-files type checking;
2. mapped, conditional, recursive, and template-literal type checking;
3. JavaScript emit;
4. declaration-only emit;
5. clean project-reference builds over independent leaf projects and one aggregator;
6. a pinned `type-fest@5.7.0` declaration-consumer workload.

The runners interleave scenarios in a deterministic randomized order. They report median, P90, P95, standard deviation, coefficient of variation, median absolute deviation, IQR outliers, and a non-parametric 95% bootstrap confidence interval for every median. Outliers are reported but never removed.

Correctness is checked separately by comparing normalized SHA-256 output trees for JavaScript, declarations, and project-reference builds. CRLF is normalized to LF, while raw files and machine-readable reports remain available as workflow artifacts.

Checker scaling is evaluated by a separate cross-platform workflow. Its claims are not inferred from the main `qa` command; the stable three-OS evidence is Actions run `29121518759`.

## Quick start

```bash
npm ci
npm run qa
```

The locked installation repairs and verifies compiler command shims. The QA command then generates all workloads, validates both compilers, compares diagnostics, collects extended diagnostics, runs the statistical benchmarks, verifies emitted output, and writes reports to `results/`.

## Useful commands

```bash
npm run verify:compiler-selection
npm run versions
npm run generate
npm run generate:real-world
npm run typecheck:ts6
npm run typecheck:ts7
npm run typecheck:heavy:ts6
npm run typecheck:heavy:ts7
npm run typecheck:real-world:ts6
npm run typecheck:real-world:ts7
npm run compare:diagnostics
npm run collect:extended-diagnostics
npm run benchmark
npm run benchmark:checkers
npm run benchmark:real-world
npm run verify:outputs
npm run causal:validate
npm run causal:compare
```

A full stable evidence run:

```bash
GENERATED_MODULES=1500 \
TYPE_HEAVY_FILES=120 \
REAL_WORLD_FILES=64 \
PROJECT_PACKAGES=12 \
PROJECT_FILES_PER_PACKAGE=60 \
BENCHMARK_RUNS=15 \
BENCHMARK_WARMUPS=2 \
BOOTSTRAP_RESAMPLES=2000 \
npm run qa
```

GitHub Actions runs a smaller stable smoke profile for pull requests and exposes a configurable full evidence profile through `workflow_dispatch`. Superseded runs are cancelled automatically.

## Methodology principles

- Identical source trees and explicit compiler configurations.
- Exact direct pins plus a committed transitive dependency lock.
- `npm ci` for evidence workflows.
- Verified compiler-command selection before collecting evidence.
- Separate production-only installation and strict QA-verification contracts.
- Deterministic causal mapping from CI signals to root causes, consequences, and first fixes.
- A permanent A/B fixture proving that the causal view reduces noise.
- Multiple workloads to avoid overfitting conclusions to one generated shape.
- Fresh compiler process for every measurement.
- Setup and output cleanup excluded from the measured interval.
- Deterministic randomized interleaving to reduce ordering and thermal bias.
- Raw samples preserved; no outlier deletion.
- Output correctness evaluated independently from speed.
- Compiler-reported memory treated as supplementary rather than OS-equivalent measurement.
- Suspected regressions checked against documented changes and existing upstream issues.
- Historical RC evidence preserved separately from stable-release evidence.

## Official references

- [Announcing TypeScript 7.0 RC](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/)
- [microsoft/typescript-go](https://github.com/microsoft/typescript-go)
- [TypeScript 7 differences from TypeScript 6](https://github.com/microsoft/typescript-go/blob/main/CHANGES.md)
- [type-fest](https://github.com/sindresorhus/type-fest)

## License

MIT
