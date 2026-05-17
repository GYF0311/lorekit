---
cmap_version: 0.1
context_type: module
project: lorekit
module: docs-tests-release
aliases:
  - docs
  - documentation
  - tests
  - smoke
  - verify
  - release
  - package
  - changelog
  - 文档
  - 发布
paths:
  include:
    - docs/**
    - tests/smoke/**
    - README.md
    - CHANGELOG.md
    - LICENSE
    - eslint.config.js
    - tsconfig.json
    - tsup.config.ts
    - package-lock.json
relations:
  documents:
    - cli
    - corpus-core
    - fetch-ingest
    - sync-search-vector
    - safety-maintenance
    - skills-agent
    - obsidian-gbrain
source_commit: 62576ef
updated_at: 2026-05-17T10:44:32Z
confidence: ai-drafted
---
# 模块：Docs / Tests / Release

## 职责
维护贡献者文档、smoke tests、构建脚本、changelog/version 规则和发布前验证。

## 负责路径
- `docs/**`
- `tests/smoke/**`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `eslint.config.js`
- `tsconfig.json`
- `tsup.config.ts`
- `package-lock.json`

## 关键契约
- 新命令、新 skill、跨文件行为变化，只要用户可见，就要在同一 commit 更新 docs。
- 永久文档各司其职：`README`、`AGENTS`、`CONVENTIONS`、`ARCHITECTURE`、`CODEBASE-MAP`、`DESIGN-NOTES`、`CHANGELOG`、`IDEAS`。
- smoke tests 用 Node 内置 `node:test`；新增命令或高风险行为必须加 targeted tests。
- `VERSION` 不手工改，用 `npm version`。
- 新增 docs/ 前必须先对照 `docs/CONVENTIONS.md` §13，避免文档膨胀。

## 关联模块
- 记录和验证其他模块的用户可见行为。
- 如果模块边界或目录结构变了，优先更新 `docs/ARCHITECTURE.md` 和 `docs/CODEBASE-MAP.md`。

## 读什么
- `docs/CONVENTIONS.md` §13。
- `docs/CODEBASE-MAP.md`。
- `package.json` scripts。

## 验证
- `npm run verify`
- Targeted `node --test tests/smoke/<test>.mjs`
- `git diff --check`
