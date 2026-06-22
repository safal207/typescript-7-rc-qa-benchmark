# TypeScript 7.0 RC cross-platform benchmark

**Date:** 2026-06-22  
**Workflow run:** `27981951512`  
**Pull request:** #1  
**Compilers:** TypeScript 6.0.3 and TypeScript 7.0.1-rc  
**Node.js:** 22.22.3

## Executive summary

TypeScript 7.0 RC completed the same valid 1,500-module generated workload successfully on Ubuntu, Windows, and macOS. Its default type-checking process was between **5.58x and 6.16x faster** than TypeScript 6.0.3 by median wall-clock duration on the tested GitHub-hosted runners.

The intentionally invalid fixture produced identical diagnostic codes and text in both compilers on all three operating systems. A CLI exit-status difference was consistently observed: TypeScript 6 returned `2`, while TypeScript 7 RC returned `1` for the same `--noEmit` diagnostic run. This matches previously reported upstream behavior and is tracked locally in #2 rather than being filed as a duplicate.

## Method

- Deterministic generation of 1,500 TypeScript modules.
- Identical explicit `tsconfig.json` for both compilers.
- One unreported warm-up process per scenario.
- Ten measured fresh compiler processes per scenario.
- Warm-filesystem wall-clock process duration.
- Median, mean, minimum, maximum, and standard deviation preserved in workflow artifacts.
- GitHub-hosted Ubuntu, Windows, and macOS runners.

## Default compiler comparison

| Platform | Runner CPU | TS6 median | TS7 median | TS7 speedup |
|---|---|---:|---:|---:|
| Ubuntu x64 | AMD EPYC 7763, 4 logical CPUs | 3,075.87 ms | 499.34 ms | **6.16x** |
| Windows x64 | AMD EPYC 7763, 4 logical CPUs | 4,258.64 ms | 762.97 ms | **5.58x** |
| macOS arm64 | Apple M1 Virtual, 3 logical CPUs | 1,542.20 ms | 273.54 ms | **5.64x** |

## TypeScript 7 configuration comparison

### Ubuntu x64

| Scenario | Median | Speedup vs TS6 |
|---|---:|---:|
| TS7 default | 499.34 ms | 6.16x |
| TS7 `--singleThreaded` | 636.24 ms | 4.83x |
| TS7 `--checkers 1` | 599.65 ms | 5.13x |
| TS7 `--checkers 2` | 497.78 ms | 6.18x |
| TS7 `--checkers 4` | 491.94 ms | 6.25x |

### Windows x64

| Scenario | Median | Speedup vs TS6 |
|---|---:|---:|
| TS7 default | 762.97 ms | 5.58x |
| TS7 `--singleThreaded` | 980.10 ms | 4.35x |
| TS7 `--checkers 1` | 872.50 ms | 4.88x |
| TS7 `--checkers 2` | 801.43 ms | 5.31x |
| TS7 `--checkers 4` | 793.78 ms | 5.36x |

### macOS arm64

| Scenario | Median | Speedup vs TS6 |
|---|---:|---:|
| TS7 default | 273.54 ms | 5.64x |
| TS7 `--singleThreaded` | 357.61 ms | 4.31x |
| TS7 `--checkers 1` | 323.05 ms | 4.77x |
| TS7 `--checkers 2` | 281.41 ms | 5.48x |
| TS7 `--checkers 4` | 276.55 ms | 5.58x |

## Diagnostic compatibility

The invalid fixture generated the same ordered diagnostic code set and the same diagnostic messages on every platform:

```text
TS2322: Type 'string' is not assignable to type 'number'.
TS2741: Property 'owner' is missing in type '{ id: number; }' but required in type 'Account'.
TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
```

| Observation | TypeScript 6.0.3 | TypeScript 7.0.1-rc |
|---|---:|---:|
| Diagnostic codes | 2322, 2345, 2741 | 2322, 2345, 2741 |
| Diagnostic text | Match | Match |
| Exit code with `--noEmit` | `2` | `1` |

The exit-code difference reproduces on Ubuntu, Windows, and macOS. It overlaps with upstream issue `microsoft/typescript-go#1493` and related exit-status work in `microsoft/typescript-go#4115`.

## Interpretation

1. The default TS7 process delivered a consistent large speedup across three runner families.
2. Single-threaded TS7 remained 4.31x–4.83x faster than TS6, suggesting that the improvement is not explained by checker parallelism alone.
3. Two or four checkers improved the generated workload compared with one checker, but four checkers did not materially beat the default on Windows or macOS.
4. Diagnostic semantics matched for this limited fixture; this is evidence for the tested cases, not proof of full compiler equivalence.
5. The exit-status difference may affect scripts that distinguish TypeScript exit statuses rather than treating every non-zero value identically.

## Limitations

- The workload is synthetic and favors many similarly shaped modules.
- GitHub-hosted runners are shared infrastructure and can exhibit performance noise.
- Measurements use warm filesystem caches and fresh compiler processes.
- Peak memory was not measured in this baseline.
- Watch mode, language-server latency, project references, declaration emit, JSDoc, and large real-world repositories remain future work.
- Performance numbers should not be generalized to every codebase or machine.

## Artifact traceability

| Artifact | SHA-256 digest |
|---|---|
| `results-ubuntu-latest` | `cb149645e446b2b553cfbd47bb19f6fb15ca87ec6b9fb88ce9ad9be6d5378d45` |
| `results-windows-latest` | `fcc300095aeba1b29b24f02a2f9f46a9fb6f0e736b4f43933a93d5051ca0a186` |
| `results-macos-latest` | `5d9b877761e339b0f8e4606a20d04e9088adf924c684ade0978b9d3e08a17a9b` |

## Next experiments

- Run the same methodology against a real Playwright test repository.
- Add project references and `--builders` combinations.
- Measure peak memory and CPU utilization.
- Add watch-mode edit-to-diagnostic latency tests.
- Expand diagnostic fixtures for generics, JSX, JSDoc, Unicode, declaration emit, and module resolution.
