---
cmap_version: 0.1
context_type: module
project: lorekit
module: obsidian-gbrain
aliases:
  - obsidian
  - graph
  - graph filter
  - gbrain
  - integration
  - integrations
  - 视图
  - 图谱
paths:
  include:
    - src/commands/obsidian-tune.ts
    - src/lib/obsidian.ts
    - plugins/obsidian-audit/**
    - src/commands/gbrain.ts
    - src/lib/integrations/**
    - docs/integrations/**
relations:
  depends_on:
    - corpus-core
    - safety-maintenance
  exports_to:
    - docs-tests-release
source_commit: 62576ef
updated_at: 2026-05-17T10:44:32Z
confidence: ai-drafted
---
# 模块：Obsidian / GBrain

## 职责
提供 canonical corpus 周围的可选集成：Obsidian graph tuning / audit plugin，以及 GBrain 只读 staging / sync / query。

## 负责路径
- `src/commands/obsidian-tune.ts`
- `src/lib/obsidian.ts`
- `plugins/obsidian-audit/**`
- `src/commands/gbrain.ts`
- `src/lib/integrations/**`
- `docs/integrations/**`

## 关键契约
- Obsidian graph tuning 不能覆盖用户已有 `.obsidian/` 设置，除非明确走 safe write / backup 路径。
- GBrain 相对 `知识库/` 和 `原料/` 是只读 integration。
- GBrain export 默认只写 `.wiki/integrations/gbrain-export/` staging，并记录 manifest / sync reports。
- 外部进程调用不能用 shell interpolation。
- CMAP 的 `_cmap/lorekit` 和 `_cmap-view` 是 review/read-only 视图，不是新的事实源。

## 关联模块
- 依赖 `corpus-core` 的路径边界。
- 依赖 `safety-maintenance` 的 safe write / doctor 思路。
- 导出的文档/视图需要由 `docs-tests-release` 的验证规则覆盖。

## 读什么
- `docs/ARCHITECTURE.md` 的 GBrain integration flow。
- `README.md` 的 Optional GBrain Bridge。
- `tests/smoke/gbrain-*.test.mjs`。

## 验证
- `node --test tests/smoke/gbrain-status.test.mjs tests/smoke/gbrain-export.test.mjs tests/smoke/gbrain-sync.test.mjs tests/smoke/gbrain-query.test.mjs`
- Obsidian 变更要覆盖 safe-write 行为。
- CMAP 视图变更跑 `cmap obsidian export --check --out _cmap/lorekit` 和 `cmap view export --check --out _cmap-view`。
