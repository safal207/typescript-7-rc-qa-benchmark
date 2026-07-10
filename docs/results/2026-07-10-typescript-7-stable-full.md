# TypeScript 7.0.2 stable — full cross-platform evidence

- Date: 2026-07-10
- Compared compilers: TypeScript 6.0.3 (`tsc6`) and TypeScript 7.0.2 (`tsc`)
- Workflow run: `29120482675`
- Commit: `0622e687d494ddb68244068d470d00fa45ad37aa`
- Result: Ubuntu, Windows, and macOS full-profile jobs passed

## Executive result

TypeScript 7.0.2 reproduced substantial cross-platform gains on every measured workload. Across the six suites, default TypeScript 7 median speedups ranged from **4.51× to 6.18×** against the pinned classic TypeScript 6.0.3 baseline.

Normalized output trees matched on every operating system for 1,501 JavaScript files, 1,501 declaration files, and 1,464 project-reference outputs. Diagnostic codes and normalized diagnostic text also matched.

The known CLI compatibility difference remains present in the stable release: the same `--noEmit` diagnostic scenario returns exit code `2` in TypeScript 6.0.3 and exit code `1` in TypeScript 7.0.2 on Ubuntu, Windows, and macOS.

## Methodology

- 1,500 generated modules
- 120 type-heavy files
- 64 generated consumers of pinned `type-fest@5.7.0` declarations
- 12 project-reference packages with 60 modules plus an index per package
- 2 warm-up rounds per scenario
- 15 measured rounds per scenario
- deterministic randomized interleaving, seed `20260710`
- fresh compiler process for every measurement
- 2,000 non-parametric bootstrap resamples for median confidence intervals
- IQR outliers reported and retained
- setup and output cleanup outside the measured interval
- compiler command selection verified before evidence collection

## Median speedup versus TypeScript 6.0.3

| Workload | Ubuntu | Windows | macOS | Cross-platform range |
|---|---:|---:|---:|---:|
| Many small files: type check | 6.14× | 5.34× | 5.20× | **5.20×–6.14×** |
| Type-heavy checking | 5.87× | 4.96× | 4.78× | **4.78×–5.87×** |
| JavaScript emit | 6.18× | 4.60× | 5.27× | **4.60×–6.18×** |
| Declaration-only emit | 6.08× | 4.51× | 4.98× | **4.51×–6.08×** |
| Clean project-reference build | 5.58× | 5.29× | 6.06× | **5.29×–6.06×** |
| Pinned `type-fest@5.7.0` consumers | 5.54× | 4.95× | 5.40× | **4.95×–5.54×** |

## TypeScript 7.0.2 median duration

| Workload | Ubuntu | Windows | macOS |
|---|---:|---:|---:|
| Many small files: type check | 512.24 ms | 534.37 ms | 282.63 ms |
| Type-heavy checking | 430.63 ms | 454.95 ms | 252.43 ms |
| JavaScript emit | 606.60 ms | 771.28 ms | 403.80 ms |
| Declaration-only emit | 611.13 ms | 781.80 ms | 428.73 ms |
| Clean project-reference build | 1814.38 ms | 1745.89 ms | 1647.06 ms |
| Pinned `type-fest@5.7.0` consumers | 1164.28 ms | 1114.14 ms | 968.24 ms |

## Stable versus preserved RC evidence

| Workload | TypeScript 7.0.1 RC range | TypeScript 7.0.2 stable range |
|---|---:|---:|
| Many small files: type check | 5.57×–6.31× | 5.20×–6.14× |
| Type-heavy checking | 4.98×–6.05× | 4.78×–5.87× |
| JavaScript emit | 4.59×–6.40× | 4.60×–6.18× |
| Declaration-only emit | 4.58×–6.51× | 4.51×–6.08× |
| Clean project-reference build | 4.66×–6.20× | 5.29×–6.06× |

The RC and stable runs used the same workload model and statistical protocol, but GitHub-hosted runner hardware and images can change over time. The comparison therefore supports consistency of the performance class, not a paired claim that stable is faster or slower than RC.

## Correctness and compatibility

| Check | Ubuntu | Windows | macOS |
|---|---:|---:|---:|
| Compiler selection (`tsc6=6.0.3`, `tsc=7.0.2`) | PASS | PASS | PASS |
| Diagnostic codes | MATCH | MATCH | MATCH |
| Diagnostic text after CRLF/LF normalization | MATCH | MATCH | MATCH |
| `--noEmit` exit code | `2` vs `1` | `2` vs `1` | `2` vs `1` |
| JavaScript output: 1,501 files | MATCH | MATCH | MATCH |
| Declaration output: 1,501 files | MATCH | MATCH | MATCH |
| Project-reference output: 1,464 files | MATCH | MATCH | MATCH |

`.tsbuildinfo` files are excluded as compiler implementation metadata. Text output is normalized from CRLF to LF before SHA-256 comparison.

## Variability notes

- Ubuntu was the most stable environment; TypeScript 7 CV values were approximately 1.1%–2.7% across the six suites.
- Windows project-reference and real-world dependency runs were noisier, with CV values of 13.4% and 11.0%.
- macOS project-reference and real-world dependency runs were noisier, with CV values of 19.5% and 14.2%.
- These samples remain in the report. No outlier was removed.

## Evidence artifacts

- Ubuntu: artifact `8238612637`, SHA-256 digest `07b7b981badca47da9dc4a80b9b9de8248fafb91d6a611fed24428c26844595f`
- Windows: artifact `8238611050`, SHA-256 digest `424c464b5a725fecc9a97ff48b2a3c1c76b733f324c7702637947954bdbb1e2e`
- macOS: artifact `8238542656`, SHA-256 digest `2a321ffd414bfb50305975c70545edb0f58b350d04e7f8f9c89b8da1335efbcf`

Each artifact includes raw sample arrays, randomized execution order, environment metadata, diagnostics, extended diagnostics, emitted outputs, normalized output hashes, and Markdown summaries.

## Decision

The stable package passes this repository's performance and output-correctness gate for the tested workloads. It does **not** yet pass full CLI parity because the `--noEmit` exit-status mismatch remains reproducible. That difference continues to matter for CI pipelines, shell automation, and wrappers that depend on classic `tsc` process status.

Upstream tracking: [microsoft/typescript-go#1493](https://github.com/microsoft/typescript-go/issues/1493) and [PR #4407](https://github.com/microsoft/typescript-go/pull/4407).
