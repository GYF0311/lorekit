# CLAUDE.md — Corpus Agent 宪法

> 本文件是 lorekit corpus 的 Agent 宪法，由 Claude Code 自动读取。
> 任何写入、归档、查询操作都必须遵守这里的规则。

## 这是什么

这是一个由 **lorekit** 管理的个人知识 corpus。
- lorekit 是一个给 Claude Code / Codex / Cursor 等 LLM harness 使用的 Wiki toolkit（插件，不是 harness 本体）。
- corpus 是"资料库"的意思：人、项目、概念、主题、方法、来源、录音、写作，都在这里。
- 元数据目录在 `.wiki/`（版本、向量库、provider 缓存等），**不要手工改**。

## 目录结构（11 主目录 + 2 特殊目录）

```
./
├── CLAUDE.md        # 本文件，Agent 宪法
├── AGENTS.md        # 其它 harness 的入口（See CLAUDE.md）
├── README.md        # 人类入门页
├── MEMORY.md        # L0 全局索引（自动注入）
│
├── _工作台/         # 过程文件的家（不进向量）
│   ├── 00_收件/     # 7  天过期，inbox
│   ├── 10_草稿/     # 30 天过期，draft
│   ├── 20_临时/     # 14 天过期，temp
│   └── 30_待整理/   # 3  天过期，triage
│
├── _archive/        # 冷数据陵园（不进向量）
│
├── 00_每日/         # 日记 + 月度复盘
├── 10_人物/         # people，单页 MECE
├── 20_项目/         # projects，单 md 卡片
├── 30_概念/         # concepts，可复用心智模型
├── 40_主题/         # topics，实战方法论
├── 50_方法/         # methods，工具 SOP
├── 60_来源/         # sources（严格只读原始数据）
│   ├── 文章/
│   ├── 书籍笔记/
│   ├── 会议纪要/
│   └── 公众号原文/
├── 70_录音/         # 录音原始 + 流程产物（不进向量）
├── 80_写作/         # 创作输出
└── 99_系统/         # schema + filing-rules + changelog
```

## 三条归档铁律

1. **主语决定归属**：
   > The PRIMARY SUBJECT of the content determines where it goes.
   > Not the format, not the source, not the skill that's running.
   判断"这条内容到底在讲谁/什么"，再落盘。详见 `99_系统/filing-rules.md`。

2. **sources 只放原文**：
   `60_来源/` 严格只读。任何有明确主语的分析、结论、观点都必须搬到对应的 10/20/30/40 目录。sources 里只保留原始数据快照。

3. **任何 ingest 至少一条反向链接**：
   新建或 append 一条知识时，必须在目标页面的 timeline 或 related_* 字段写回来源。没有反向链接的信息等于没有。

## 系统提示不膨胀原则（指针风格）

Agent 的 system prompt 是稀缺资源。**永远不要把全量内容塞进 context**，而是用三层指针：

- **L0（总是在线）**：`MEMORY.md`——统计概览 + 指向各目录 `_INDEX.md` 的指针。
- **L1（按需加载）**：`{目录}/_INDEX.md`——该目录的条目列表（标题 + slug + 一句话摘要）。
- **L2（定向加载）**：具体的 `{目录}/{slug}.md` 文件本身。

Agent 决策路径：
1. 先读 `MEMORY.md` 判断问题属于哪个目录。
2. 再读对应目录的 `_INDEX.md` 判断具体哪个条目。
3. 最后 read 那个条目文件。

**不要一上来就 `ls -R` 或全量 grep**——那是 context 黑洞。

## 页面结构：compiled truth + timeline

```markdown
---
(frontmatter)
---

# 标题

## Compiled Truth

当下最好的理解，2-3 段话。可被后续 ingest 重写覆盖。

---

## Timeline

- YYYY-MM-DD | 事件摘要 [[双链到来源页]]
- …（只追加，不编辑）
```

两段用 `---` 分隔。Compiled Truth 可被重写；Timeline 只能 append。

## 写入前检查清单

- [ ] 我判断的"主语"对吗？
- [ ] 目标目录是不是 sources？如果是、而且不是原文，请停下来重选目录。
- [ ] 有没有至少一条反向链接？
- [ ] frontmatter 有没有 type/title/slug/created/updated？
- [ ] 如果是更新已有页面，我是不是只动了 compiled truth 或只 append timeline？

## 相关规则文件

- `99_系统/filing-rules.md`       — 完整归档路由表
- `99_系统/frontmatter-spec.md`   — frontmatter 字段规范
- `99_系统/schema.md`             — 目录结构详解
- `99_系统/_CHANGELOG.md`         — corpus 变更日志（追加式）
