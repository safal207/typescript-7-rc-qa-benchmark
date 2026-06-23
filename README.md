# TypeScript 7.0 RC QA Benchmark

Independent QA research comparing **TypeScript 6.0** and **TypeScript 7.0 RC** across compatibility, diagnostics, performance, parallelization, emit correctness, real-world declaration dependencies, and CI environments.

> Status: benchmark V2 is complete and validated. Benchmark V2.1 adds a pinned `type-fest@5.7.0` consumer suite and is being validated separately before its results are published.

## Benchmark V2 result

The 2026-06-22 evidence run tested TypeScript 6.0.3 and TypeScript 7.0.1 RC on GitHub-hosted Ubuntu, Windows, and macOS runners using five generated workloads, 2 warm-up rounds, and 15 measured rounds per scenario.

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

The harness now contains six independent suites:

1. many-small-files type checking;
2. mapped, conditional, recursive, and template-literal type checking;
3. JavaScript emit;
4. declaration-only emit;
5. clean project-reference builds over independent leaf projects and one aggregator;
6. a pinned `type-fest@5.7.0` declaration-consumer workload.

The runners interleave scenarios in a deterministic randomized order. They report median, P90, P95, standard deviation, coefficient of variation, median absolute deviation, IQR outliers, and a non-parametric 95% bootstrap confidence interval for every median. Outliers are reported but never removed.

Correctness is checked separately by comparing normalized SHA-256 output trees for JavaScript, declarations, and project-reference builds. CRLF is normalized to LF, while raw files and machine-readable reports remain available as workflow artifacts.

## Quick start

```bash
npm install
npm run qa
```

The command generates all workloads, verifies the pinned real-world dependency, validates both compilers, compares diagnostics, collects extended diagnostics, runs the statistical benchmarks, verifies emitted output, and writes reports to `results/`.

## Useful commands

```bash
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
npm run benchmark:real-world
npm run verify:outputs
```

A full local V2.1 evidence run:

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

GitHub Actions runs a smaller smoke profile for pull requests and exposes a configurable full evidence profile through `workflow_dispatch`. Superseded runs are cancelled automatically.

## Methodology principles

- Identical source trees and explicit compiler configurations.
- Multiple workloads to avoid overfitting conclusions to one generated shape.
- Exact dependency version pinning for the real-world declaration suite.
- Fresh compiler process for every measurement.
- Setup and output cleanup excluded from the measured interval.
- Deterministic randomized interleaving to reduce ordering and thermal bias.
- Raw samples preserved; no outlier deletion.
- Output correctness evaluated independently from speed.
- Compiler-reported memory treated as supplementary rather than OS-equivalent measurement.
- Suspected regressions checked against documented changes and existing upstream issues.

## Official references

- [Announcing TypeScript 7.0 RC](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/)
- [microsoft/typescript-go](https://github.com/microsoft/typescript-go)
- [TypeScript 7 differences from TypeScript 6](https://github.com/microsoft/typescript-go/blob/main/CHANGES.md)
- [type-fest](https://github.com/sindresorhus/type-fest)

## License

MIT
