# Draft upstream follow-up for microsoft/typescript-go#1493

Stable-release follow-up: the exit-status difference still reproduces with TypeScript 7.0.2 on all three GitHub-hosted operating systems.

Environment:

- `typescript@7.0.2`
- classic TypeScript 6.0.3 exposed as `tsc6`
- Node.js 22
- Ubuntu x64, Windows x64, macOS arm64

For the same intentionally invalid project compiled with `--noEmit`:

- TypeScript 6.0.3 exits with `2`
- TypeScript 7.0.2 exits with `1`
- diagnostic codes match: `TS2322`, `TS2345`, `TS2741`
- diagnostic text matches after CRLF/LF normalization on every OS

The full stable evidence run used 1,500 generated modules, 120 type-heavy files, 64 pinned `type-fest@5.7.0` consumers, 12 project-reference packages, 2 warm-ups, and 15 measured randomized rounds per scenario. Compiler selection was verified before measurement (`tsc6=6.0.3`, `tsc=7.0.2`) to prevent npm bin-link ambiguity.

All normalized JavaScript, declaration, and project-reference output trees matched between the two compilers; the remaining observed compatibility difference in this scenario is the process status.

Evidence:

- PR: https://github.com/safal207/typescript-7-rc-qa-benchmark/pull/11
- report: https://github.com/safal207/typescript-7-rc-qa-benchmark/blob/agent/typescript-7-stable-validation/docs/results/2026-07-10-typescript-7-stable-full.md
- workflow run: https://github.com/safal207/typescript-7-rc-qa-benchmark/actions/runs/29120482675

Posting this as stable confirmation for the existing issue and PR #4407, not as a new report.

> Publication note: the connected GitHub integration returned HTTP 403 when attempting to post this comment to `microsoft/typescript-go#1493`, so this text remains a reviewed draft until posted by an account with upstream write/comment permission.
