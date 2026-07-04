---
type: "cmap-module"
schema: "cmap.module.v1"
project: "lorekit"
module_id: "safety-maintenance"
status: "active"
layer: "unknown"
risk: "unknown"
source_path: ".context/modules/safety-maintenance.md"
source_hash: "sha256:869ea7562acb20bacac3f6e962f50ce7a65b895da3abcfe93dd840fd3cf9e195"
tags:
  - "cmap/module"
  - "cmap/project/lorekit"
aliases:
  - "doctor"
  - "lint"
  - "links"
  - "断链"
  - "snapshot"
  - "restore"
  - "remove"
  - "trash"
  - "audit"
  - "stats"
  - "安全"
  - "体检"
  - "删除"
paths:
  - "src/commands/doctor.ts"
  - "src/commands/lint.ts"
  - "src/commands/links.ts"
  - "src/lib/missing-nodes.ts"
  - "src/commands/snapshot.ts"
  - "src/commands/restore.ts"
  - "src/commands/remove.ts"
  - "src/commands/audit.ts"
  - "src/commands/stats.ts"
---

# Safety Maintenance

> Source: `.context/modules/safety-maintenance.md`

## Relations

### depends_on

- [[Corpus Core]]
- [[Sync Search]]

### protects

- [[Fetch Ingest]]
- [[Skills Agent]]


## Source Module Doc

# Module: Safety / Maintenance

## Purpose
通过 doctor / lint / links / snapshot / restore / remove / audit / stats 保护 corpus 完整性和可恢复性。

## Owned Paths
- `src/commands/doctor.ts`
- `src/commands/lint.ts`
- `src/commands/links.ts`
- `src/lib/missing-nodes.ts`
- `src/commands/snapshot.ts`
- `src/commands/restore.ts`
- `src/commands/remove.ts`
- `src/commands/audit.ts`
- `src/commands/stats.ts`

## Key Contracts
- `remove` 默认 dry-run。`--apply` 必须先 snapshot，再用 `trash` package 移到 OS Trash，之后按需 sync/lint。
- 删除按 provenance，不按关键词；`Compiled Truth` 只报告人工复核，不自动改写。
- `snapshot` / `restore` 是数据安全原语，不能为了方便削弱。
- `doctor --json` 和 `doctor --section <name>` 支持机器可读和严格 section 检查。
- `lint --quick` 是 agent 自检兼容 alias，保留。
- `links` 是断链闭环：suggest 只读给候选，fix/stub/backlog/plain 由 AI 判断后执行；写操作拒绝 `原料/`。
- `links backlog` 登记到 `系统/missing-nodes.md`（SSOT helper `src/lib/missing-nodes.ts`）；lint 对已登记 label 的断链降级为 backlogged，不计入失败（`countHardLintIssues`）。
- `links plain` 必须记台账（`.wiki/links-state.json`）保证可恢复；`links plained` 报 revivable 并自动清出已重连条目。
- lint 问题分级（2026-07-04 起）：硬性 = missing-field / broken-link / orphan / workbench-source-link / unresolved-source（知识库页 frontmatter 的 原料/知识库 来源引用必须可解析）；软性（`SOFT_ISSUE_KINDS`，不计入失败）= backlogged-link / stale-review（`domain_volatility` 90/180/365 天复审窗口，`last_reviewed` 缺省回退 `updated`）。
- skills ↔ CLI 防漂移由 `tests/smoke/skills-cli-drift.test.mjs` 兜底：skill 引用不存在的命令/子命令/flag 时 verify 直接失败。

## Module Relationships
- 依赖 `corpus-core` 的路径/边界。
- 依赖 `sync-search` 的 index/search 状态。
- 保护 `fetch-ingest` 和 `skills-agent` 产生或维护的内容。

## Read Next
- `docs/ARCHITECTURE.md` 的 Remove flow。
- `docs/DESIGN-NOTES.md` 关于 remove 只做来源归因级联的章节。
- `docs/CONVENTIONS.md` 数据安全与 Do Not #14/#15。

## Tests / Verification
- `node --test tests/smoke/remove.test.mjs tests/smoke/restore-boundary.test.mjs tests/smoke/links.test.mjs`
- 相关 lint / doctor / snapshot smoke tests。
- `npm run verify`.
