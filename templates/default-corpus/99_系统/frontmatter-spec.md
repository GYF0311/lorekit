---
type: system
title: frontmatter-spec
slug: 99_系统/frontmatter-spec
created: 2026-04-15
updated: 2026-04-15
---

# Frontmatter 规范

所有 lorekit 管理的 markdown 文件必须带 YAML frontmatter。

## 必填字段

```yaml
---
type: person|project|concept|topic|method|source|daily|writing|system
title: 页面标题
slug: path/after-corpus-root
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

| 字段 | 说明 |
|---|---|
| `type` | 对应主目录语义。用于 `wiki stats --type <t>` 和向量索引分层 |
| `title` | 人类可读标题，不等于文件名 |
| `slug` | 从 corpus 根到本文件的相对路径（不含 `.md` 后缀） |
| `created` | 首次落盘日期 |
| `updated` | 最近一次内容修改日期（Agent 每次改动都要同步刷新） |

## 选填字段

```yaml
tags: [tag1, tag2]
status: idea | in_progress | done | archived
valid_until: YYYY-MM-DD       # Zep 式时效标记，过期触发复查
related_persons: [[10_人物/xxx]]
related_concepts: [[30_概念/xxx]]
related_projects: [[20_项目/xxx]]
```

## 类型特定字段

### `type: project`
```yaml
repo_local: ~/code/xxx
repo_remote: https://github.com/xxx
tech_stack: [Claude Code, sqlite-vec]
```

### `type: person`
```yaml
role: 同事 | 亲密关系 | 贵人 | 行业偶像
relationship_since: YYYY-MM-DD
```

### `type: source`
```yaml
source_url: https://...
source_author: xxx
source_date: YYYY-MM-DD
```

## 时间格式

- 日期：`YYYY-MM-DD`
- 时间戳（精确到分）：`YYYY-MM-DD HH:mm`
- 时区：统一 Asia/Shanghai，不写时区后缀

## updated 字段的铁律

**任何内容修改都必须同步刷新 `updated`**。这是向量层 `wiki vector sync` 增量判断的依据之一（除了 SHA256 hash）。

Agent 修改页面时，先改内容，再在同一次 Edit 里刷新 `updated` 字段。如果漏改，`wiki lint` 会把它报出来。

## slug 字段的意义

`slug` 是文件在 corpus 里的"永久地址"。它的作用：

1. 向量检索的反向索引（vec 库只存 slug，不存绝对路径）
2. 跨 corpus 移动时保持引用稳定
3. 给人类复制粘贴用的 canonical 引用

**slug 一旦写入，尽量不改**。改了要全 corpus 替换所有 `[[slug]]` 链接。

## 示例

### 人物卡

```yaml
---
type: person
title: 筠桓
slug: 10_人物/筠桓
created: 2026-03-20
updated: 2026-04-15
role: 亲密关系
relationship_since: 2024-08
tags: [家人]
related_projects: [[20_项目/RAG知识治理]]
---
```

### 概念卡

```yaml
---
type: concept
title: RAG
slug: 30_概念/RAG
created: 2025-11-02
updated: 2026-04-10
tags: [ai, retrieval]
related_topics: [[40_主题/向量检索]]
valid_until: 2027-04-10
---
```

### 来源文章

```yaml
---
type: source
title: "LLM Powered Autonomous Agents"
slug: 60_来源/文章/lilian-weng-agents
created: 2026-04-15
updated: 2026-04-15
source_url: https://lilianweng.github.io/posts/2023-06-23-agent/
source_author: Lilian Weng
source_date: 2023-06-23
tags: [agent, survey]
---
```
