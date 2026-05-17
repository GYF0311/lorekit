---
cmap_version: 0.1
context_type: module
project: lorekit
module: project-map
aliases:
  - cmap
  - context
  - .context
  - project map
  - handoff
  - checkpoint
  - AGENTS
  - CLAUDE
  - 接手
  - 项目地图
  - 续接
paths:
  include:
    - .context/**
    - .gitignore
    - AGENTS.md
    - CLAUDE.md
    - _cmap/**
    - _cmap-view/**
relations:
  guides:
    - cli
    - corpus-core
    - fetch-ingest
    - sync-search-vector
    - safety-maintenance
    - skills-agent
    - obsidian-gbrain
    - docs-tests-release
source_commit: 62576ef
updated_at: 2026-05-17T10:44:32Z
confidence: ai-drafted
---
# 模块：项目地图 / 交接

## 职责
维护 lorekit 仓库本地的 CMAP 项目地图、当前检查点、模块路由、Obsidian / Review HTML 导出和 AI 交接入口。它补充项目规则，但不替代 `AGENTS.md` / `CLAUDE.md`。

## 负责路径
- `.context/**`
- `.gitignore`
- `AGENTS.md`
- `CLAUDE.md`
- `_cmap/**`
- `_cmap-view/**`

## 关键契约
- `AGENTS.md` 和 `CLAUDE.md` 是 host entrypoints，必须保留原内容；只能追加 CMAP 说明或 marker block。
- `.context/MAP.md`、`.context/CHECKPOINT.md`、`.context/STATUS.md`、`.context/DECISIONS.md`、`.context/VERIFY.md`、`.context/modules/*.md` 是 CMAP canonical facts。
- `.context/out/`、`.context/inbox/`、`.context/generated/`、`.context/logs/`、`.context/ideas/` 是辅助层或过程层，未经提升不能当事实源。
- `_cmap/lorekit` 是 Obsidian-friendly 导出；`_cmap-view` 是 Review HTML 导出；它们只读展示 `.context`。
- `.context` 正文默认中文；frontmatter key、module id、命令和代码标识符保留英文。

## 常见任务
- “接手项目 / 看项目地图 / 续接上下文”：读本模块。
- “生成 obsidian / view html”：读本模块，再跑 `cmap obsidian export` / `cmap view export`。
- “改 AGENTS/CLAUDE 入口”：只做追加，先看 diff。

## 关联模块
- `guides` 所有模块：本模块负责把任务路由到对应模块。

## 验证
- `cmap route "<task>"`
- `cmap verify --changed`
- `cmap obsidian export --check --out _cmap/lorekit`
- `cmap view export --check --out _cmap-view`
- `git diff --check`
