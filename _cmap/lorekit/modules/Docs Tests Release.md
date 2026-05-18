---
type: "cmap-module"
schema: "cmap.module.v1"
project: "lorekit"
module_id: "docs-tests-release"
status: "active"
layer: "unknown"
risk: "unknown"
source_path: ".context/modules/docs-tests-release.md"
source_hash: "sha256:783504521e92a4ee93b1d2fc2817dbe94c814e43536c8e87afbc1cf257d06e1e"
tags:
  - "cmap/module"
  - "cmap/project/lorekit"
aliases:
  - "docs"
  - "documentation"
  - "tests"
  - "smoke"
  - "verify"
  - "release"
  - "package"
  - "changelog"
  - "文档"
  - "发布"
paths:
  - "docs/**"
  - "tests/smoke/**"
  - "README.md"
  - "CHANGELOG.md"
  - "LICENSE"
  - "eslint.config.js"
  - "tsconfig.json"
  - "tsup.config.ts"
  - "package-lock.json"
---

# Docs Tests Release

> Source: `.context/modules/docs-tests-release.md`

## Relations

### documents

- [[Cli]]
- [[Corpus Core]]
- [[Fetch Ingest]]
- [[Sync Search Vector]]
- [[Safety Maintenance]]
- [[Skills Agent]]
- [[Obsidian Gbrain]]


## Source Module Doc

# Module: Docs / Tests / Release

## Purpose
维护贡献者文档、smoke tests、构建脚本、changelog/version 规则和发布前验证。

## Owned Paths
- `docs/**`
- `tests/smoke/**`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `eslint.config.js`
- `tsconfig.json`
- `tsup.config.ts`
- `package-lock.json`

## Key Contracts
- 新命令、新 skill、跨文件行为变化，只要用户可见，就要在同一 commit 更新 docs。
- 永久文档各司其职：`README`、`AGENTS`、`CONVENTIONS`、`ARCHITECTURE`、`CODEBASE-MAP`、`DESIGN-NOTES`、`CHANGELOG`、`IDEAS`。
- smoke tests 用 Node 内置 `node:test`；新增命令或高风险行为必须加 targeted tests。
- `VERSION` 不手工改，用 `npm version`。
- 新增 docs/ 前必须先对照 `docs/CONVENTIONS.md` §13，避免文档膨胀。

## Module Relationships
- 记录和验证其他模块的用户可见行为。
- 如果模块边界或目录结构变了，优先更新 `docs/ARCHITECTURE.md` 和 `docs/CODEBASE-MAP.md`。

## Read Next
- `docs/CONVENTIONS.md` §13。
- `docs/CODEBASE-MAP.md`。
- `package.json` scripts。

## Tests / Verification
- `npm run verify`
- Targeted `node --test tests/smoke/<test>.mjs`
- `git diff --check`
