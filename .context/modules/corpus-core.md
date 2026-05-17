---
cmap_version: 0.1
context_type: module
project: lorekit
module: corpus-core
aliases:
  - corpus
  - schema
  - paths
  - lint
  - node_modules
  - skills
  - index.md
  - _INDEX
  - logger
  - 路径
  - 边界
paths:
  include:
    - src/lib/corpus.ts
    - src/lib/paths.ts
    - src/lib/root-index.ts
    - src/lib/date.ts
    - src/utils/**
relations:
  supports:
    - fetch-ingest
    - sync-search-vector
    - safety-maintenance
    - obsidian-gbrain
source_commit: 62576ef
updated_at: 2026-05-17T10:44:32Z
confidence: ai-drafted
---
# 模块：Corpus Core

## 职责
定义 lorekit 如何发现 corpus、解析 frontmatter、执行路径 include/exclude 规则、刷新 root index，并提供共享日志/文件系统工具。

## 负责路径
- `src/lib/corpus.ts`
- `src/lib/paths.ts`
- `src/lib/root-index.ts`
- `src/lib/date.ts`
- `src/utils/fs.ts`
- `src/utils/logger.ts`

## 关键契约
- `src/lib/paths.ts` 是 scan / index / lint / vector / snapshot 边界的单一事实源。
- `skills/` 和 `node_modules/` 是工具目录，不是 corpus 页面。
- `原料/`、`知识库/`、`_工作台/`、`系统/`、`反馈/`、`.wiki/` 是 schema 级目录名，不要随手重命名。
- root `index.md` 通过 controlled regions merge-refresh，必须保留人类手写摘要。
- logger 是源码输出唯一入口。

## 关联模块
- 支撑 `fetch-ingest`、`sync-search-vector`、`safety-maintenance`、`obsidian-gbrain`。
- 如果扫描边界变了，通常也要更新 `docs-tests-release` 的测试/文档。

## 读什么
- `docs/ARCHITECTURE.md` 的 Core abstractions / Schema constraints。
- `docs/CONVENTIONS.md` Do Not #8 和 #11。

## 验证
- 路径规则变化要有 targeted smoke test，并跑 `npm run verify`。
- 扫描边界 bug 要用 fixture 复现，例如包含 `skills/` / `node_modules/`。
