---
type: "cmap-module"
schema: "cmap.module.v1"
project: "lorekit"
module_id: "fetch-ingest"
status: "active"
layer: "unknown"
risk: "unknown"
source_path: ".context/modules/fetch-ingest.md"
source_hash: "sha256:fe043c804bccd6ad1bbad43968b88ad8d34aae94e0aa307dd9cf4ea52a7b687c"
tags:
  - "cmap/module"
  - "cmap/project/lorekit"
aliases:
  - "fetch"
  - "ingest"
  - "ingestion"
  - "微信"
  - "公众号"
  - "duplicate"
  - "in-progress"
  - "state"
  - "抓取"
  - "入库"
paths:
  - "src/commands/fetch.ts"
  - "src/commands/ingest.ts"
  - "src/lib/fetcher/**"
  - "src/lib/ingest-state.ts"
---

# Fetch Ingest

> Source: `.context/modules/fetch-ingest.md`

## Relations

### depends_on

- [[Corpus Core]]

### feeds

- [[Sync Search Vector]]

### guided_by

- [[Skills Agent]]


## Source Module Doc

# Module: Fetch / Ingest

## Purpose
把外部来源抓到工作台，并记录每个来源在 ingest pipeline 中走到哪一步。

## Owned Paths
- `src/commands/fetch.ts`
- `src/commands/ingest.ts`
- `src/lib/fetcher/**`
- `src/lib/ingest-state.ts`

## Key Contracts
- `lorekit fetch <url>` 把抓取结果写到 `_工作台/收件/`，并记录 `status: started`、`stepsDone: [fetch]`。
- `.wiki/ingest-state.json` 是 duplicate / in-progress / completed / failed 的 pipeline SSOT。
- fetch route 覆盖 generic web、WeChat、GitHub doc、Gist。
- 最终归档位置和 wiki synthesis 由 AI skills 决定，不由 fetcher 决定。
- 工作台 frontmatter 和正式 wiki frontmatter 可不同；lint 规则要尊重这个阶段边界。

## Module Relationships
- 依赖 `corpus-core` 的 corpus 发现、frontmatter、路径规则。
- 产物流向 `sync-search-vector`。
- agent 侧流程由 `skills-agent` 的 `wiki-ingest` 约束。

## Read Next
- `README.md` 的 Ingest Pipeline。
- `docs/ARCHITECTURE.md` 的 Ingest flow。
- `skills/wiki-ingest/SKILL.md`。

## Tests / Verification
- `node --test tests/smoke/fetch-mock.test.mjs tests/smoke/ingest-record.test.mjs`
- `npm run verify`
