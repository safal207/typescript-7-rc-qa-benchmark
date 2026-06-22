# TypeScript 7.0 RC QA Benchmark

Independent QA research comparing **TypeScript 6.0** and **TypeScript 7.0 RC** across compatibility, diagnostics, performance, parallelization, emit correctness, and CI environments.

> Status: the first baseline is published; benchmark V2 is under validation before upstream sharing.

## Published baseline

The 2026-06-22 baseline generated 1,500 TypeScript modules and measured every scenario 10 times on GitHub-hosted Ubuntu, Windows, and macOS runners.

- TypeScript 7.0.1 RC default was **5.58x–6.16x faster** than TypeScript 6.0.3 by median wall-clock duration.
- The tested diagnostic codes and normalized diagnostic content matched on all three operating systems.
- On Windows, TS6 emitted CRLF diagnostic line endings while TS7 RC emitted LF.
- A known CLI exit-status difference reproduced consistently and is tracked in [issue #2](../../issues/2).

Read the first [cross-platform benchmark report](docs/results/2026-06-22-full-benchmark.md).

## Benchmark V2

V2 strengthens the evidence with five independent suites:

1. many-small-files type checking;
2. mapped, conditional, recursive, and template-literal type checking;
3. JavaScript emit;
4. declaration-only emit;
5. clean project-reference builds with configurable TypeScript 7 builders.

The runner interleaves scenarios in a deterministic randomized order. It reports median, P90, P95, standard deviation, coefficient of variation, median absolute deviation, IQR outliers, and a non-parametric 95% bootstrap confidence interval for every median. Outliers are reported but never removed.

Correctness is checked separately by comparing normalized SHA-256 output trees for JavaScript, declarations, and project-reference builds. CRLF is normalized to LF, while raw files and machine-readable reports remain available as workflow artifacts.

See [Benchmark V2 methodology](docs/benchmark-methodology-v2.md).

## Quick start

```bash
npm install
npm run qa
```

The command generates all workloads, validates both compilers, compares diagnostics, runs the statistical benchmark, verifies emitted output, and writes reports to `results/`.

## Useful commands

```bash
npm run versions
npm run generate
npm run typecheck:ts6
npm run typecheck:ts7
npm run typecheck:heavy:ts6
npm run typecheck:heavy:ts7
npm run compare:diagnostics
npm run benchmark
npm run verify:outputs
```

A stronger local run:

```bash
GENERATED_MODULES=1500 \
TYPE_HEAVY_FILES=120 \
PROJECT_PACKAGES=12 \
PROJECT_FILES_PER_PACKAGE=60 \
BENCHMARK_RUNS=15 \
BENCHMARK_WARMUPS=2 \
BOOTSTRAP_RESAMPLES=2000 \
npm run qa
```

GitHub Actions runs a smaller smoke profile for pull requests and exposes a configurable full evidence profile through `workflow_dispatch`.

## Methodology principles

- Identical source trees and explicit compiler configurations.
- Multiple workloads to avoid overfitting conclusions to one synthetic shape.
- Fresh compiler process for every measurement.
- Setup and output cleanup excluded from the measured interval.
- Deterministic randomized interleaving to reduce ordering and thermal bias.
- Raw samples preserved; no outlier deletion.
- Output correctness evaluated independently from speed.
- Suspected regressions checked against documented changes and existing upstream issues.

## Official references

- [Announcing TypeScript 7.0 RC](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/)
- [microsoft/typescript-go](https://github.com/microsoft/typescript-go)
- [TypeScript 7 differences from TypeScript 6](https://github.com/microsoft/typescript-go/blob/main/CHANGES.md)

## License

MIT
