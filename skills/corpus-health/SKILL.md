---
name: corpus-health
description: 用于显式配置目标 corpus 后，检查该 corpus 健康状态、LoreKit 状态、GBrain 新鲜度、配置或知识库工作流问题。
---

# corpus-health

Optional health-check gateway for a configured Lorekit corpus. It reports state and does not write knowledge.

## Config

Read `~/.config/lorekit/global-corpus.json`.

Required:

- `default_corpus`
- `lorekit_bin` or `<default_corpus>/bin/lorekit`

Optional:

- `gbrain_bin`

Use configured corpus-local wrappers for `lorekit` and `gbrain`.

## Checks

From `<default_corpus>`, run the narrow checks needed:

- `<lorekit_bin> doctor --json`
- `<lorekit_bin> ingest pending`
- `<lorekit_bin> gbrain status --json` when GBrain is configured
- `<lorekit_bin> gbrain doctor --json` when GBrain integration health is requested

Do not run `sync`, `gbrain sync`, `gbrain export`, or mutating repair commands unless the user explicitly asks.

## Output

Summarize:

- corpus path
- hard failures
- warnings
- stale indexes
- pending ingest items
- suggested next commands

Keep optional integration warnings separate from corpus hard failures.

## Safety

This skill is report-only by default.

Do not modify `知识库/`, `原料/`, `每日/`, or `.wiki/` during a health check unless the user separately requests repair.
