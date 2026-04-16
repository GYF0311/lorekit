---
type: system
title: schema
slug: 系统/schema
created: 2026-04-16
updated: 2026-04-16
---

# Corpus Schema

> 基于 [Karpathy LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)，lorekit 实现。

## 核心理念

RAG 每次查询都在从原始文档重新发现知识，没有累积。LLM Wiki 不同——LLM **增量编译并维护一个持久 wiki**，知识编译一次、持续更新。wiki 是一个 **persistent, compounding artifact**。

## 三层架构

| 层 | 目录 | 读写 | 说明 |
|---|---|---|---|
| **原料层** | `原料/` | LLM 只读 | 不可变的 source of truth |
| **产物层** | `知识库/` | LLM 独占写 | 编译出的交叉引用 wiki |
| **Schema** | `CLAUDE.md` | 人 + LLM 共写 | 本 corpus 的配置和状态 |

## 目录结构

```
{corpus-root}/
├── CLAUDE.md            # per-corpus schema（co-evolve）
├── index.md             # wiki 内容目录（LLM 维护）
├── log.md               # 操作时间线（append-only）
│
├── 原料/                # Raw sources（只读）
│   ├── 文章/            # 网页文章
│   ├── 论文/            # 学术论文
│   ├── 书籍/            # 读书笔记
│   ├── 会议/            # 会议纪要
│   ├── 录音/            # 录音转写文本
│   ├── 剪藏/            # 公众号/网页剪藏
│   └── 引用/            # 大文件指针（正文在外部）
│
├── 知识库/              # Wiki（LLM 编译产物）
│   ├── 概念/            # 心智模型、方法论、抽象概念
│   ├── 实体/            # 人物、工具、组织、项目
│   ├── 摘要/            # 逐源摘要页（每篇 raw 对应一篇）
│   └── 专题/            # 跨源主题综述（可选）
│
├── 每日/                # 日记（YYYY-MM-DD.md）
├── 写作/                # 对外创作输出
│
├── 反馈/                # 人类审阅闭环
│   ├── 待处理/          # open feedback
│   └── 已处理/          # resolved + resolution 说明
│
├── _工作台/             # 过程文件（有过期策略，不进向量）
│   ├── 收件/            # 7 天
│   ├── 草稿/            # 30 天
│   ├── 临时/            # 14 天
│   └── 待整理/          # 3 天
│
├── _归档/               # 冷数据陵园（不进向量）
│
└── .wiki/               # lorekit 元数据（不要手工改）
    ├── version
    ├── config.yaml
    └── vector.sqlite    (v0.5+)
```

## 知识库/ 子目录说明

知识库的子目录结构由本 corpus 的 **CLAUDE.md** 声明，不是全局固定。上面是默认预设：

- `概念/` — 可复用的心智模型、方法论。一个概念页 **400-1200 字**，超过则拆子目录
- `实体/` — 人物、工具、组织、项目。按 Notability gate 决定是否建页
- `摘要/` — 每篇原料对应一篇摘要页，是 原料 → 知识库 的桥梁
- `专题/` — 跨多篇原料的主题综述。corpus 较小时可以不用

不同 domain 可以换成完全不同的子目录（如 `角色/章节/主题/` 用于读书 wiki）。

## 两个特殊文件

### index.md

内容导向的 catalog。每页一行：`- [[Page]] — 一句话摘要`，按类别分组。

- LLM 每次 ingest 后更新
- Agent 查询时先读 index.md 定位相关页，再钻入具体文件
- 中小规模（~100 源，~数百页）下足够用，不需要向量检索

### log.md

时间导向的操作日志。append-only。

- 每条前缀 `## [YYYY-MM-DD] 操作类型 | 标题`
- 可用 `grep "^## \[" log.md | tail -10` 快速查最近操作
- 记录 ingest / query-fileback / lint 等操作

## 页面结构

```markdown
---
(frontmatter — 见 frontmatter-spec.md)
---

# 页面标题

## Compiled Truth

（当下最好的理解，2-3 段，可被后续 ingest 重写）

---

## Timeline

- YYYY-MM-DD | 事件摘要 [[双链到来源]]
- ...（只追加，不编辑）
```

## 向量索引 include / exclude

进索引的目录：
- `知识库/**`、`每日/`、`写作/`
- `原料/文章/`、`原料/书籍/`、`原料/会议/`

不进索引的目录：
- `_工作台/**`、`_归档/**`
- `原料/录音/**`（精华已被摘要提炼）
- `原料/剪藏/**`（原始剪藏量太大）
- `反馈/**`（过程性内容）
- `系统/**`（schema 元信息）
- `.wiki/**`

逃生舱：`wiki search "xxx" --include 原料/录音` 可临时查被排除的目录。

## 三个操作

| 操作 | 触发 | 效果 |
|---|---|---|
| **Ingest** | 新原料进 `原料/` | LLM 编译进 `知识库/`，更新 index.md + log.md |
| **Query** | 用户提问 | 读 index.md → 钻入页面 → 综合回答。好答案 file back |
| **Lint** | `wiki doctor` | 检查死链、孤岛、矛盾、过期工作台文件 |
