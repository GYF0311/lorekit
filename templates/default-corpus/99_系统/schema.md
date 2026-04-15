---
type: system
title: schema
slug: 99_系统/schema
created: 2026-04-15
updated: 2026-04-15
---

# Corpus Schema

## 目录结构

```
{corpus-root}/
├── CLAUDE.md        # Agent 宪法（每次对话自动注入）
├── AGENTS.md        # 其它 harness 的入口
├── README.md        # 人类入门页
├── MEMORY.md        # L0 全局索引（自动注入，≤100 行）
│
├── _工作台/         # 过程文件（不进向量，有过期策略）
│   ├── 00_收件/     # 7  天
│   ├── 10_草稿/     # 30 天
│   ├── 20_临时/     # 14 天
│   └── 30_待整理/   # 3  天
│
├── _archive/        # 冷数据陵园（不进向量）
│
├── 00_每日/         # 日记 + 月度复盘
├── 10_人物/         # people，单页 MECE
├── 20_项目/         # projects
├── 30_概念/         # concepts，可复用心智模型
├── 40_主题/         # topics，实战方法论
├── 50_方法/         # methods，工具 SOP
├── 60_来源/         # sources（严格只读）
│   ├── 文章/
│   ├── 书籍笔记/
│   ├── 会议纪要/
│   └── 公众号原文/
├── 70_录音/         # 录音原始 + 整理稿（不进向量）
├── 80_写作/         # 创作输出
├── 90_*/            # 自选的活跃领域（留空默认）
└── 99_系统/         # schema + filing-rules + changelog
│
└── .wiki/           # lorekit 元数据（不要手工改）
    ├── version
    ├── config.yaml
    ├── vector.sqlite          (v0.5+)
    ├── installed-harnesses.json
    └── provider_cache/        (v0.5+)
```

## 三层读取策略

Agent system prompt 是稀缺资源，永远用指针风格而不是全量注入。

| 层 | 位置 | 加载方式 | 预算 |
|---|---|---|---|
| **L0** | `CLAUDE.md` + `MEMORY.md` | 对话启动自动注入 | ≤ 3k tokens |
| **L1** | `{目录}/_INDEX.md` | Agent 按需 Read | ≤ 2k tokens/次 |
| **L2** | 具体文件 | Agent 按需 Read | 按页大小 |

**铁律**：即使 corpus 长到一万张卡，自动注入部分 **永远 ≤ 3.5k tokens**。

## 页面结构

```markdown
---
(frontmatter — 见 frontmatter-spec.md)
---

# 页面标题

## Compiled Truth

（当下最好的理解，2-3 段，可被重写）

---

## Timeline

- 2026-04-15 | 事件摘要 [[双链到来源]]
- 2026-04-14 | ...（只追加，不编辑）
```

**两段用 `---` 分隔**。Compiled Truth 可被 `wiki-ingest` 重写；Timeline 只能 append。

## 向量索引 include / exclude

进索引的目录（沉淀层）：
- `00_每日`、`10_人物`、`20_项目`、`30_概念`、`40_主题`、`50_方法`
- `60_来源/文章/`、`60_来源/书籍笔记/`、`60_来源/会议纪要/`
- `80_写作`、`90_*`

不进索引的目录（缓冲/原始/元信息）：
- `_工作台/**`、`_archive/**`
- `70_录音/**`（精华已被整理稿提炼）
- `60_来源/公众号原文/**`（原始剪藏量太大）
- `99_系统/**`（schema 元信息）
- `**/_INDEX.md`、`**/.wiki/**`、`**/MEMORY.md`

逃生舱：`wiki vector query "xxx" --include 70_录音` 可临时查被排除的目录。
