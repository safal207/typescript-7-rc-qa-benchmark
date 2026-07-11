# One Exit Code, Three Operating Systems, and a TypeScript 7 Compatibility Bug

Published on Medium: 2026-07-11

Canonical article:

https://medium.com/@new476774/one-exit-code-three-operating-systems-and-a-typescript-7-compatibility-bug-25dee286b454

## Summary

The article describes a TypeScript 7 compatibility investigation in which the same intentionally invalid project produced equivalent diagnostics but different process exit codes under `--noEmit`:

```text
TypeScript 6.0.3 -> exit code 2
TypeScript 7.0.2 -> exit code 1
```

The difference reproduced on GitHub-hosted Ubuntu x64, Windows x64, and macOS arm64. Diagnostic codes and normalized diagnostic text matched across all three platforms.

The investigation demonstrates why compiler migrations should compare machine-facing contracts independently:

- compiler identity;
- diagnostics;
- generated outputs;
- process status;
- performance.

## Upstream trace

- Issue: https://github.com/microsoft/typescript-go/issues/1493
- Stable confirmation comment: https://github.com/microsoft/typescript-go/issues/1493#issuecomment-4944032445
- Root-cause fix: https://github.com/microsoft/typescript-go/pull/4407

## Immutable evidence

- Stable harness revision: https://github.com/safal207/typescript-7-rc-qa-benchmark/commit/0622e687d494ddb68244068d470d00fa45ad37aa
- Stable report: https://github.com/safal207/typescript-7-rc-qa-benchmark/blob/74708feaa92203d4a29b19b472a0e8fc4fa7ed58/docs/results/2026-07-10-typescript-7-stable-full.md
- Workflow run: https://github.com/safal207/typescript-7-rc-qa-benchmark/actions/runs/29120482675
- Ubuntu artifact: `8238612637`
- Windows artifact: `8238611050`
- macOS artifact: `8238542656`

## Main lesson

> An exit code is part of the public CLI contract. Compare what humans see and what machines consume.

This repository remains the source of reproducible evidence. Medium is the narrative publication layer.
