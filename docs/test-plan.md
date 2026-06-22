# Test plan

## Objective

Evaluate TypeScript 7.0 RC against TypeScript 6.0 using repeatable source fixtures and generated workloads. Separate compatibility defects from documented behavior changes and performance variance.

## Current scope

### Compatibility

- Compile the same valid project with both compilers.
- Compare diagnostic code sequences from intentionally invalid source files.
- Preserve raw compiler output for investigation.

### Performance

- Measure a fresh compiler process for every sample.
- Run one unreported warm-up before each scenario.
- Compare TypeScript 6 default behavior with TypeScript 7 default, single-threaded, and checker-count configurations.
- Report median, mean, minimum, maximum, and standard deviation.

### Environments

- Ubuntu, Windows, and macOS through GitHub Actions.
- Node.js 22 in CI.
- Local environments are allowed, but reports must include machine metadata.

## Out of scope for the first milestone

- Stable programmatic API compatibility.
- Language-server correctness and latency.
- Long-running watch-mode resource measurements.
- Project-reference builder combinations.
- Precise cross-platform peak-memory measurement.

These areas are planned after the baseline harness is stable.

## Defect policy

A suspected regression should only be reported upstream when:

1. It is not listed as an intentional change in TypeScript 7 documentation or `CHANGES.md`.
2. It reproduces consistently.
3. A minimal source fixture is available.
4. Exact compiler versions and environment details are recorded.
5. Expected and actual behavior are stated without speculation.
