# TypeScript 7.0 RC Benchmark V2 — cross-platform evidence report

**Date:** 2026-06-22  
**Workflow run:** `27984721899`  
**Commit:** `0b7bf76b3e3ee8bbc263190aa553243d1272e736`  
**Compilers:** TypeScript 6.0.3 and TypeScript 7.0.1-rc  
**Node.js:** 22.22.3

## Executive summary

TypeScript 7.0 RC completed five benchmark suites on GitHub-hosted Ubuntu, Windows, and macOS runners. Every scenario used 2 warm-up rounds followed by 15 measured rounds in a deterministic randomized order. The benchmark retained all samples, reported outliers rather than deleting them, and calculated a non-parametric 95% bootstrap confidence interval for each median.

- For **many-small-files type checking**, TS7 default was **5.57×–6.31× faster** than TS6 by median wall-clock duration.
- For **type-heavy checking**, TS7 default was **4.98×–6.05× faster** than TS6.
- For **JavaScript emit**, TS7 default was **4.59×–6.40× faster**.
- For **declaration-only emit**, TS7 default was **4.58×–6.51× faster**.
- For **clean project-reference builds**, TS7 default was **4.66×–6.20× faster**.

Correctness was evaluated separately from speed. After CRLF-to-LF normalization, TypeScript 6 and TypeScript 7 produced identical file paths and SHA-256 content hashes for **1,501 JavaScript files**, **1,501 declaration files**, and **1,464 project-reference output files** on every operating system. No output files were added, removed, or changed.

The previously observed CLI difference also reproduced: the intentionally invalid `--noEmit` fixture produced the same diagnostic codes and normalized diagnostic text, but TS6 returned exit code `2` while TS7 RC returned exit code `1`.

## Workload and protocol

- 1,500 generated modules plus one index module for the many-files workload.
- 120 generated type-heavy files plus one index module.
- 12 composite projects: 11 independent leaf libraries and one aggregator, with 60 modules plus an index per project.
- Fresh compiler process for every sample.
- 2 warm-up rounds and 15 measured rounds per scenario.
- Scenario order randomized within every round using seed `20260622`.
- 2,000 bootstrap resamples for median confidence intervals.
- Output cleanup performed outside the measured interval.
- Warm filesystem caches; caches were not deliberately flushed.
- IQR outliers reported and retained.

## Default compiler comparison

| Workload | Ubuntu x64 | Windows x64 | macOS arm64 |
|---|---:|---:|---:|
| Many small files | 3,108.40 → 492.92 ms (**6.31×**) | 3,549.40 → 637.40 ms (**5.57×**) | 2,608.35 → 432.66 ms (**6.03×**) |
| Type-heavy types | 2,455.49 → 406.17 ms (**6.05×**) | 2,682.62 → 539.19 ms (**4.98×**) | 2,038.20 → 374.09 ms (**5.45×**) |
| JavaScript emit | 3,655.58 → 571.25 ms (**6.40×**) | 4,409.92 → 960.50 ms (**4.59×**) | 3,447.86 → 616.17 ms (**5.60×**) |
| Declaration emit | 3,627.41 → 557.58 ms (**6.51×**) | 4,354.55 → 951.18 ms (**4.58×**) | 4,024.58 → 798.03 ms (**5.04×**) |
| Project references | 9,637.55 → 1,747.06 ms (**5.52×**) | 12,118.48 → 2,599.43 ms (**4.66×**) | 10,115.62 → 1,630.92 ms (**6.20×**) |

> Each cell shows `TS6 median → TS7 median` followed by speedup.

## Configuration and stability details

### Ubuntu x64

| Workload / scenario | Median | 95% median CI | CV | Speedup vs TS6 |
|---|---:|---:|---:|---:|
| Many files — TS6 | 3,108.40 ms | 3,084.00–3,118.25 | 0.9% | 1.00× |
| Many files — TS7 default | 492.92 ms | 489.64–498.08 | 1.5% | 6.31× |
| Many files — TS7 single-threaded | 631.48 ms | 622.23–649.01 | 2.1% | 4.92× |
| Many files — TS7 checkers=1 | 599.82 ms | 589.63–602.27 | 1.7% | 5.18× |
| Many files — TS7 checkers=2 | 501.70 ms | 495.27–506.21 | 1.7% | 6.20× |
| Many files — TS7 checkers=4 | 494.42 ms | 488.90–496.91 | 1.5% | 6.29× |
| Type-heavy — TS6 | 2,455.49 ms | 2,448.84–2,503.11 | 1.5% | 1.00× |
| Type-heavy — TS7 default | 406.17 ms | 399.66–420.53 | 2.9% | 6.05× |
| JavaScript emit — TS7 default | 571.25 ms | 565.57–574.61 | 1.4% | 6.40× |
| Declaration emit — TS7 default | 557.58 ms | 550.56–559.29 | 1.4% | 6.51× |
| Project references — TS6 | 9,637.55 ms | 9,599.39–9,881.77 | 2.0% | 1.00× |
| Project references — TS7 default | 1,747.06 ms | 1,730.13–1,758.92 | 1.4% | 5.52× |
| Project references — TS7 builders=1 | 2,820.61 ms | 2,802.77–2,881.78 | 2.4% | 3.42× |
| Project references — TS7 builders=2 | 1,986.18 ms | 1,975.52–2,015.35 | 2.4% | 4.85× |
| Project references — TS7 builders=4 | 1,734.69 ms | 1,721.65–1,749.19 | 1.8% | 5.56× |

### Windows x64

| Workload / scenario | Median | 95% median CI | CV | Speedup vs TS6 |
|---|---:|---:|---:|---:|
| Many files — TS6 | 3,549.40 ms | 3,538.62–3,606.25 | 6.6% | 1.00× |
| Many files — TS7 default | 637.40 ms | 631.12–687.30 | 5.6% | 5.57× |
| Many files — TS7 single-threaded | 884.99 ms | 868.28–892.25 | 5.0% | 4.01× |
| Many files — TS7 checkers=1 | 765.22 ms | 756.46–783.37 | 3.1% | 4.64× |
| Many files — TS7 checkers=2 | 667.19 ms | 650.02–700.65 | 4.9% | 5.32× |
| Many files — TS7 checkers=4 | 644.53 ms | 638.39–659.72 | 4.5% | 5.51× |
| Type-heavy — TS6 | 2,682.62 ms | 2,660.47–2,716.32 | 1.3% | 1.00× |
| Type-heavy — TS7 default | 539.19 ms | 534.79–541.74 | 1.2% | 4.98× |
| JavaScript emit — TS7 default | 960.50 ms | 937.20–974.26 | 2.5% | 4.59× |
| Declaration emit — TS7 default | 951.18 ms | 934.33–967.14 | 4.4% | 4.58× |
| Project references — TS6 | 12,118.48 ms | 11,080.66–12,438.90 | 13.0% | 1.00× |
| Project references — TS7 default | 2,599.43 ms | 2,319.21–2,623.91 | 10.8% | 4.66× |
| Project references — TS7 builders=1 | 3,663.35 ms | 3,523.93–3,741.16 | 7.5% | 3.31× |
| Project references — TS7 builders=2 | 2,793.84 ms | 2,429.29–2,838.59 | 7.8% | 4.34× |
| Project references — TS7 builders=4 | 2,560.09 ms | 2,120.40–2,621.89 | 45.2% | 4.73× |

### macOS arm64

| Workload / scenario | Median | 95% median CI | CV | Speedup vs TS6 |
|---|---:|---:|---:|---:|
| Many files — TS6 | 2,608.35 ms | 2,342.76–2,823.07 | 14.2% | 1.00× |
| Many files — TS7 default | 432.66 ms | 368.49–519.17 | 16.6% | 6.03× |
| Many files — TS7 single-threaded | 580.23 ms | 519.06–621.00 | 13.0% | 4.50× |
| Many files — TS7 checkers=1 | 589.57 ms | 474.93–647.48 | 18.3% | 4.42× |
| Many files — TS7 checkers=2 | 432.37 ms | 385.00–448.30 | 15.5% | 6.03× |
| Many files — TS7 checkers=4 | 408.33 ms | 379.67–443.03 | 13.6% | 6.39× |
| Type-heavy — TS6 | 2,038.20 ms | 1,976.94–2,183.78 | 7.1% | 1.00× |
| Type-heavy — TS7 default | 374.09 ms | 352.91–418.14 | 12.9% | 5.45× |
| JavaScript emit — TS7 default | 616.17 ms | 601.51–652.84 | 10.9% | 5.60× |
| Declaration emit — TS7 default | 798.03 ms | 704.75–877.63 | 32.8% | 5.04× |
| Project references — TS6 | 10,115.62 ms | 9,897.72–11,097.05 | 10.3% | 1.00× |
| Project references — TS7 default | 1,630.92 ms | 1,511.63–1,868.07 | 13.4% | 6.20× |
| Project references — TS7 builders=1 | 2,936.13 ms | 2,829.51–3,030.92 | 8.6% | 3.45× |
| Project references — TS7 builders=2 | 1,875.11 ms | 1,825.89–2,025.59 | 8.1% | 5.39× |
| Project references — TS7 builders=4 | 1,686.30 ms | 1,601.64–1,842.16 | 9.0% | 6.00× |

## Parallel builder result

The project-reference graph intentionally contains 11 independent leaf projects followed by one aggregator, so `--builders` has real parallel work available.

| Platform | TS7 builders=1 | TS7 builders=2 | TS7 builders=4 | TS7 default |
|---|---:|---:|---:|---:|
| Ubuntu x64 | 2,820.61 ms (3.42×) | 1,986.18 ms (4.85×) | 1,734.69 ms (5.56×) | 1,747.06 ms (5.52×) |
| Windows x64 | 3,663.35 ms (3.31×) | 2,793.84 ms (4.34×) | 2,560.09 ms (4.73×) | 2,599.43 ms (4.66×) |
| macOS arm64 | 2,936.13 ms (3.45×) | 1,875.11 ms (5.39×) | 1,686.30 ms (6.00×) | 1,630.92 ms (6.20×) |

Increasing builders from 1 to 4 materially reduced median build time on all three platforms. The default TS7 configuration was already close to the best observed median. The Windows `builders=4` samples were noisy (45.2% coefficient of variation), so that individual median should not be interpreted as a precise ranking against the Windows default.

## Output compatibility

| Platform | JavaScript | Declarations | Project-reference outputs | Overall |
|---|---:|---:|---:|---:|
| Ubuntu x64 | PASS — 1501 vs 1501, 0 changed | PASS — 1501 vs 1501, 0 changed | PASS — 1464 vs 1464, 0 changed | **PASS** |
| Windows x64 | PASS — 1501 vs 1501, 0 changed | PASS — 1501 vs 1501, 0 changed | PASS — 1464 vs 1464, 0 changed | **PASS** |
| macOS arm64 | PASS — 1501 vs 1501, 0 changed | PASS — 1501 vs 1501, 0 changed | PASS — 1464 vs 1464, 0 changed | **PASS** |

Normalization: CRLF is treated as LF before hashing. `.tsbuildinfo` files are excluded because they are compiler implementation metadata rather than distributable output. All raw output trees remain in the workflow artifacts.

## Diagnostic compatibility

| Observation | TypeScript 6.0.3 | TypeScript 7.0.1-rc |
|---|---|---|
| Diagnostic codes | `2322`, `2345`, `2741` | `2322`, `2345`, `2741` |
| Normalized diagnostic content | Match | Match |
| Windows raw newline convention | CRLF | LF |
| Exit code with `--noEmit` errors | `2` | `1` |

The exit-code difference reproduced on Ubuntu, Windows, and macOS. It matches previously reported upstream behavior and should be referenced rather than filed as a duplicate.

## Supplementary extended diagnostics

Compiler-reported extended diagnostics support the wall-clock direction for the many-files and type-heavy workloads. These numbers are supplementary only: the JavaScript and Go implementations can count symbols, types, memory, and parallel phase time differently. They are **not** treated as equivalent operating-system measurements.

| Platform | Workload | TS6 total | TS7 total | TS6 reported memory | TS7 reported memory |
|---|---|---:|---:|---:|---:|
| Ubuntu x64 | Many small files | 3.05s | 0.455s | 198977K | 130085K |
| Ubuntu x64 | Type-heavy types | 2.39s | 0.388s | 174607K | 92569K |
| Windows x64 | Many small files | 3.28s | 0.511s | 194634K | 130084K |
| Windows x64 | Type-heavy types | 2.42s | 0.418s | 160836K | 92610K |
| macOS arm64 | Many small files | 2.06s | 0.324s | 195895K | 130737K |
| macOS arm64 | Type-heavy types | 1.57s | 0.259s | 165430K | 92539K |

Project-reference `--extendedDiagnostics` totals are intentionally omitted from this summary because parallel builders can aggregate phase durations in a way that does not correspond directly to elapsed wall-clock time. Raw values remain in the JSON artifacts.

## Stability and interpretation

- Ubuntu measurements were the most stable overall, usually showing coefficients of variation below 4%.
- Windows was generally stable for type checking and emit, but project-reference scenarios showed more variability.
- The virtualized macOS runner was substantially noisier, with wider confidence intervals and several double-digit coefficients of variation. The direction and magnitude of the speedup nevertheless remained consistent.
- Single-threaded TS7 remained roughly 4.0×–4.9× faster than TS6 in the two type-check suites, indicating that checker parallelism is not the sole source of the improvement.
- Two or four checkers generally outperformed one checker. Four checkers did not consistently beat the default configuration by a meaningful margin.
- These are warm-filesystem, fresh-process CLI measurements. They include process startup and should not be presented as pure type-checking CPU time.

## Limitations

- The workloads are generated and do not represent every real-world dependency graph, JSX framework, JSDoc pattern, or module-resolution edge case.
- GitHub-hosted runners are shared and can experience scheduling noise.
- Peak process-tree RSS was not measured independently at the operating-system level.
- Watch-mode latency and language-server behavior require separate long-running harnesses.
- Output equality is proven only for the generated fixtures used in this run.
- Broad migration advice should additionally include at least one pinned real-world repository.

## Artifact traceability

| Artifact | SHA-256 digest |
|---|---|
| `results-ubuntu-latest` | `d862e967c1c09014f2266bee928d7964fefa1eabf76f3fe75c5970131b5c7159` |
| `results-windows-latest` | `487c947116dab23338a2516afbc3a05a194e0ae8b1e68585b8577d03419a3b4d` |
| `results-macos-latest` | `91f02f7a17be1ff47bc693c64833bb1aba589d7f33d5e48221a303edb5a1b5c1` |

## Conclusion

Across five generated workloads and three operating systems, TypeScript 7.0.1 RC delivered a consistent multi-fold wall-clock improvement while producing identical normalized JavaScript and declaration outputs for the tested fixtures. The strongest defensible claim from this run is **not** that TS7 is universally 6× faster; it is that, under the documented fresh-process warm-filesystem protocol, every tested workload improved substantially, with default speedups ranging from **4.58× to 6.51×**, and output compatibility passed for all tested files.
