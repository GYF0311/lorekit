---
cmap_version: 0.1
context_type: module
project: lorekit
module: safety-maintenance
aliases:
  - doctor
  - lint
  - snapshot
  - restore
  - remove
  - trash
  - audit
  - stats
  - 安全
  - 体检
  - 删除
paths:
  include:
    - src/commands/doctor.ts
    - src/commands/lint.ts
    - src/commands/snapshot.ts
    - src/commands/restore.ts
    - src/commands/remove.ts
    - src/commands/audit.ts
    - src/commands/stats.ts
relations:
  depends_on:
    - corpus-core
    - sync-search-vector
  protects:
    - fetch-ingest
    - skills-agent
source_commit: 62576ef
updated_at: 2026-05-17T10:44:32Z
confidence: ai-drafted
---
# Module: Safety / Maintenance

## Purpose
通过 doctor / lint / snapshot / restore / remove / audit / stats 保护 corpus 完整性和可恢复性。

## Owned Paths
- `src/commands/doctor.ts`
- `src/commands/lint.ts`
- `src/commands/snapshot.ts`
- `src/commands/restore.ts`
- `src/commands/remove.ts`
- `src/commands/audit.ts`
- `src/commands/stats.ts`

## Key Contracts
- `remove` 默认 dry-run。`--apply` 必须先 snapshot，再用 `trash` package 移到 OS Trash，之后 prune vector records，并按需 sync/lint。
- 删除按 provenance，不按关键词；`Compiled Truth` 只报告人工复核，不自动改写。
- `snapshot` / `restore` 是数据安全原语，不能为了方便削弱。
- `doctor --json` 和 `doctor --section <name>` 支持机器可读和严格 section 检查。
- `lint --quick` 是 agent 自检兼容 alias，保留。

## Module Relationships
- 依赖 `corpus-core` 的路径/边界。
- 依赖 `sync-search-vector` 的 index/vector 状态。
- 保护 `fetch-ingest` 和 `skills-agent` 产生或维护的内容。

## Read Next
- `docs/ARCHITECTURE.md` 的 Remove flow。
- `docs/DESIGN-NOTES.md` 关于 remove 只做来源归因级联的章节。
- `docs/CONVENTIONS.md` 数据安全与 Do Not #14/#15。

## Tests / Verification
- `node --test tests/smoke/remove.test.mjs tests/smoke/restore-boundary.test.mjs`
- 相关 lint / doctor / snapshot smoke tests。
- `npm run verify`.
