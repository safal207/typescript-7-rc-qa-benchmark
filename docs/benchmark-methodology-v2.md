# Benchmark V2.1 methodology

## Objective

Measure TypeScript 6.0 and TypeScript 7.0 RC across several compiler workloads while keeping correctness checks separate from performance measurements. The benchmark is designed to produce reproducible evidence, not a universal speed claim.

## Workloads

### Many small files

A generated project contains independent modules with interfaces, mapped types, generic normalization functions, runtime values, and one index module importing every value. This emphasizes parsing, binding, module traversal, type checking, and process startup across a broad source tree.

### Type-heavy files

Generated files use mapped types, conditional types, recursive tuple construction, template-literal keys, deep readonly transformations, key remapping, and union-to-intersection conversion. This increases checker work without depending on third-party packages.

### Real-world declaration dependency

The V2.1 suite installs the exact npm release `type-fest@5.7.0` and verifies that version before generating any consumers. Deterministic consumer modules import and instantiate maintained public utility types including deep transforms, path extraction, package-aware type exports, conditional picks, union conversion, and template-property conversions.

This suite exercises real third-party declarations, npm package resolution, and NodeNext module resolution. The generated consumers ensure a repeatable workload size, but they are not the upstream package's complete source repository or test suite. Results must therefore be described as a **real-world dependency consumer benchmark**.

### JavaScript emit

The many-file project is compiled to JavaScript. Output directories are deleted before each process outside the measured interval.

### Declaration-only emit

The same source project is compiled with `declaration` and `emitDeclarationOnly`. Output cleanup happens before the timer starts.

### Project references

A generated star-shaped composite graph contains independent leaf libraries and one aggregator project referencing every leaf. The graph is rebuilt from a clean state with `--force`, giving parallel builders genuine independent work. TypeScript 6 is the baseline. TypeScript 7 is measured with its default builder configuration and explicit `--builders 1`, `2`, and `4` values.

## Dependency pinning

The real-world workload uses an exact package version rather than a semver range. The generator reads `node_modules/type-fest/package.json` and fails unless the installed version is exactly `5.7.0`. The generated metadata records the package name, package version, upstream repository, release tag, license, consumer-file count, and imported public types.

The npm release is the executable input to this benchmark. A future full-repository benchmark should additionally pin an immutable upstream commit SHA and record its dependency lockfile.

## Measurement protocol

1. Every sample starts a fresh compiler process.
2. Each scenario receives the same number of warm-up and measured executions.
3. Scenarios are interleaved by measured round rather than executed in one large block.
4. The order inside every round is shuffled by a deterministic seeded pseudo-random generator.
5. Workload generation and output cleanup are excluded from compiler process duration.
6. Filesystem caches are not deliberately flushed; results are warm-filesystem process measurements.
7. All raw samples and the exact scenario order are preserved in JSON.
8. The real-world dependency benchmark is written to its own JSON and Markdown reports so it cannot silently alter the already published V2 synthetic evidence.

## Reported statistics

For each scenario the harness reports:

- arithmetic mean;
- median;
- minimum and maximum;
- P90 and P95;
- population standard deviation;
- coefficient of variation;
- median absolute deviation;
- IQR outlier count;
- non-parametric 95% bootstrap confidence interval for the median;
- speedup calculated from the TypeScript 6 median in the same suite.

IQR outliers are reported but never discarded. Bootstrap resampling and scenario randomization both use recorded deterministic seeds.

## Correctness verification

Performance results are accepted only alongside separate output verification:

1. TypeScript 6 and TypeScript 7 compile into separate directories.
2. Every output file path is recorded.
3. CRLF is normalized to LF to avoid treating platform newline conventions as semantic differences.
4. Every normalized file receives a SHA-256 digest.
5. Aggregate output-tree hashes are calculated from sorted paths and file hashes.
6. JavaScript emit, declaration-only emit, and project-reference outputs are compared.
7. `.tsbuildinfo` files are excluded because they are compiler implementation metadata rather than distributable program output.
8. Strict CI fails when output files are missing, added, or changed.
9. The real-world suite is type-check-only; compatibility is established by requiring both compilers to complete successfully against the identical generated consumers and installed declarations.

Raw output trees are retained in workflow artifacts for manual investigation.

## Diagnostic compatibility

An intentionally invalid fixture is compiled by both versions. The harness records diagnostic codes, full raw text, normalized text compatibility, and process exit status separately. This prevents an exit-code difference or newline difference from being incorrectly described as a type-system difference.

## Extended diagnostics

The harness additionally saves each compiler's `--extendedDiagnostics` output for the many-file, type-heavy, and project-reference workloads. These numbers are supplementary only: the JavaScript and Go compilers may define or collect metrics differently, so compiler-reported memory and phase timings are not assumed to be equivalent OS-level measurements.

## Cross-platform execution

The same repository commit is tested using Node.js 22 on GitHub-hosted Ubuntu, Windows, and macOS runners. Each report records:

- operating system and architecture;
- CPU model and logical CPU count;
- total reported system memory;
- Node.js version;
- exact TypeScript 6 and TypeScript 7 versions;
- generated workload dimensions;
- pinned dependency metadata;
- benchmark configuration and random seed.

## Interpretation rules

- Do not generalize a generated or dependency-consumer result to all TypeScript projects.
- Prefer medians and confidence intervals over a single fastest run.
- Treat high coefficients of variation or wide confidence intervals as unstable evidence.
- Do not claim output compatibility beyond the tested fixtures.
- Do not compare compiler-provided memory metrics as though they were measured identically unless their implementations are verified.
- Describe the `type-fest` suite as a pinned dependency-consumer benchmark, not a full upstream-repository benchmark.
- Run at least one complete pinned real-world repository before making broad migration recommendations.

## Remaining limitations

- Shared CI runners can experience scheduling noise.
- Filesystem caches are warm.
- Peak process-tree RSS is not yet measured independently by the operating system.
- Watch-mode edit latency and language-server behavior require separate long-running harnesses.
- The generated workloads do not represent every module-resolution pattern, third-party declaration package, JSX framework, or JSDoc codebase.
- The V2.1 real-world suite compiles generated consumers against a real package; it does not execute the package's own tests or compile its complete repository checkout.
