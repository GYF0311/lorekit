---
cmap_version: 0.1
context_type: module
project: lorekit
module: sync-search
aliases:
  - sync
  - search
  - _INDEX
  - index
  - root-index
  - 检索
  - 搜索
paths:
  include:
    - src/commands/dir-index.ts
    - src/commands/sync.ts
    - src/commands/search.ts
    - src/lib/root-index.ts
relations:
  depends_on:
    - corpus-core
  consumes:
    - fetch-ingest
  checked_by:
    - safety-maintenance
source_commit: 62576ef
updated_at: 2026-06-04T00:00:00Z
confidence: ai-drafted
---
# Module: Sync / Search

## Purpose
维护文本索引、root `index.md`、文本搜索和 durable closeout report。

## Owned Paths
- `src/commands/dir-index.ts`
- `src/commands/sync.ts`
- `src/commands/search.ts`
- `src/lib/root-index.ts`

## Key Contracts
- `lorekit sync` 顺序是 `_INDEX.md` refresh -> root `index.md` merge -> doctor。
- `lorekit sync --json` / `--report` 必须保持机器可读；JSON 输出走 stdout，人类提示走 stderr。
- `lorekit search` 是默认查询入口；它优先用 ripgrep，缺失时 fallback 到内置扫描。
- 默认查询路径是 `search` -> `index.md` -> `_INDEX.md` -> canonical page readback。

## Module Relationships
- 依赖 `corpus-core` 的路径规则。
- 消费 `fetch-ingest` 编译后的 wiki 页面。
- 结果和健康状态由 `safety-maintenance` 检查。

## Read Next
- `docs/ARCHITECTURE.md` 的 Query flow。
- `docs/DESIGN-NOTES.md` 的查询路线与 sync closeout 决策。

## Tests / Verification
- `tests/smoke/sync-report.test.mjs`
- `tests/smoke/search-dir-boundary.test.mjs`
- `tests/smoke/lint-tooling-boundaries.test.mjs`
- `npm run verify`
