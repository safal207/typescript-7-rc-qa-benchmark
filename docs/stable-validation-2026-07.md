# TypeScript 7.0 stable validation

## Purpose

This phase validates the production release of the native Go-based TypeScript compiler without rewriting or replacing the historical RC evidence.

The stable run answers four separate questions:

1. Does the published stable package select the intended native TypeScript 7 compiler on every CI operating system?
2. Do diagnostics, exit status, emitted JavaScript, declarations, and project-reference outputs remain compatible with the pinned classic TypeScript 6 baseline?
3. Do the previously observed performance gains reproduce on the stable package?
4. Did any RC-only behavior change before the production release?

## Pinned and locked toolchain

- `typescript@7.0.2`
- `@typescript/typescript6@6.0.2`, which exposes the classic `tsc6` command backed by TypeScript 6.0.3
- `@typescript/old` pinned explicitly to `typescript@6.0.3`
- `type-fest@5.7.0`
- Node.js 22 in CI
- committed npm lockfile version 3

Direct dependency versions are exact, and the complete dependency graph is committed in `package-lock.json`. Evidence workflows use `npm ci`, so registry metadata or transitive dependency movement cannot silently rewrite the resolved toolchain without a repository diff.

## Compiler-selection guard

Installing `typescript` and `@typescript/typescript6` together creates two packages that expose a command named `tsc` at different dependency levels. Depending on npm bin-link resolution, the root `node_modules/.bin/tsc` can point to the classic compiler instead of TypeScript 7.

The `scripts/ensure-compiler-shims.mjs` guard:

- detects whether the complete benchmark dev toolchain is installed;
- permits `npm ci --omit=dev` to finish without attempting to create compiler shims;
- fails closed when explicit QA verification is requested without the benchmark toolchain;
- recreates the root `tsc` shim so it targets `node_modules/typescript/bin/tsc`;
- preserves `tsc6` as the explicit classic compiler command;
- runs both commands with `--version`;
- fails immediately unless the selected versions match the installed package versions.

This preflight is part of the QA contract. A benchmark is invalid when both scenario labels execute the same compiler.

## Install contracts

The workflow validates two different supported installation modes:

1. **Evidence / development install:** `npm ci` installs the locked dev toolchain, repairs compiler shims, and verifies `tsc=7.0.2` and `tsc6=6.0.3` before measurement.
2. **Production-only install:** `npm ci --omit=dev` must complete successfully. A later explicit `npm run verify:compiler-selection` must fail because no benchmark toolchain is present.

This keeps package installation usable outside QA while preserving a strict evidence gate.

## Evidence boundary

Historical reports under `docs/results/` remain RC evidence and must not be relabelled as stable results.

New stable results are produced by the existing `*.latest.json` and `*.latest.md` outputs in workflow artifacts. A dated stable report should be committed only after:

- Ubuntu, Windows, and macOS complete successfully;
- `npm ci` installs the committed dependency graph;
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

The first full stable run is published in [`docs/results/2026-07-10-typescript-7-stable-full.md`](./results/2026-07-10-typescript-7-stable-full.md).

## Checker-scaling evidence

Checker scaling is intentionally a separate workflow rather than part of the main `npm run qa` command. Claims about `--checkers` behavior must cite the checker-scaling workflow itself. The three-operating-system stable run is GitHub Actions run `29121518759`.

## Decision rules

- Do not publish a speedup when locked installation or compiler-selection verification fails.
- Do not treat compiler-provided memory metrics as directly equivalent across implementations.
- Do not remove outliers; report them.
- Do not call an intentional TypeScript 7 language/configuration change a regression.
- Do not overwrite the RC baseline with stable measurements.
- Escalate reproducible stable-only compatibility differences with a minimal repro and raw artifacts.
- Keep checker-scaling claims separate from the main QA workflow unless its command is explicitly added to that workflow.

## Completed follow-up

- Published the dated stable evidence report.
- Compared stable ranges with the preserved RC performance class without claiming paired runner equivalence.
- Re-tested the active `--noEmit` exit-status case on all three operating systems.
- Updated the findings repository with exact stable provenance.
- Preserved a reviewed upstream comment draft after the connected integration returned HTTP 403.
- Added a committed lockfile, `npm ci`, and a production-only installation contract after Qodo, CodeRabbit, and Grok review.
