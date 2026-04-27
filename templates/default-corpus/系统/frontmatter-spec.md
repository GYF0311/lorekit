---
type: system
title: frontmatter-spec
slug: 系统/frontmatter-spec
created: 2026-04-16
updated: 2026-04-16
---

# Frontmatter 规范

所有 lorekit 管理的 markdown 文件必须带 YAML frontmatter。

## 必填字段

```yaml
---
type: concept|entity|summary|topic|source|daily|writing|system
title: 页面标题
slug: path/after-corpus-root
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

| 字段 | 说明 |
|---|---|
| `type` | 页面语义类型，对应所在目录 |
| `title` | 人类可读标题，不等于文件名 |
| `slug` | 从 corpus 根到本文件的相对路径（不含 `.md`） |
| `created` | 首次落盘日期 |
| `updated` | 最近一次内容修改日期 |

### type 值与目录映射

| type | 所在目录 |
|---|---|
| `concept` | `知识库/概念/` |
| `entity` | `知识库/实体/` |
| `summary` | `知识库/摘要/` |
| `topic` | `知识库/专题/` |
| `source` | `原料/*` |
| `daily` | `每日/` |
| `writing` | `写作/` |
| `system` | `系统/` |

## 选填字段

```yaml
tags: [tag1, tag2]
status: idea | in_progress | done | archived
valid_until: YYYY-MM-DD
sources: [原料中的 slug 列表]
```

## 类型特定字段

### `type: entity`（人物）
```yaml
entity_kind: person | tool | org | project
role: 同事 | 亲密关系 | 贵人 | 行业偶像
relationship_since: YYYY-MM-DD
repo_local: ~/code/xxx
repo_remote: https://github.com/xxx
tech_stack: [Claude Code, sqlite-vec]
```

### `type: source`
```yaml
source_url: https://...
source_author: xxx
source_date: YYYY-MM-DD
source_kind: article | paper | book | meeting | recording | clipping
source_title: 原始来源标题
local_title: 本地补齐标题（仅本地文件/粘贴文本需要）
```

`lorekit source finalize` 负责给已归档到 `原料/` 的 source 补 `slug` / `raw_sha256` / `last_verified` / `possibly_outdated`；`lorekit ingest record --title --source-date --source-kind --archived-to ...` 负责把本地 source 的标题与来源元数据写进 ingest state，避免进入 lint 后才发现记录不完整。

### `type: system`

系统文件必须加：

```yaml
graph-excluded: true
```

`系统/missing-nodes.md` 是 links closure backlog，记录“暂不建 stub 的缺失节点”。它不是知识页，不进入图谱、向量索引或 `_INDEX.md`。

## 时间格式

- 日期：`YYYY-MM-DD`
- 时间戳：`YYYY-MM-DD HH:mm`
- 时区：统一 Asia/Shanghai，不写后缀

## updated 铁律

**任何内容修改都必须同步刷新 `updated`**。这是向量层增量同步的依据。

## slug 意义

`slug` 是文件在 corpus 里的永久地址：
1. 向量检索的反向索引
2. 跨 corpus 移动时保持引用稳定
3. 人类可读的 canonical 引用

**slug 一旦写入尽量不改**。改了要全 corpus 替换所有 `[[slug]]` 链接。

## 示例

### 实体卡（人物）

```yaml
---
type: entity
title: 筠桓
slug: 知识库/实体/筠桓
created: 2026-03-20
updated: 2026-04-16
entity_kind: person
role: 亲密关系
relationship_since: 2024-08
tags: [家人]
---
```

### 概念卡

```yaml
---
type: concept
title: RAG
slug: 知识库/概念/RAG
created: 2025-11-02
updated: 2026-04-16
tags: [ai, retrieval]
valid_until: 2027-04-10
---
```

### 来源文章

```yaml
---
type: source
title: "LLM Powered Autonomous Agents"
slug: 原料/文章/lilian-weng-agents
created: 2026-04-16
updated: 2026-04-16
source_url: https://lilianweng.github.io/posts/2023-06-23-agent/
source_author: Lilian Weng
source_date: 2023-06-23
source_kind: article
tags: [agent, survey]
---
```
