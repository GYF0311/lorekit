---
cmap_version: 0.1
context_type: module
project: lorekit
module: sync-search-vector
aliases:
  - sync
  - search
  - vector
  - bm25
  - rrf
  - ollama
  - _INDEX
  - indexed_files
  - 检索
  - 向量
paths:
  include:
    - src/commands/dir-index.ts
    - src/commands/sync.ts
    - src/commands/search.ts
    - src/commands/vector.ts
    - src/lib/vectordb/**
    - src/lib/ollama.ts
    - src/lib/chunker.ts
relations:
  depends_on:
    - corpus-core
  consumes:
    - fetch-ingest
  checked_by:
    - safety-maintenance
source_commit: 62576ef
updated_at: 2026-05-17T10:44:32Z
confidence: ai-drafted
---
# 模块：Sync / Search / Vector

## 职责
维护文本索引、root index、文本搜索，以及可选 vector / BM25 / RRF 检索。

## 负责路径
- `src/commands/dir-index.ts`
- `src/commands/sync.ts`
- `src/commands/search.ts`
- `src/commands/vector.ts`
- `src/lib/vectordb/**`
- `src/lib/ollama.ts`
- `src/lib/chunker.ts`

## 关键契约
- `lorekit sync` 顺序是 `_INDEX.md` refresh -> root `index.md` merge -> vector sync unless skipped -> doctor。
- `lorekit sync --skip-vector` 是本机向量/Ollama 环境不稳定时的重要收尾路径。
- vector retrieval 是可选能力；小中规模 corpus 仍应支持 Read-first index 导航。
- BM25 chunk direct search 和 vector layered search 是两条路径；不要无证据恢复硬 BM25 L0 gate。
- `MODE_THRESHOLD_FILES` 按 indexed file count 推荐 text / vector 模式。

## 关联模块
- 依赖 `corpus-core` 的路径规则和 root index。
- 消费 `fetch-ingest` 编译后的 wiki 页面。
- 结果和健康状态由 `safety-maintenance` 检查。

## 读什么
- `docs/DESIGN-NOTES.md` 关于 L0/L1/L2/L3 和 BM25 L0 gate 失败的章节。
- `docs/ARCHITECTURE.md` 的 Query flow。

## 验证
- `tests/smoke/vectordb-*.test.mjs` 里的相关测试。
- `npm run verify`.
- 真实 corpus 收尾时，如果 vector service 无关，优先考虑 `lorekit sync --skip-vector`。
