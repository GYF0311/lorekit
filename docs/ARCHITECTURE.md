# ARCHITECTURE.md — lorekit 架构

## 设计哲学

源自 [Karpathy 的 LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)：

- **原料层**（`原料/`）只读，LLM 永不改写
- **知识库层**（`知识库/`）LLM 编译产物，持续更新
- **schema**（`CLAUDE.md` / `AGENTS.md`）人 + LLM 共同维护

CLI 是薄层调度，重逻辑在 skills（agent 侧）。lorekit 自身**不调用 LLM**，只提供文件系统 + 向量库原语。这是 "thin CLI, fat skills" 风格。

## 系统总览

```mermaid
flowchart TB
  subgraph Agent["AI Agent (Claude Code / Codex / Cursor / ...)"]
    Skills["wiki-* skills<br/>纯 markdown 指令"]
  end

  subgraph CLI["lorekit CLI"]
    Cmd["commands/*"]
    Lib["lib/*"]
    Cmd --> Lib
  end

  subgraph Corpus["Corpus 文件系统"]
    Raw["原料/"]
    Wiki["知识库/"]
    Index["index.md<br/>+ 各级 _INDEX.md"]
    State["[.wiki/ingest-state.json]"]
    Vec[("[.wiki/vector.sqlite]<br/>vec_* + fts_*")]
  end

  subgraph External["外部依赖"]
    Ollama["ollama<br/>bge-m3"]
    RG["ripgrep"]
    Web["网页"]
  end

  User["先生"] -->|自然语言| Agent
  Skills -->|exec| CLI
  Lib -->|读写| Raw
  Lib -->|读写| Wiki
  Lib -->|读写| Index
  Lib -->|读写| State
  Lib -->|读写| Vec
  Lib -->|HTTP| Ollama
  Lib -->|HTTP| Web
  Lib -->|spawn| RG
```

## 核心数据流

### Ingest 流（URL → wiki）

```mermaid
sequenceDiagram
  participant Agent as wiki-ingest skill
  participant Fetch as lorekit fetch
  participant State as ingest-state.json
  participant Disk as 原料/ + 知识库/
  participant Sync as lorekit sync

  Agent->>Fetch: lorekit fetch <url>
  Fetch->>State: 查 duplicate / in-progress
  alt 命中
    Fetch-->>Agent: status=duplicate | in_progress
  else 新 URL
    Fetch->>Web: 抓 HTML + 图片
    Fetch->>Disk: 写 _工作台/收件/fetch/<slug>.md
    Fetch->>State: status=started, stepsDone=[fetch]
    Fetch-->>Agent: status=ok
  end
  Agent->>Disk: mv 到 原料/{剪藏|文章|...}/
  Agent->>State: ingest record --step archive
  Agent->>Disk: 编译 wiki 页到 知识库/
  Agent->>State: ingest record --step wiki
  Agent->>State: ingest check（死链预检）
  Agent->>State: ingest record --step lint → status=completed
  Agent->>Sync: lorekit sync
  Sync->>Disk: 刷新所有 _INDEX.md
  Sync->>Disk: merge-refresh corpus/index.md
  Sync->>Vec: 增量 embed 变更文件 + 重建 L0/L1
```

### Query 流（提问 → 答案）

```mermaid
flowchart LR
  Q["先生提问"] --> Skill["wiki-query skill"]
  Skill --> Status{"lorekit vector status<br/>mode=?"}
  Status -->|text| L0R["Read corpus/index.md"]
  L0R --> L1R["Read {dir}/_INDEX.md"]
  L1R --> L2R["Read 具体页面.md"]
  Status -->|vector| HQ["lorekit vector query --hybrid"]
  HQ --> Vec[("向量三层<br/>vec_dirs → vec_pages → vec_chunks")]
  HQ --> FTS[("BM25 三层<br/>fts_dirs → fts_pages → fts_chunks")]
  Vec --> RRF["RRF 融合<br/>k=60"]
  FTS --> RRF
  RRF --> Ans["回答先生"]
  L2R --> Ans
```

模式切换由 `lorekit vector status` 的 `mode` 字段决定，阈值 `MODE_THRESHOLD_FILES = 100`（按 indexed_files 计数，不按 chunks，跟随 Karpathy 原文 "moderate scale" 定义）。

## 核心抽象

| 抽象        | 文件                           | 责任边界                                                                      |
| ----------- | ------------------------------ | ----------------------------------------------------------------------------- |
| Corpus      | `lib/corpus.ts`                | 给一个目录，判定它是不是 corpus（看 `.wiki/` 或 `CLAUDE.md`），向上递归找根   |
| Frontmatter | `lib/corpus.ts`                | gray-matter 包装：`extractFrontmatter` / `hasFrontmatter` / `findSourceByUrl` |
| IngestState | `lib/ingest-state.ts`          | `.wiki/ingest-state.json` 单一事实源；3 个 status × N 个 stepsDone            |
| Fetcher     | `lib/fetcher/`                 | URL → 本地 markdown + 图片；L1 native fetch，L2 playwright fallback（10 文件子模块，v0.4.0 / 批次 21 拆分） |
| Chunker     | `lib/chunker.ts`               | markdown 按 `## heading` 切，加 `[title][type]` prefix                        |
| Ollama      | `lib/ollama.ts`                | 调本地 ollama `/api/embed`                                                    |
| VectorDB    | `lib/vectordb/`                | sqlite-vec + FTS5；queryFlat / queryLayered / queryBM25Layered / queryHybrid（10 文件子模块，v0.4.0 / 批次 22 拆分；批次 24-fix 后 BM25 走 chunk 直查） |
| RootIndex   | `lib/root-index.ts`            | `corpus/index.md` 的受控区合并刷新（保留人类摘要）                            |
| DirIndex    | `commands/dir-index.ts → runIndex` | 所有子目录 `_INDEX.md` 自动生成（v0.4.0 / 批次 17 从 `commands/index.ts` 改名消歧义） |
| Logger      | `utils/logger.ts`              | 全仓库输出唯一通道（CONVENTIONS 强制）                                        |

## Schema 约束

| 约束                    | 位置                                                | 备注                                                                                |
| ----------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| corpus 子目录名（中文） | 散布 lib/commands                                   | `原料` / `知识库` / `_工作台` 等是 schema 决定，**不许动**（CONVENTIONS Do Not #8） |
| 向量库路径              | `<corpus>/.wiki/vector.sqlite`                      | sqlite-vec 虚表 + FTS5 虚表共存于同一文件                                           |
| ingest 状态机           | `started` / `completed` / `failed` × `stepsDone[]`  | 加新 step 只需在 `IngestStep` 枚举里加值，状态枚举不动                              |
| 检索模式阈值            | `MODE_THRESHOLD_FILES = 100`                        | 按 indexed_files 计数，跟随 Karpathy 原文 "moderate scale ~100 sources"             |
| frontmatter 必填字段    | `templates/default-corpus/系统/frontmatter-spec.md` | 由 `lint` 命令检查（`type` / `title` / `slug` / `created` / `updated`）             |

## 外部依赖契约

| 依赖            | 接口                             | 失败降级                                               |
| --------------- | -------------------------------- | ------------------------------------------------------ |
| ollama          | `POST localhost:11434/api/embed` | 抛错；用户去 `ollama serve`。不影响 Read 三层          |
| sqlite-vec      | dynamic import                   | `optionalDependencies`；缺了 vector 命令报错并提示安装 |
| ripgrep         | `spawnSync('rg', ...)`           | fallback 到内置正则扫描                                |
| playwright-core | dynamic import                   | 缺了 antibot 站点 fetch 失败并提示装 playwright        |
| tar             | runtime dep                      | snapshot/restore 必需，无 fallback                     |

## 渐进披露的 token 预算

L0（auto-injected, ~2k token）→ L1（on-demand, ~1k/pull）→ L2（targeted）→ L3（向量 fallback）。
单次 query 总 token 通常 < 5k。这是 lorekit 区别于传统 RAG 的关键：检索不是兜底，而是分层渐进。
