# TypeScript 7.0 stable validation

## Purpose

This phase validates the production release of the native Go-based TypeScript compiler without rewriting or replacing the historical RC evidence.

The stable run answers four separate questions:

1. Does the published stable package select the intended native TypeScript 7 compiler on every CI operating system?
2. Do diagnostics, exit status, emitted JavaScript, declarations, and project-reference outputs remain compatible with the pinned classic TypeScript 6 baseline?
3. Do the previously observed performance gains reproduce on the stable package?
4. Did any RC-only behavior change before the production release?

## Pinned toolchain

- `typescript@7.0.2`
- `@typescript/typescript6@6.0.2`, which exposes the classic `tsc6` command backed by TypeScript 6.0.3
- `type-fest@5.7.0`
- Node.js 22 in CI

The dependency versions are exact rather than ranges so later package publication cannot silently change an evidence run.

## Compiler-selection guard

Installing `typescript` and `@typescript/typescript6` together creates two packages that expose a command named `tsc` at different dependency levels. Depending on npm bin-link resolution, the root `node_modules/.bin/tsc` can point to the classic compiler instead of TypeScript 7.

The `scripts/ensure-compiler-shims.mjs` post-install guard:

- recreates the root `tsc` shim so it targets `node_modules/typescript/bin/tsc`;
- preserves `tsc6` as the explicit classic compiler command;
- runs both commands with `--version`;
- fails immediately unless the selected versions match the installed package versions.

This preflight is part of the QA contract. A benchmark is invalid when both scenario labels execute the same compiler.

## Evidence boundary

Historical reports under `docs/results/` remain RC evidence and must not be relabelled as stable results.

New stable results are produced by the existing `*.latest.json` and `*.latest.md` outputs in workflow artifacts. A dated stable report should be committed only after:

- Ubuntu, Windows, and macOS complete successfully;
- compiler-selection verification passes on every runner;
- normalized output comparison completes;
- diagnostic and exit-status differences are interpreted against current upstream state;
- raw samples and execution order are preserved.

## Stable smoke profile

Pull requests run a reduced matrix:

- 300 generated modules;
- 24 type-heavy files;
- 24 real-world dependency consumers;
- 4 project-reference packages with 12 files each;
- 1 warm-up and 3 measured rounds;
- 400 bootstrap resamples.

## Stable full profile

Manual workflow dispatch defaults to:

- 1,500 generated modules;
- 120 type-heavy files;
- 64 real-world dependency consumers;
- 12 project-reference packages with 60 files each;
- 2 warm-ups and 15 measured rounds;
- 2,000 bootstrap resamples.

## Decision rules

- Do not publish a speedup when compiler-selection verification fails.
- Do not treat compiler-provided memory metrics as directly equivalent across implementations.
- Do not remove outliers; report them.
- Do not call an intentional TypeScript 7 language/configuration change a regression.
- Do not overwrite the RC baseline with stable measurements.
- Escalate reproducible stable-only compatibility differences with a minimal repro and raw artifacts.

## Expected follow-up

After the stable full run:

1. publish a dated stable evidence report;
2. compare stable medians and confidence intervals with the RC baseline;
3. re-test the active `--noEmit` exit-status case;
4. update upstream-watch status using the exact stable result;
5. share upstream only findings that reproduce independently and have a clear compatibility impact.
