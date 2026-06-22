# TypeScript 7.0 RC QA Benchmark

Independent QA research comparing **TypeScript 6.0** and **TypeScript 7.0 RC** across compatibility, diagnostics, performance, parallelization, and CI environments.

> Status: test harness is being built. No benchmark results have been published yet.

## Research questions

1. Does TypeScript 7.0 RC produce compatible type-checking results for the same source code?
2. How much faster is the native Go compiler on a repeatable generated workload?
3. How do checker counts affect execution time and memory usage?
4. Are results consistent across Linux, Windows, and macOS?
5. Can we isolate reproducible regressions suitable for the TypeScript issue tracker?

## Quick start

```bash
npm install
npm run qa
```

The command generates a deterministic TypeScript workload, checks valid fixtures with both compilers, compares diagnostic codes for intentionally invalid fixtures, and writes benchmark reports to `results/`.

## Useful commands

```bash
npm run versions
npm run generate
npm run typecheck:ts6
npm run typecheck:ts7
npm run compare:diagnostics
npm run benchmark
```

Set the number of benchmark runs or generated modules with environment variables:

```bash
BENCHMARK_RUNS=10 GENERATED_MODULES=1500 npm run qa
```

PowerShell:

```powershell
$env:BENCHMARK_RUNS=10
$env:GENERATED_MODULES=1500
npm run qa
```

## Methodology principles

- Same source tree and explicit compiler configuration for both versions.
- Deterministic generated workload.
- Warm-up runs excluded from reported measurements.
- Raw machine-readable results preserved as JSON.
- Median reported alongside mean, minimum, maximum, and standard deviation.
- Compatibility findings separated from intentional TypeScript 6.0/7.0 behavior changes.
- Suspected regressions require a minimal reproduction before being reported upstream.

## Official references

- [Announcing TypeScript 7.0 RC](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/)
- [microsoft/typescript-go](https://github.com/microsoft/typescript-go)
- [TypeScript 7 differences from TypeScript 6](https://github.com/microsoft/typescript-go/blob/main/CHANGES.md)

## License

MIT
