---
type: "cmap-module"
schema: "cmap.module.v1"
project: "lorekit"
module_id: "obsidian-export"
status: "active"
layer: "unknown"
risk: "unknown"
source_path: ".context/modules/obsidian-export.md"
source_hash: "sha256:3a56031d36c3f57545bc111ec9a0f8de9f842442693c919e2755d44165a70133"
tags:
  - "cmap/module"
  - "cmap/project/lorekit"
aliases:
  - "obsidian"
  - "graph"
  - "graph filter"
  - "视图"
  - "图谱"
paths:
  - "src/commands/obsidian-tune.ts"
  - "src/lib/obsidian.ts"
  - "plugins/obsidian-audit/**"
---

# Obsidian Export

> Source: `.context/modules/obsidian-export.md`

## Relations

### depends_on

- [[Corpus Core]]
- [[Safety Maintenance]]

### exports_to

- [[Docs Tests Release]]


## Source Module Doc

# Module: Obsidian Export

## Purpose
提供 canonical corpus 周围的 Obsidian 集成：graph tuning 与 audit plugin。

## Owned Paths
- `src/commands/obsidian-tune.ts`
- `src/lib/obsidian.ts`
- `plugins/obsidian-audit/**`

## Key Contracts
- Obsidian graph tuning 不能覆盖用户已有 `.obsidian/` 设置，除非明确走 safe write / backup 路径。
- 外部进程调用不能用 shell interpolation。
- CMAP 的 `_cmap/lorekit` 和 `_cmap-view` 是 review/read-only 视图；其中 `_cmap-view` 用 `--ui-lang zh-CN` 导出中文 UI，不是新的事实源。

## Module Relationships
- 依赖 `corpus-core` 的路径边界。
- 依赖 `safety-maintenance` 的 safe write / doctor 思路。
- 导出的文档/视图需要由 `docs-tests-release` 的验证规则覆盖。

## Read Next
- `README.md` 的 Obsidian Integration。
- `docs/ARCHITECTURE.md`。

## Tests / Verification
- Obsidian 变更要覆盖 safe-write 行为。
- CMAP 视图变更跑 `cmap obsidian export --check --out _cmap/lorekit` 和 `cmap view export --check --ui-lang zh-CN --out _cmap-view`。
