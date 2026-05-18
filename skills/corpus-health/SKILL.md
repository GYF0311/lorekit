---
name: corpus-health
description: 用于在任意项目中检查中央 corpus 健康状态、Lorekit 状态、向量索引、GBrain 新鲜度、配置或知识库工作流问题。
---

# corpus-health

Global health-check entry for a central Lorekit corpus. It reports state and does not write knowledge.

## Config

Read `~/.config/lorekit/global-corpus.json`.

Required:

- `default_corpus`
- `lorekit_bin` or `<default_corpus>/bin/lorekit`

Optional:

- `gbrain_bin`

Use corpus-local wrappers. Do not silently call bare global `lorekit` or `gbrain`.

## Checks

From `<default_corpus>`, run the narrow checks needed:

- `<lorekit_bin> doctor --json`
- `<lorekit_bin> vector status`
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
