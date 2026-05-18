---
type: "cmap-module"
schema: "cmap.module.v1"
project: "lorekit"
module_id: "obsidian-gbrain"
status: "active"
layer: "unknown"
risk: "unknown"
source_path: ".context/modules/obsidian-gbrain.md"
source_hash: "sha256:08e4c6b34bba004ac592d5408e9d4f5fc57e35a2bf24d89e4f068a5768e75129"
tags:
  - "cmap/module"
  - "cmap/project/lorekit"
aliases:
  - "obsidian"
  - "graph"
  - "graph filter"
  - "gbrain"
  - "integration"
  - "integrations"
  - "视图"
  - "图谱"
paths:
  - "src/commands/obsidian-tune.ts"
  - "src/lib/obsidian.ts"
  - "plugins/obsidian-audit/**"
  - "src/commands/gbrain.ts"
  - "src/lib/integrations/**"
  - "docs/integrations/**"
---

# Obsidian Gbrain

> Source: `.context/modules/obsidian-gbrain.md`

## Relations

### depends_on

- [[Corpus Core]]
- [[Safety Maintenance]]

### exports_to

- [[Docs Tests Release]]


## Source Module Doc

# Module: Obsidian / GBrain

## Purpose
提供 canonical corpus 周围的可选集成：Obsidian graph tuning / audit plugin，以及 GBrain 只读 staging / sync / query。

## Owned Paths
- `src/commands/obsidian-tune.ts`
- `src/lib/obsidian.ts`
- `plugins/obsidian-audit/**`
- `src/commands/gbrain.ts`
- `src/lib/integrations/**`
- `docs/integrations/**`

## Key Contracts
- Obsidian graph tuning 不能覆盖用户已有 `.obsidian/` 设置，除非明确走 safe write / backup 路径。
- GBrain 相对 `知识库/` 和 `原料/` 是只读 integration。
- GBrain export 默认只写 `.wiki/integrations/gbrain-export/` staging，并记录 manifest / sync reports。
- 外部进程调用不能用 shell interpolation。
- CMAP 的 `_cmap/lorekit` 和 `_cmap-view` 是 review/read-only 视图；其中 `_cmap-view` 用 `--ui-lang zh-CN` 导出中文 UI，不是新的事实源。

## Module Relationships
- 依赖 `corpus-core` 的路径边界。
- 依赖 `safety-maintenance` 的 safe write / doctor 思路。
- 导出的文档/视图需要由 `docs-tests-release` 的验证规则覆盖。

## Read Next
- `docs/ARCHITECTURE.md` 的 GBrain integration flow。
- `README.md` 的 Optional GBrain Bridge。
- `tests/smoke/gbrain-*.test.mjs`。

## Tests / Verification
- `node --test tests/smoke/gbrain-status.test.mjs tests/smoke/gbrain-export.test.mjs tests/smoke/gbrain-sync.test.mjs tests/smoke/gbrain-query.test.mjs`
- Obsidian 变更要覆盖 safe-write 行为。
- CMAP 视图变更跑 `cmap obsidian export --check --out _cmap/lorekit` 和 `cmap view export --check --ui-lang zh-CN --out _cmap-view`。
