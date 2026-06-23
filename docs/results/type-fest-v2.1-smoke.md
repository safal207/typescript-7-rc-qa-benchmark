# Benchmark V2.1 smoke validation

Cross-platform smoke validation completed successfully for the pinned type-fest 5.7.0 dependency consumer suite.

| OS | TS6 median | TS7 median | TS7 speedup |
|---|---:|---:|---:|
| Ubuntu | 4945.92 ms | 949.54 ms | 5.21x |
| Windows | 6279.54 ms | 1405.12 ms | 4.47x |
| macOS | 3940.05 ms | 749.12 ms | 5.26x |

The smoke profile used 24 deterministic consumer files, one warm-up, three measured randomized rounds, and 400 bootstrap resamples. Both compilers completed successfully on all three operating systems. A full evidence run is still required before publishing a final V2.1 conclusion.
